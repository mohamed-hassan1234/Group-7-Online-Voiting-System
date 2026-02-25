
import mongoose from "mongoose";
import Poll, { POLL_STATUSES } from "../models/Poll.js";
import Vote from "../models/Vote.js";
import User from "../models/User.js";
import Competitor, { COMPETITOR_SEX_VALUES } from "../models/Competitor.js";
import { ROLES } from "../constants/roles.js";
import { publishPollResults, subscribeToPollResults } from "../utils/pollRealtime.js";

const VALID_POLL_STATUSES = Object.values(POLL_STATUSES);
const POPULATE_COMPETITORS = { path: "competitors.competitor", select: "name email phone sex imageUrl" };
const normalizeText = (v) => (typeof v === "string" ? v.trim() : "");
const normalizeLower = (v) => normalizeText(v).toLowerCase();
const isId = (v) => mongoose.isValidObjectId(v);
const bodyOf = (req) => (req?.body && typeof req.body === "object" ? req.body : {});
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const getUploadedImageUrl = (req, subFolder) => {
  if (!req?.file?.filename) {
    return "";
  }
  return `${req.protocol}://${req.get("host")}/uploads/${subFolder}/${req.file.filename}`;
};

const parseDateInput = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const getIdentity = (req) => {
  const b = bodyOf(req);
  return {
    userId: req.get("x-user-id") ?? b.userId ?? b.adminId ?? req.query?.userId ?? req.query?.adminId ?? null,
    email: req.get("x-user-email") ?? b.email ?? b.userEmail ?? b.adminEmail ?? b.createdByEmail ?? req.query?.email ?? null,
  };
};

const resolveUser = async (req) => {
  if (req.authUser) return req.authUser;
  const sid = req.session?.userId;
  if (sid && isId(sid)) {
    const sUser = await User.findById(sid);
    if (sUser) return sUser;
  }
  const { userId, email } = getIdentity(req);
  if (userId && isId(userId)) {
    const byId = await User.findById(userId);
    if (byId) return byId;
  }
  const nEmail = normalizeLower(email);
  if (nEmail) return User.findOne({ email: nEmail });
  return null;
};

const requireUser = async (req, res) => {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ message: "user verification failed" });
    return null;
  }
  return user;
};

const requireAdmin = async (req, res) => {
  let user = await resolveUser(req);
  if (!user && process.env.NODE_ENV !== "production") {
    const count = await User.countDocuments({ role: ROLES.ADMIN });
    if (count === 1) user = await User.findOne({ role: ROLES.ADMIN });
  }
  if (!user) {
    res.status(401).json({ message: "admin verification failed" });
    return null;
  }
  if (user.role !== ROLES.ADMIN) {
    res.status(403).json({ message: "admin role is required" });
    return null;
  }
  return user;
};

const extractId = (item) => {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  return normalizeText(item.competitorId || item.id || item._id || item.competitor);
};

const parseListInput = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
};

const parseCompetitorIds = (input) => {
  if (!Array.isArray(input)) return { ids: [], invalidIds: [] };
  const ids = [];
  const invalidIds = [];
  const seen = new Set();
  for (const item of input) {
    const id = extractId(item);
    if (!id) continue;
    if (!isId(id)) {
      invalidIds.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids, invalidIds };
};

const getCompetitorInput = (b) => {
  const raw = b.competitorIds ?? b.competitors ?? b.options ?? [];
  return parseListInput(raw);
};

const checkCompetitorsExist = async (ids) => {
  const docs = await Competitor.find({ _id: { $in: ids } }).select("_id");
  const set = new Set(docs.map((d) => String(d._id)));
  return ids.filter((id) => !set.has(String(id)));
};

const pollView = async (poll, selectedCompetitorId = null) => {
  const full = poll?.populate ? await poll.populate(POPULATE_COMPETITORS) : poll;
  const items = Array.isArray(full?.competitors) ? full.competitors : [];
  const totalVotes = typeof full?.totalVotes === "number" ? full.totalVotes : items.reduce((s, i) => s + (i.votesCount || 0), 0);
  const safeTotal = totalVotes > 0 ? totalVotes : 0;
  const competitors = items.map((row) => {
    const c = row?.competitor && typeof row.competitor === "object" ? row.competitor : null;
    const cid = c?._id || row?.competitor;
    const votesCount = row?.votesCount || 0;
    const percentage = safeTotal === 0 ? 0 : Number(((votesCount / safeTotal) * 100).toFixed(2));
    return {
      id: cid,
      competitorId: cid,
      name: c?.name || "",
      email: c?.email || "",
      phone: c?.phone || "",
      sex: c?.sex || "",
      imageUrl: c?.imageUrl || "",
      votesCount,
      percentage,
      isSelected: selectedCompetitorId ? String(cid) === String(selectedCompetitorId) : false,
    };
  });

  return {
    id: full._id,
    title: full.title,
    description: full.description,
    imageUrl: full.imageUrl || "",
    status: full.status,
    startsAt: full.startsAt,
    endsAt: full.endsAt,
    totalVotes: safeTotal,
    competitors,
    options: competitors.map((x) => ({ id: x.id, label: x.name, imageUrl: x.imageUrl, votesCount: x.votesCount, percentage: x.percentage, isSelected: x.isSelected })),
    createdBy: full.createdBy,
    isArchived: full.isArchived,
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
  };
};

const getUserVoteCompetitorId = async (pollId, userId) => {
  if (!userId) return null;
  const vote = await Vote.findOne({ poll: pollId, user: userId }).select("competitorId optionId");
  return vote?.competitorId || vote?.optionId || null;
};

const mapCompetitorsToPoll = (ids) => ids.map((id) => ({ competitor: id, votesCount: 0 }));

export const createCompetitor = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { name, email, password, phone, sex } = bodyOf(req);
    const imageUrl = getUploadedImageUrl(req, "competitors");
    const parsed = {
      name: normalizeText(name),
      email: normalizeLower(email),
      phone: normalizeText(phone),
      sex: normalizeLower(sex),
    };
    if (!parsed.name || !parsed.email || !password || !parsed.phone || !parsed.sex) {
      return res.status(400).json({ message: "name, email, password, phone and sex are required" });
    }
    if (!COMPETITOR_SEX_VALUES.includes(parsed.sex)) {
      return res.status(400).json({ message: "invalid sex value", allowedSexValues: COMPETITOR_SEX_VALUES });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }
    const exists = await Competitor.findOne({ email: parsed.email });
    if (exists) return res.status(409).json({ message: "competitor email already exists" });
    const competitor = await Competitor.create({ ...parsed, password, imageUrl });
    return res.status(201).json({ message: "competitor created successfully", competitor: competitor.toPublicJSON() });
  } catch (error) {
    return res.status(500).json({ message: "failed to create competitor", error: error.message });
  }
};

export const listCompetitors = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const search = normalizeText(req.query?.search);
    const filter = {};
    if (search) {
      const rgx = new RegExp(search, "i");
      filter.$or = [{ name: rgx }, { email: rgx }, { phone: rgx }];
    }
    const competitors = await Competitor.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ competitors: competitors.map((c) => c.toPublicJSON()) });
  } catch (error) {
    return res.status(500).json({ message: "failed to list competitors", error: error.message });
  }
};
export const createPoll = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const b = bodyOf(req);
    const imageUrl = getUploadedImageUrl(req, "polls");
    const title = normalizeText(b.title);
    if (!title) return res.status(400).json({ message: "title is required" });

    const { ids, invalidIds } = parseCompetitorIds(getCompetitorInput(b));
    if (invalidIds.length) return res.status(400).json({ message: "invalid competitor ids provided", invalidIds });
    if (ids.length < 2) return res.status(400).json({ message: "at least two unique competitor ids are required" });

    const missingIds = await checkCompetitorsExist(ids);
    if (missingIds.length) return res.status(400).json({ message: "some competitor ids do not exist", missingIds });

    const status = normalizeLower(b.status || POLL_STATUSES.DRAFT);
    if (!VALID_POLL_STATUSES.includes(status)) {
      return res.status(400).json({ message: "invalid status value", allowedStatuses: VALID_POLL_STATUSES });
    }

    const startsAt = parseDateInput(b.startsAt);
    const endsAt = parseDateInput(b.endsAt);
    if (startsAt === undefined || endsAt === undefined) return res.status(400).json({ message: "invalid startsAt or endsAt date format" });
    if (startsAt && endsAt && startsAt > endsAt) return res.status(400).json({ message: "startsAt must be before endsAt" });

    const poll = await Poll.create({
      title,
      description: normalizeText(b.description),
      imageUrl,
      status,
      startsAt,
      endsAt,
      createdBy: admin._id,
      competitors: mapCompetitorsToPoll(ids),
    });

    return res.status(201).json({ message: "poll created successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to create poll", error: error.message });
  }
};

const updatePollCompetitors = async (poll, b, allowSingle = false) => {
  const { ids, invalidIds } = parseCompetitorIds(getCompetitorInput(b));
  if (invalidIds.length) return { code: 400, payload: { message: "invalid competitor ids provided", invalidIds } };
  const min = allowSingle ? 1 : 2;
  if (ids.length < min) return { code: 400, payload: { message: `at least ${min} unique competitor ids are required` } };
  const missingIds = await checkCompetitorsExist(ids);
  if (missingIds.length) return { code: 400, payload: { message: "some competitor ids do not exist", missingIds } };
  poll.competitors = mapCompetitorsToPoll(ids);
  return null;
};

export const updatePoll = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });

    const b = bodyOf(req);
    if (b.title !== undefined) {
      const title = normalizeText(b.title);
      if (!title) return res.status(400).json({ message: "title cannot be empty" });
      poll.title = title;
    }
    if (b.description !== undefined) poll.description = normalizeText(b.description);
    if (req.file?.filename) poll.imageUrl = getUploadedImageUrl(req, "polls");

    const hasCompetitorUpdate = hasOwn(b, "competitorIds") || hasOwn(b, "competitors") || hasOwn(b, "options");
    if (hasCompetitorUpdate) {
      if (poll.totalVotes > 0) return res.status(400).json({ message: "competitors cannot be changed after voting starts" });
      const err = await updatePollCompetitors(poll, b);
      if (err) return res.status(err.code).json(err.payload);
    }

    const startsAt = parseDateInput(b.startsAt);
    const endsAt = parseDateInput(b.endsAt);
    if (startsAt === undefined || endsAt === undefined) return res.status(400).json({ message: "invalid startsAt or endsAt date format" });
    if (b.startsAt !== undefined) poll.startsAt = startsAt;
    if (b.endsAt !== undefined) poll.endsAt = endsAt;
    if (poll.startsAt && poll.endsAt && poll.startsAt > poll.endsAt) return res.status(400).json({ message: "startsAt must be before endsAt" });

    await poll.save();
    publishPollResults(poll._id);
    return res.status(200).json({ message: "poll updated successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to update poll", error: error.message });
  }
};

export const addPollCompetitors = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });
    if (poll.totalVotes > 0) return res.status(400).json({ message: "competitors cannot be changed after voting starts" });

    const { ids: newIds, invalidIds } = parseCompetitorIds(getCompetitorInput(bodyOf(req)));
    if (invalidIds.length) return res.status(400).json({ message: "invalid competitor ids provided", invalidIds });
    if (newIds.length < 1) return res.status(400).json({ message: "at least one competitor id is required" });

    const existing = poll.competitors.map((x) => String(x.competitor));
    const merged = [...new Set([...existing, ...newIds])];
    if (merged.length === existing.length) return res.status(409).json({ message: "no new unique competitors to add" });
    if (merged.length < 2) return res.status(400).json({ message: "a poll must include at least two competitors" });

    const missingIds = await checkCompetitorsExist(merged);
    if (missingIds.length) return res.status(400).json({ message: "some competitor ids do not exist", missingIds });

    poll.competitors = mapCompetitorsToPoll(merged);
    await poll.save();
    publishPollResults(poll._id);
    return res.status(200).json({ message: "competitors assigned successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to assign competitors", error: error.message });
  }
};

export const replacePollCompetitors = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });
    if (poll.totalVotes > 0) return res.status(400).json({ message: "competitors cannot be changed after voting starts" });

    const err = await updatePollCompetitors(poll, bodyOf(req));
    if (err) return res.status(err.code).json(err.payload);

    await poll.save();
    publishPollResults(poll._id);
    return res.status(200).json({ message: "competitors updated successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to update competitors", error: error.message });
  }
};

export const removePollCompetitor = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { pollId, competitorId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });
    if (!isId(competitorId)) return res.status(400).json({ message: "invalid competitor id" });

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });
    if (poll.totalVotes > 0) return res.status(400).json({ message: "competitors cannot be changed after voting starts" });

    const existing = poll.competitors.map((x) => String(x.competitor));
    if (!existing.includes(String(competitorId))) return res.status(404).json({ message: "competitor not found in this poll" });

    const remaining = existing.filter((id) => id !== String(competitorId));
    if (remaining.length < 2) return res.status(400).json({ message: "a poll must keep at least two competitors" });

    poll.competitors = mapCompetitorsToPoll(remaining);
    await poll.save();
    publishPollResults(poll._id);
    return res.status(200).json({ message: "competitor removed successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to remove competitor", error: error.message });
  }
};
export const listPollCompetitors = async (req, res) => {
  try {
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });
    const poll = await Poll.findById(pollId).populate(POPULATE_COMPETITORS);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });

    const user = await resolveUser(req);
    if (poll.status === POLL_STATUSES.DRAFT && user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: "draft poll is admin-only" });
    }

    const selected = await getUserVoteCompetitorId(poll._id, user?._id);
    const view = await pollView(poll, selected);
    return res.status(200).json({ pollId: poll._id, competitors: view.competitors });
  } catch (error) {
    return res.status(500).json({ message: "failed to list competitors", error: error.message });
  }
};

export const updatePollStatus = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const status = normalizeLower(bodyOf(req).status);
    if (!VALID_POLL_STATUSES.includes(status)) {
      return res.status(400).json({ message: "invalid status value", allowedStatuses: VALID_POLL_STATUSES });
    }

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });

    poll.status = status;
    await poll.save();
    publishPollResults(poll._id);
    return res.status(200).json({ message: "poll status updated successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to update poll status", error: error.message });
  }
};

export const archivePoll = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });

    poll.isArchived = true;
    poll.status = POLL_STATUSES.CLOSED;
    await poll.save();
    publishPollResults(poll._id);
    return res.status(200).json({ message: "poll archived successfully", poll: await pollView(poll) });
  } catch (error) {
    return res.status(500).json({ message: "failed to archive poll", error: error.message });
  }
};

export const listPolls = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const isAdmin = user?.role === ROLES.ADMIN;
    const statusQuery = normalizeLower(req.query?.status);
    const includeDraft = normalizeLower(req.query?.includeDraft) === "true";

    const filter = { isArchived: false };
    if (statusQuery) {
      if (statusQuery !== "all" && !VALID_POLL_STATUSES.includes(statusQuery)) {
        return res.status(400).json({ message: "invalid status value", allowedStatuses: [...VALID_POLL_STATUSES, "all"] });
      }
      if (statusQuery === POLL_STATUSES.DRAFT && !isAdmin) {
        return res.status(403).json({ message: "draft polls are admin-only" });
      }
      filter.status = statusQuery === "all" ? (isAdmin ? undefined : { $ne: POLL_STATUSES.DRAFT }) : statusQuery;
      if (filter.status === undefined) delete filter.status;
    } else if (!isAdmin || !includeDraft) {
      filter.status = { $ne: POLL_STATUSES.DRAFT };
    }

    const polls = await Poll.find(filter).sort({ createdAt: -1 }).populate(POPULATE_COMPETITORS);
    const selected = new Map();
    if (user && polls.length > 0) {
      const votes = await Vote.find({ user: user._id, poll: { $in: polls.map((p) => p._id) } }).select("poll competitorId optionId");
      for (const v of votes) selected.set(String(v.poll), v.competitorId || v.optionId);
    }

    const result = [];
    for (const poll of polls) result.push(await pollView(poll, selected.get(String(poll._id))));
    return res.status(200).json({ polls: result });
  } catch (error) {
    return res.status(500).json({ message: "failed to list polls", error: error.message });
  }
};

export const getPollById = async (req, res) => {
  try {
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const poll = await Poll.findById(pollId).populate(POPULATE_COMPETITORS);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });

    const user = await resolveUser(req);
    if (poll.status === POLL_STATUSES.DRAFT && user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: "draft poll is admin-only" });
    }

    const selected = await getUserVoteCompetitorId(poll._id, user?._id);
    return res.status(200).json({ poll: await pollView(poll, selected) });
  } catch (error) {
    return res.status(500).json({ message: "failed to get poll", error: error.message });
  }
};

export const castVote = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const { pollId } = req.params;
    const selected = normalizeText(bodyOf(req).competitorId || bodyOf(req).optionId);
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });
    if (!isId(selected)) return res.status(400).json({ message: "invalid competitor id" });

    const poll = await Poll.findById(pollId);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });
    if (!poll.isOpenForVoting()) return res.status(400).json({ message: "poll is not open for voting" });

    const allowed = poll.competitors.some((x) => String(x.competitor) === String(selected));
    if (!allowed) return res.status(400).json({ message: "selected competitor is not assigned to this poll" });

    try {
      await Vote.create({ poll: poll._id, user: user._id, competitorId: selected, optionId: selected });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ message: "you have already voted in this poll" });
      throw error;
    }

    await Poll.updateOne({ _id: poll._id, "competitors.competitor": selected }, { $inc: { "competitors.$.votesCount": 1, totalVotes: 1 } });
    publishPollResults(poll._id);

    const updated = await Poll.findById(poll._id).populate(POPULATE_COMPETITORS);
    return res.status(201).json({ message: "vote cast successfully", results: await pollView(updated, selected) });
  } catch (error) {
    return res.status(500).json({ message: "failed to cast vote", error: error.message });
  }
};

export const getPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const poll = await Poll.findById(pollId).populate(POPULATE_COMPETITORS);
    if (!poll || poll.isArchived) return res.status(404).json({ message: "poll not found" });

    const user = await resolveUser(req);
    if (poll.status === POLL_STATUSES.DRAFT && user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: "draft poll is admin-only" });
    }

    const selected = await getUserVoteCompetitorId(poll._id, user?._id);
    return res.status(200).json({ results: await pollView(poll, selected) });
  } catch (error) {
    return res.status(500).json({ message: "failed to get poll results", error: error.message });
  }
};

export const streamPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;
    if (!isId(pollId)) return res.status(400).json({ message: "invalid poll id" });

    const first = await Poll.findById(pollId).populate(POPULATE_COMPETITORS);
    if (!first || first.isArchived) return res.status(404).json({ message: "poll not found" });

    const user = await resolveUser(req);
    if (first.status === POLL_STATUSES.DRAFT && user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: "draft poll is admin-only" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendLatest = async () => {
      const poll = await Poll.findById(pollId).populate(POPULATE_COMPETITORS);
      if (!poll || poll.isArchived) {
        res.write(`event: poll-unavailable\n`);
        res.write(`data: ${JSON.stringify({ message: "poll is no longer available" })}\n\n`);
        return;
      }
      const selected = await getUserVoteCompetitorId(poll._id, user?._id);
      res.write(`event: results\n`);
      res.write(`data: ${JSON.stringify(await pollView(poll, selected))}\n\n`);
    };

    await sendLatest();
    const off = subscribeToPollResults(pollId, () => sendLatest().catch(() => {}));
    const ping = setInterval(() => {
      res.write(`event: ping\n`);
      res.write(`data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(ping);
      off();
      res.end();
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to stream poll results", error: error.message });
  }
};

export const getDashboardOverview = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [totalPolls, activePolls, closedPolls, draftPolls, totalVotes, totalUsers, voters] = await Promise.all([
      Poll.countDocuments({ isArchived: false }),
      Poll.countDocuments({ isArchived: false, status: POLL_STATUSES.ACTIVE }),
      Poll.countDocuments({ isArchived: false, status: POLL_STATUSES.CLOSED }),
      Poll.countDocuments({ isArchived: false, status: POLL_STATUSES.DRAFT }),
      Vote.countDocuments({}),
      User.countDocuments({}),
      Vote.distinct("user"),
    ]);

    const participationRate = totalUsers === 0 ? 0 : Number(((voters.length / totalUsers) * 100).toFixed(2));
    const topPollsRaw = await Poll.find({ isArchived: false }).sort({ totalVotes: -1, createdAt: -1 }).limit(5).populate(POPULATE_COMPETITORS);
    const topPolls = [];
    for (const poll of topPollsRaw) topPolls.push(await pollView(poll));

    return res.status(200).json({
      totals: { totalPolls, activePolls, closedPolls, draftPolls, totalVotes, totalUsers, totalVoters: voters.length, participationRate },
      topPolls,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to load dashboard overview", error: error.message });
  }
};

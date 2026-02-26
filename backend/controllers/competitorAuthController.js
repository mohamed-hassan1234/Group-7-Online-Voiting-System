import Poll, { POLL_STATUSES } from "../models/Poll.js";
import Competitor, { COMPETITOR_SEX_VALUES } from "../models/Competitor.js";
import { buildUploadedAssetUrl, normalizeUploadedAssetUrl } from "../utils/publicUrl.js";

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const MIN_PASSWORD_LENGTH = 6;

const formatCompetitor = (competitor) => {
  const item = competitor.toPublicJSON();
  item.imageUrl = normalizeUploadedAssetUrl(item.imageUrl);
  return item;
};

const startCompetitorSession = (req, competitor) => {
  if (!req.session) {
    return;
  }

  req.session.competitorId = String(competitor._id);
  req.session.userId = undefined;
  req.session.userRole = undefined;
};

const getUploadedImageUrl = (fileName) => {
  if (!fileName) {
    return "";
  }
  return buildUploadedAssetUrl("competitors", fileName);
};

const getPollPhase = (poll, nowTs = Date.now()) => {
  const startsAtTs = poll?.startsAt ? new Date(poll.startsAt).getTime() : null;
  const endsAtTs = poll?.endsAt ? new Date(poll.endsAt).getTime() : null;

  if (poll?.status === POLL_STATUSES.CLOSED || (endsAtTs !== null && nowTs > endsAtTs)) {
    return "ended";
  }

  if (startsAtTs !== null && nowTs < startsAtTs) {
    return "upcoming";
  }

  if (poll?.status === POLL_STATUSES.ACTIVE) {
    return "ongoing";
  }

  return "upcoming";
};

const mapParticipation = (poll, competitorId, nowTs = Date.now()) => {
  const rows = Array.isArray(poll?.competitors)
    ? poll.competitors.map((row) => {
        const competitorObject =
          row?.competitor && typeof row.competitor === "object" ? row.competitor : null;
        const rowCompetitorId = competitorObject?._id || row?.competitor;

        return {
          id: String(rowCompetitorId || ""),
          name: competitorObject?.name || "Unknown",
          imageUrl: normalizeUploadedAssetUrl(competitorObject?.imageUrl || ""),
          votesCount: Number(row?.votesCount || 0),
        };
      })
    : [];

  const totalVotes =
    typeof poll?.totalVotes === "number"
      ? poll.totalVotes
      : rows.reduce((sum, item) => sum + item.votesCount, 0);

  const sortedRows = [...rows].sort((a, b) => b.votesCount - a.votesCount);
  const selfIndex = sortedRows.findIndex((item) => String(item.id) === String(competitorId));
  const selfRow = selfIndex >= 0 ? sortedRows[selfIndex] : null;
  const leader = sortedRows[0] || null;
  const selfVotes = selfRow?.votesCount || 0;
  const selfPercentage =
    totalVotes <= 0 ? 0 : Number(((selfVotes / totalVotes) * 100).toFixed(2));

  const competitors = sortedRows.map((item) => ({
    ...item,
    percentage:
      totalVotes <= 0 ? 0 : Number(((item.votesCount / totalVotes) * 100).toFixed(2)),
  }));

  return {
    id: String(poll._id),
    title: poll.title,
    description: poll.description,
    imageUrl: normalizeUploadedAssetUrl(poll.imageUrl || ""),
    status: poll.status,
    phase: getPollPhase(poll, nowTs),
    startsAt: poll.startsAt,
    endsAt: poll.endsAt,
    totalVotes,
    selfVotes,
    selfPercentage,
    rank: selfIndex >= 0 ? selfIndex + 1 : null,
    totalCompetitors: competitors.length,
    leader: leader
      ? {
          id: leader.id,
          name: leader.name,
          imageUrl: leader.imageUrl,
          votesCount: leader.votesCount,
        }
      : null,
    competitors,
    isLeading: selfIndex === 0 && selfRow !== null,
  };
};

export const loginCompetitor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const parsedEmail = normalizeEmail(email);

    if (!parsedEmail || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    const competitor = await Competitor.findOne({ email: parsedEmail }).select("+password");
    if (!competitor) {
      return res.status(401).json({
        message: "invalid email or password",
      });
    }

    const isPasswordValid = await competitor.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "invalid email or password",
      });
    }

    startCompetitorSession(req, competitor);

    return res.status(200).json({
      message: "competitor login successful",
      competitor: formatCompetitor(competitor),
    });
  } catch (error) {
    return res.status(500).json({
      message: "competitor login failed",
      error: error.message,
    });
  }
};

export const logoutCompetitor = async (req, res) => {
  try {
    if (!req.session) {
      return res.status(200).json({
        message: "competitor logged out",
      });
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({
          message: "logout failed",
          error: error.message,
        });
      }

      return res.status(200).json({
        message: "competitor logged out",
      });
    });
  } catch (error) {
    return res.status(500).json({
      message: "logout failed",
      error: error.message,
    });
  }
};

export const getCurrentCompetitor = async (req, res) => {
  return res.status(200).json({
    competitor: formatCompetitor(req.authCompetitor),
  });
};

export const updateCurrentCompetitor = async (req, res) => {
  try {
    const competitor = req.authCompetitor;
    const parsedName = normalizeText(req.body?.name);
    const parsedEmail = normalizeEmail(req.body?.email);
    const parsedPhone = normalizeText(req.body?.phone);
    const parsedSex = normalizeText(req.body?.sex).toLowerCase();

    if (!parsedName || !parsedEmail || !parsedPhone || !parsedSex) {
      return res.status(400).json({
        message: "name, email, phone and sex are required",
      });
    }

    if (!COMPETITOR_SEX_VALUES.includes(parsedSex)) {
      return res.status(400).json({
        message: "invalid sex value",
        allowedSexValues: COMPETITOR_SEX_VALUES,
      });
    }

    const existing = await Competitor.findOne({
      email: parsedEmail,
      _id: { $ne: competitor._id },
    }).select("_id");

    if (existing) {
      return res.status(409).json({
        message: "email already exists",
      });
    }

    competitor.name = parsedName;
    competitor.email = parsedEmail;
    competitor.phone = parsedPhone;
    competitor.sex = parsedSex;

    const imageUrl = getUploadedImageUrl(req.file?.filename);
    if (imageUrl) {
      competitor.imageUrl = imageUrl;
    }

    await competitor.save();
    startCompetitorSession(req, competitor);

    return res.status(200).json({
      message: "competitor profile updated successfully",
      competitor: formatCompetitor(competitor),
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to update competitor profile",
      error: error.message,
    });
  }
};

export const changeCompetitorPassword = async (req, res) => {
  try {
    const competitor = await Competitor.findById(req.authCompetitor._id).select("+password");
    if (!competitor) {
      return res.status(404).json({ message: "competitor not found" });
    }

    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "currentPassword and newPassword are required",
      });
    }

    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `new password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const isMatch = await competitor.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "current password is invalid" });
    }

    competitor.password = newPassword;
    await competitor.save();

    return res.status(200).json({
      message: "password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to change password",
      error: error.message,
    });
  }
};

export const deleteCurrentCompetitor = async (req, res) => {
  try {
    const competitor = await Competitor.findById(req.authCompetitor._id);
    if (!competitor) {
      return res.status(404).json({ message: "competitor not found" });
    }

    await Competitor.deleteOne({ _id: competitor._id });

    if (!req.session) {
      return res.status(200).json({ message: "competitor account deleted successfully" });
    }

    req.session.destroy((error) => {
      if (error) {
        return res.status(200).json({
          message: "competitor account deleted successfully, but session clear failed",
        });
      }

      return res.status(200).json({ message: "competitor account deleted successfully" });
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to delete competitor account",
      error: error.message,
    });
  }
};

export const getCompetitorDashboard = async (req, res) => {
  try {
    const competitor = req.authCompetitor;
    const competitorId = competitor?._id;

    const polls = await Poll.find({
      isArchived: false,
      status: { $ne: POLL_STATUSES.DRAFT },
      "competitors.competitor": competitorId,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "competitors.competitor",
        select: "name imageUrl",
      });

    const nowTs = Date.now();
    const participations = polls.map((poll) => mapParticipation(poll, competitorId, nowTs));

    const summary = participations.reduce(
      (acc, item) => {
        acc.totalParticipations += 1;
        acc.totalVotesReceived += item.selfVotes;
        if (item.isLeading) {
          acc.leadingCount += 1;
        }
        if (item.phase === "ongoing") {
          acc.ongoing += 1;
        }
        if (item.phase === "upcoming") {
          acc.upcoming += 1;
        }
        if (item.phase === "ended") {
          acc.ended += 1;
        }
        return acc;
      },
      {
        totalParticipations: 0,
        totalVotesReceived: 0,
        leadingCount: 0,
        ongoing: 0,
        upcoming: 0,
        ended: 0,
      }
    );

    const chartData = participations.map((item) => ({
      pollId: item.id,
      pollTitle: item.title,
      votes: item.selfVotes,
      percentage: item.selfPercentage,
      phase: item.phase,
    }));

    return res.status(200).json({
      competitor: formatCompetitor(competitor),
      summary,
      chartData,
      participations,
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to load competitor dashboard",
      error: error.message,
    });
  }
};

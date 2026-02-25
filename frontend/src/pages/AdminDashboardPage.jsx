import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/env.js";
import {
  createCompetitor,
  createElection,
  fetchCompetitors,
  fetchElectionResults,
  fetchElections,
  updateElectionStatus,
} from "../api/electionApi.js";
import {
  fetchVoterRegistrations,
  updateVoterRegistrationStatus,
} from "../api/authApi.js";
import { clearSession, getSessionUser } from "../utils/session.js";

const STREAM_HOST = API_BASE_URL.replace(/\/api$/, "");

const toIsoOrNull = (dateTimeLocalValue) => {
  if (!dateTimeLocalValue) {
    return null;
  }

  return new Date(dateTimeLocalValue).toISOString();
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const toTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
};

const formatCountdown = (targetTs, nowTs = Date.now()) => {
  if (targetTs === null || targetTs === undefined) {
    return "-";
  }

  const diffMs = Math.max(0, targetTs - nowTs);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const electionPhase = (poll, nowTs) => {
  const startTs = toTimestamp(poll.startsAt);
  const endTs = toTimestamp(poll.endsAt);

  if (poll.status === "closed" || (endTs && nowTs > endTs)) {
    return "ended";
  }

  if (startTs && nowTs < startTs) {
    return "upcoming";
  }

  if (poll.status === "active") {
    return "ongoing";
  }

  return "upcoming";
};

const toChartData = (result) => {
  const competitors = Array.isArray(result?.competitors) ? result.competitors : [];
  return [...competitors]
    .map((item) => ({
      id: item.id,
      name: item.name || "Unknown",
      votesCount: Number(item.votesCount || 0),
      percentage: Number(item.percentage || 0),
    }))
    .sort((a, b) => b.votesCount - a.votesCount);
};

const formatVotes = (count) => `${count} vote${count === 1 ? "" : "s"}`;
const formatTickValue = (value) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
};

function AdminDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = getSessionUser();
  const userRole = sessionUser?.role || "";

  const [competitors, setCompetitors] = useState([]);
  const [polls, setPolls] = useState([]);
  const [resultsByPollId, setResultsByPollId] = useState({});
  const [livePollId, setLivePollId] = useState("");
  const [liveResults, setLiveResults] = useState(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [voterRegistrations, setVoterRegistrations] = useState([]);
  const [voterSummary, setVoterSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [voterFilter, setVoterFilter] = useState("pending");
  const [voterSearch, setVoterSearch] = useState("");
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);
  const [processingVoterId, setProcessingVoterId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isSavingCompetitor, setIsSavingCompetitor] = useState(false);
  const [isSavingElection, setIsSavingElection] = useState(false);

  const [competitorForm, setCompetitorForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    sex: "male",
    image: null,
  });

  const [electionForm, setElectionForm] = useState({
    title: "",
    description: "",
    status: "active",
    startsAt: "",
    endsAt: "",
    competitorIds: [],
    image: null,
  });

  const routeBySection = useMemo(
    () => ({
      dashboard: "/admin/dashboard",
      elections: "/admin/elections",
      candidates: "/admin/candidates",
      "live-results": "/admin/live-results",
      "final-results": "/admin/final-results",
      voters: "/admin/voters",
      profile: "/admin/profile",
    }),
    []
  );

  const sectionByRoute = useMemo(
    () =>
      Object.entries(routeBySection).reduce((acc, [section, route]) => {
        acc[route] = section;
        return acc;
      }, {}),
    [routeBySection]
  );

  const activeMenu = sectionByRoute[location.pathname] || "dashboard";

  const canCreateElection = useMemo(
    () => electionForm.competitorIds.length >= 2 && electionForm.title.trim().length > 0,
    [electionForm.competitorIds, electionForm.title]
  );

  const summary = useMemo(() => {
    const nowTs = Date.now();
    const totalVotes = polls.reduce((sum, poll) => sum + (poll.totalVotes || 0), 0);
    const phaseCount = {
      ongoing: 0,
      upcoming: 0,
      ended: 0,
    };

    for (const poll of polls) {
      phaseCount[electionPhase(poll, nowTs)] += 1;
    }

    return {
      totalVotes,
      totalCompetitors: competitors.length,
      totalElections: polls.length,
      ongoing: phaseCount.ongoing,
      upcoming: phaseCount.upcoming,
      ended: phaseCount.ended,
    };
  }, [competitors.length, polls]);

  const selectedLivePoll = useMemo(
    () => polls.find((poll) => poll.id === livePollId) || null,
    [livePollId, polls]
  );

  const selectedLivePhase = selectedLivePoll ? electionPhase(selectedLivePoll, nowTs) : "";
  const selectedLiveStartTs = toTimestamp(selectedLivePoll?.startsAt);
  const selectedLiveEndTs = toTimestamp(selectedLivePoll?.endsAt);
  const selectedLiveTimeLabel =
    selectedLivePhase === "ongoing"
      ? selectedLiveEndTs !== null
        ? `Ends in ${formatCountdown(selectedLiveEndTs, nowTs)}`
        : "No end time"
      : selectedLivePhase === "upcoming"
      ? selectedLiveStartTs !== null
        ? `Starts in ${formatCountdown(selectedLiveStartTs, nowTs)}`
        : "Upcoming"
      : "Election ended";

  useEffect(() => {
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userRole !== "admin") {
      navigate("/admin/login", { replace: true });
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setActionError("");

      try {
        const [competitorsResponse, electionsResponse] = await Promise.all([
          fetchCompetitors(),
          fetchElections(),
        ]);

        const nextCompetitors = competitorsResponse.competitors || [];
        const nextPolls = electionsResponse.polls || [];
        setCompetitors(nextCompetitors);
        setPolls(nextPolls);
        setLivePollId((prev) => prev || nextPolls[0]?.id || "");
      } catch (error) {
        setActionError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [navigate, userRole]);

  useEffect(() => {
    if (activeMenu !== "live-results" || !livePollId) {
      return;
    }

    const streamUrl = `${STREAM_HOST}/api/polls/${livePollId}/stream`;
    const source = new EventSource(streamUrl, { withCredentials: true });

    source.addEventListener("results", (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setLiveResults(parsed);
        setLiveUpdatedAt(parsed?.updatedAt || new Date().toISOString());
      } catch {
        // Ignore invalid payloads.
      }
    });

    source.onerror = () => {
      // Keep UI stable while stream reconnects.
    };

    return () => {
      source.close();
    };
  }, [activeMenu, livePollId]);

  const refreshData = async () => {
    const [competitorsResponse, electionsResponse] = await Promise.all([
      fetchCompetitors(),
      fetchElections(),
    ]);

    const nextCompetitors = competitorsResponse.competitors || [];
    const nextPolls = electionsResponse.polls || [];
    setCompetitors(nextCompetitors);
    setPolls(nextPolls);

    if (livePollId && nextPolls.some((poll) => poll.id === livePollId)) {
      return;
    }

    setLivePollId(nextPolls[0]?.id || "");
  };

  const loadVoterApprovals = async (overrides = {}) => {
    const nextStatus = overrides.status ?? voterFilter;
    const nextSearch = overrides.search ?? voterSearch;
    setIsLoadingVoters(true);

    try {
      const response = await fetchVoterRegistrations({
        status: nextStatus,
        search: nextSearch,
      });
      setVoterRegistrations(response.voters || []);
      setVoterSummary(
        response.summary || {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        }
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  useEffect(() => {
    if (activeMenu !== "voters") {
      return;
    }

    loadVoterApprovals();
  }, [activeMenu, voterFilter]);

  const handleLogout = () => {
    clearSession();
    navigate("/admin/login", { replace: true });
  };

  const navigateToSection = (sectionId) => {
    const targetRoute = routeBySection[sectionId] || routeBySection.dashboard;
    navigate(targetRoute);
  };

  const handleCompetitorChange = (event) => {
    const { name, value, files, type } = event.target;
    setCompetitorForm((prev) => ({
      ...prev,
      [name]: type === "file" ? files?.[0] || null : value,
    }));
  };

  const handleCreateCompetitor = async (event) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    setIsSavingCompetitor(true);

    try {
      await createCompetitor(competitorForm);
      setActionMessage("Competitor created successfully.");
      setCompetitorForm({ name: "", email: "", password: "", phone: "", sex: "male", image: null });
      await refreshData();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsSavingCompetitor(false);
    }
  };

  const handleElectionChange = (event) => {
    const { name, value, files, type } = event.target;
    setElectionForm((prev) => ({
      ...prev,
      [name]: type === "file" ? files?.[0] || null : value,
    }));
  };

  const handleToggleCompetitor = (competitorId) => {
    setElectionForm((prev) => {
      const exists = prev.competitorIds.includes(competitorId);
      const nextIds = exists
        ? prev.competitorIds.filter((id) => id !== competitorId)
        : [...prev.competitorIds, competitorId];

      return { ...prev, competitorIds: nextIds };
    });
  };

  const handleCreateElection = async (event) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    setIsSavingElection(true);

    try {
      await createElection({
        title: electionForm.title,
        description: electionForm.description,
        status: electionForm.status,
        startsAt: toIsoOrNull(electionForm.startsAt),
        endsAt: toIsoOrNull(electionForm.endsAt),
        competitorIds: electionForm.competitorIds,
        image: electionForm.image,
      });

      setActionMessage("Election created successfully.");
      setElectionForm({
        title: "",
        description: "",
        status: "active",
        startsAt: "",
        endsAt: "",
        competitorIds: [],
        image: null,
      });

      await refreshData();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsSavingElection(false);
    }
  };

  const handleCloseElection = async (pollId) => {
    setActionError("");
    setActionMessage("");

    try {
      await updateElectionStatus(pollId, "closed");
      setActionMessage("Election closed successfully.");
      await refreshData();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const handleLoadResults = async (pollId) => {
    setActionError("");

    try {
      const response = await fetchElectionResults(pollId);
      setResultsByPollId((prev) => ({ ...prev, [pollId]: response.results }));
    } catch (error) {
      setActionError(error.message);
    }
  };

  const handleSearchVoters = async (event) => {
    event.preventDefault();
    await loadVoterApprovals({ search: voterSearch });
  };

  const handleVoterApproval = async (voterId, status) => {
    setActionError("");
    setActionMessage("");
    setProcessingVoterId(voterId);

    try {
      const payload = {
        status,
        comment:
          status === "approved"
            ? "Approved by admin"
            : "Rejected by admin",
      };
      await updateVoterRegistrationStatus(voterId, payload);
      setActionMessage(
        status === "approved"
          ? "Voter approved successfully."
          : "Voter rejected successfully."
      );
      await loadVoterApprovals();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setProcessingVoterId("");
    }
  };

  const renderBarChart = (result) => {
    const data = toChartData(result);
    if (!data.length) {
      return <p className="text-sm text-slate-500">No result data yet.</p>;
    }

    const maxVotesRaw = Math.max(0, ...data.map((item) => item.votesCount));
    const scaleMax = Math.max(1, maxVotesRaw);
    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount }, (_, index) => {
      const ratio = (tickCount - 1 - index) / (tickCount - 1);
      const raw = scaleMax * ratio;
      return raw;
    });
    const plotMinWidth = Math.max(520, data.length * 140);
    const plotHeight = 360;

    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
            Real-time Vote Chart
          </p>
          <p className="text-xs text-slate-500">
            Updated: {liveUpdatedAt ? formatDateTime(liveUpdatedAt) : "waiting stream"}
          </p>
        </div>

        <div className="grid grid-cols-[60px_1fr] gap-3">
          <div className="relative border-r border-slate-300 pr-2" style={{ height: `${plotHeight}px` }}>
            <p className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              Votes
            </p>
            {yTicks.map((tick, index) => (
              <div
                className="absolute left-0 right-0 text-right text-[11px] text-slate-600"
                key={`${tick}-${index}`}
                style={{ top: `${(index / (yTicks.length - 1)) * 100}%`, transform: "translateY(-50%)" }}
              >
                {formatTickValue(tick)}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: `${plotMinWidth}px` }}>
              <div className="relative rounded-xl border-2 border-slate-700 bg-white" style={{ height: `${plotHeight}px` }}>
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-4">
                  {yTicks.map((tick, index) => (
                    <div className="border-t border-slate-300" key={`grid-${tick}-${index}`} />
                  ))}
                </div>

                <div className="absolute inset-x-6 bottom-10 top-4 flex items-end justify-around gap-6">
                  {data.map((item) => {
                    const barHeightPx =
                      item.votesCount === 0 ? 0 : Math.max(14, Math.round((item.votesCount / scaleMax) * (plotHeight - 90)));

                    return (
                      <div className="flex w-full max-w-24 flex-col items-center justify-end" key={item.id || item.name}>
                        <p className="mb-1 text-xs font-semibold text-slate-700">{item.votesCount}</p>
                        <div
                          className="w-16 rounded-t-sm bg-[#0B5B93] transition-all duration-500"
                          style={{ height: `${barHeightPx}px` }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="absolute inset-x-6 bottom-2 flex items-start justify-around gap-6">
                  {data.map((item) => (
                    <div className="w-full max-w-24 text-center" key={`label-${item.id || item.name}`}>
                      <p className="line-clamp-1 text-xs font-semibold text-slate-800">{item.name}</p>
                      <p className="text-[11px] text-slate-600">{item.percentage}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {data.map((item) => (
            <div className="flex items-center justify-between text-xs text-slate-700" key={`legend-${item.id || item.name}`}>
              <span>{item.name}</span>
              <span>
                {formatVotes(item.votesCount)} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const approvalStatusStyles = {
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <aside className="fixed left-6 top-4 hidden h-[calc(100vh-2rem)] w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel lg:flex lg:flex-col">
          <div className="rounded-2xl bg-gradient-to-br from-sky-800 to-blue-600 p-4 text-white">
            <p className="text-sm font-semibold">ElectionMS</p>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-100">Admin System</p>
          </div>
          <nav className="mt-4 space-y-2">
            {[
              ["dashboard", "Dashboard"],
              ["elections", "Elections"],
              ["candidates", "Candidates"],
              ["voters", "Voter Approvals"],
              ["live-results", "Live Results"],
              ["final-results", "Final Results"],
              ["profile", "Profile"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  activeMenu === id
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                type="button"
                onClick={() => navigateToSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            className="mt-auto rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </aside>

        <div className="min-w-0 space-y-6 lg:ml-80">
          <header className="rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Admin</p>
            <h1 className="font-heading text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeMenu === "dashboard" && "Overview and system summary."}
              {activeMenu === "candidates" && "Create and manage competitors."}
              {activeMenu === "elections" && "Create and manage elections."}
              {activeMenu === "voters" && "Approve or reject voter registration requests."}
              {activeMenu === "live-results" && "Watch live voting updates from stream."}
              {activeMenu === "final-results" && "Open final result and chart per election."}
              {activeMenu === "profile" && "Account details."}
            </p>
          </header>

          {actionError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {actionError}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {actionMessage}
            </p>
          ) : null}

          {activeMenu === "dashboard" ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                <p className="text-xs uppercase text-slate-500">Total Votes</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalVotes}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                <p className="text-xs uppercase text-slate-500">Total Competitors</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalCompetitors}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                <p className="text-xs uppercase text-slate-500">Total Elections</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalElections}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
                <p className="text-xs uppercase text-emerald-700">Ongoing</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{summary.ongoing}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-panel">
                <p className="text-xs uppercase text-amber-700">Upcoming</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{summary.upcoming}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-panel">
                <p className="text-xs uppercase text-rose-700">Ended</p>
                <p className="mt-1 text-2xl font-bold text-rose-900">{summary.ended}</p>
              </div>
            </section>
          ) : null}

          {activeMenu === "candidates" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Create Competitor</h2>
              <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateCompetitor}>
                <input className="rounded-xl border border-slate-300 px-3 py-2" name="name" placeholder="Full name" value={competitorForm.name} onChange={handleCompetitorChange} required />
                <input className="rounded-xl border border-slate-300 px-3 py-2" name="email" type="email" placeholder="Email" value={competitorForm.email} onChange={handleCompetitorChange} required />
                <input className="rounded-xl border border-slate-300 px-3 py-2" name="password" type="password" minLength={6} placeholder="Password" value={competitorForm.password} onChange={handleCompetitorChange} required />
                <input className="rounded-xl border border-slate-300 px-3 py-2" name="phone" placeholder="Phone" value={competitorForm.phone} onChange={handleCompetitorChange} required />
                <select className="rounded-xl border border-slate-300 px-3 py-2" name="sex" value={competitorForm.sex} onChange={handleCompetitorChange}>
                  <option value="male">male</option>
                  <option value="female">female</option>
                  <option value="other">other</option>
                </select>
                <label className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                  Competitor image
                  <input className="mt-1 block w-full text-xs" name="image" type="file" accept="image/*" onChange={handleCompetitorChange} />
                </label>
                <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60" type="submit" disabled={isSavingCompetitor}>
                  {isSavingCompetitor ? "Saving..." : "Create Competitor"}
                </button>
              </form>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {competitors.map((comp) => (
                  <article key={comp.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="mb-2 h-36 overflow-hidden rounded-lg bg-slate-200">
                      {comp.imageUrl ? (
                        <img className="h-full w-full object-cover" src={comp.imageUrl} alt={comp.name} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                      )}
                    </div>
                    <p className="font-semibold text-slate-900">{comp.name}</p>
                    <p>{comp.email}</p>
                    <p>{comp.phone} | {comp.sex}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeMenu === "elections" ? (
            <section className="space-y-4">
              <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" onSubmit={handleCreateElection}>
                <h2 className="font-heading text-xl font-semibold text-slate-900">Create Election</h2>
                <div className="mt-4 grid gap-3">
                  <input className="rounded-xl border border-slate-300 px-3 py-2" name="title" placeholder="Election title" value={electionForm.title} onChange={handleElectionChange} required />
                  <textarea className="rounded-xl border border-slate-300 px-3 py-2" name="description" placeholder="Description" value={electionForm.description} onChange={handleElectionChange} rows={3} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <select className="rounded-xl border border-slate-300 px-3 py-2" name="status" value={electionForm.status} onChange={handleElectionChange}>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="closed">closed</option>
                    </select>
                    <input className="rounded-xl border border-slate-300 px-3 py-2" name="startsAt" type="datetime-local" value={electionForm.startsAt} onChange={handleElectionChange} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2" name="endsAt" type="datetime-local" value={electionForm.endsAt} onChange={handleElectionChange} />
                  </div>
                  <label className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Election image
                    <input className="mt-1 block w-full text-xs" name="image" type="file" accept="image/*" onChange={handleElectionChange} />
                  </label>
                  <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
                    {(competitors || []).map((competitor) => (
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700" key={competitor.id}>
                        <input type="checkbox" checked={electionForm.competitorIds.includes(competitor.id)} onChange={() => handleToggleCompetitor(competitor.id)} />
                        <span>{competitor.name}</span>
                        <span className="text-xs text-slate-500">({competitor.email})</span>
                      </label>
                    ))}
                  </div>
                  <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" type="submit" disabled={isSavingElection || !canCreateElection}>
                    {isSavingElection ? "Creating..." : "Create Election"}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {polls.map((poll) => (
                  <article key={poll.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                    <div className="mb-3 h-44 overflow-hidden rounded-xl bg-slate-200">
                      {poll.imageUrl ? (
                        <img className="h-full w-full object-cover" src={poll.imageUrl} alt={poll.title} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">No election image</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{poll.title}</h3>
                        <p className="text-sm text-slate-600">{poll.description}</p>
                        <p className="text-xs text-slate-500">
                          {poll.status} | votes: {poll.totalVotes}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(poll.startsAt)} - {formatDateTime(poll.endsAt)}
                        </p>
                      </div>
                      {poll.status !== "closed" ? (
                        <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100" type="button" onClick={() => handleCloseElection(poll.id)}>
                          Close
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeMenu === "voters" ? (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                  <p className="text-xs uppercase text-slate-500">Total Voters</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{voterSummary.total}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-amber-700">Pending</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{voterSummary.pending}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-emerald-700">Approved</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{voterSummary.approved}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-rose-700">Rejected</p>
                  <p className="mt-1 text-2xl font-bold text-rose-900">{voterSummary.rejected}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ["pending", "Pending"],
                    ["approved", "Approved"],
                    ["rejected", "Rejected"],
                    ["all", "All"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                        voterFilter === value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                      type="button"
                      onClick={() => setVoterFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form className="mt-3 flex flex-wrap gap-2" onSubmit={handleSearchVoters}>
                  <input
                    className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search by name or email"
                    value={voterSearch}
                    onChange={(event) => setVoterSearch(event.target.value)}
                  />
                  <button
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                    type="submit"
                  >
                    Search
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                {isLoadingVoters ? (
                  <p className="text-sm text-slate-500">Loading voter requests...</p>
                ) : null}

                {!isLoadingVoters && voterRegistrations.length === 0 ? (
                  <p className="text-sm text-slate-500">No voter records found for this filter.</p>
                ) : null}

                <div className="space-y-3">
                  {voterRegistrations.map((voter) => (
                    <article
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      key={voter.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{voter.name}</h3>
                          <p className="text-sm text-slate-600">{voter.email}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Registered: {formatDateTime(voter.createdAt)}
                          </p>
                          {voter.approvalReviewedAt ? (
                            <p className="text-xs text-slate-500">
                              Reviewed: {formatDateTime(voter.approvalReviewedAt)}
                            </p>
                          ) : null}
                          {voter.approvalComment ? (
                            <p className="mt-1 text-xs text-slate-600">
                              Note: {voter.approvalComment}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                              approvalStatusStyles[voter.approvalStatus] || "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {voter.approvalStatus || "pending"}
                          </span>
                          <button
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            type="button"
                            disabled={processingVoterId === voter.id || voter.approvalStatus === "approved"}
                            onClick={() => handleVoterApproval(voter.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            type="button"
                            disabled={processingVoterId === voter.id || voter.approvalStatus === "rejected"}
                            onClick={() => handleVoterApproval(voter.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeMenu === "live-results" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Live Results</h2>
              <p className="mt-1 text-xs text-slate-500">Real-time stream from `/api/polls/:pollId/stream`.</p>
              <select className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={livePollId} onChange={(event) => { setLivePollId(event.target.value); setLiveResults(null); }}>
                <option value="">Select election</option>
                {polls.map((poll) => (
                  <option key={poll.id} value={poll.id}>
                    {poll.title}
                  </option>
                ))}
              </select>
              {selectedLivePoll ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p>
                    Status: <b className="capitalize">{selectedLivePhase || "-"}</b> | {selectedLiveTimeLabel}
                  </p>
                  <p>
                    Start: <b>{formatDateTime(selectedLivePoll.startsAt)}</b> | End:{" "}
                    <b>{formatDateTime(selectedLivePoll.endsAt)}</b>
                  </p>
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {liveResults ? renderBarChart(liveResults) : <p className="text-sm text-slate-500">Select election to stream live results.</p>}
              </div>
            </section>
          ) : null}

          {activeMenu === "final-results" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Final Results</h2>
              {isLoading ? <p className="mt-4 text-sm text-slate-500">Loading data...</p> : null}
              <div className="mt-4 space-y-4">
                {polls.map((poll) => (
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={poll.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{poll.title}</h3>
                        <p className="text-sm text-slate-600">{poll.description}</p>
                        <p className="mt-1 text-xs text-slate-500">Status: <b>{poll.status}</b> | Votes: <b>{poll.totalVotes}</b></p>
                      </div>
                      <button className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700" type="button" onClick={() => handleLoadResults(poll.id)}>
                        Final Result
                      </button>
                    </div>
                    {resultsByPollId[poll.id] ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-sm font-semibold text-slate-700">Bar Chart</p>
                        {renderBarChart(resultsByPollId[poll.id])}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeMenu === "profile" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Profile</h2>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p><b>Name:</b> {sessionUser?.name || "-"}</p>
                <p><b>Email:</b> {sessionUser?.email || "-"}</p>
                <p><b>Role:</b> {sessionUser?.role || "-"}</p>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default AdminDashboardPage;
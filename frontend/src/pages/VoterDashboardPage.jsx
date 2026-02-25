import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logoutVoter } from "../api/authApi.js";
import {
  fetchVoterElectionCompetitors,
  fetchVoterElectionResults,
  fetchVoterElections,
  voteForCompetitor,
} from "../api/electionApi.js";
import { API_BASE_URL } from "../config/env.js";
import { clearSession, getSessionUser } from "../utils/session.js";

const STREAM_HOST = API_BASE_URL.replace(/\/api$/, "");

const getTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const getElectionPhase = (poll, nowTs = Date.now()) => {
  if (!poll) {
    return "closed";
  }

  const startsAt = getTimestamp(poll.startsAt);
  const endsAt = getTimestamp(poll.endsAt);

  if (poll.status === "closed") {
    return "closed";
  }

  if (endsAt !== null && nowTs >= endsAt) {
    return "closed";
  }

  if (startsAt !== null && nowTs < startsAt) {
    return "upcoming";
  }

  if (poll.status === "active") {
    return "active";
  }

  return "upcoming";
};

const getVisiblePollsForVoter = (polls, nowTs = Date.now()) =>
  (Array.isArray(polls) ? polls : []).filter((poll) => getElectionPhase(poll, nowTs) !== "upcoming");

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

const updateRanking = (list) => [...list].sort((a, b) => b.rank - a.rank);

const compareTwo = (p1, p2) => {
  if (!p1 || !p2) {
    return "Need two competitors for comparison.";
  }

  if (p1.rank > p2.rank) {
    return `${p1.name} goes up. ${p2.name} goes down.`;
  }

  if (p1.rank < p2.rank) {
    return `${p2.name} goes up. ${p1.name} goes down.`;
  }

  return "Both have same rank.";
};

function VoterDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = getSessionUser();
  const userRole = sessionUser?.role || "";

  const [elections, setElections] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState("");
  const [selectedPollCompetitors, setSelectedPollCompetitors] = useState([]);
  const [selectedPollResults, setSelectedPollResults] = useState(null);
  const [liveResults, setLiveResults] = useState(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());

  const routeBySection = useMemo(
    () => ({
      dashboard: "/voter/dashboard",
      elections: "/voter/elections",
      "live-results": "/voter/live-results",
      "final-results": "/voter/final-results",
      profile: "/voter/profile",
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

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userRole !== "user") {
      navigate("/voter/login", { replace: true });
      return;
    }

    loadElections();
  }, [navigate, userRole]);

  useEffect(() => {
    if (activeMenu !== "live-results" || !selectedPollId) {
      return;
    }

    const streamUrl = `${STREAM_HOST}/api/polls/${selectedPollId}/stream`;
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
      // Keep screen stable while reconnecting.
    };

    return () => {
      source.close();
    };
  }, [activeMenu, selectedPollId]);

  const loadElections = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchVoterElections();
      const polls = response.polls || [];
      setElections(polls);
      const visiblePolls = getVisiblePollsForVoter(polls, Date.now());

      if (visiblePolls.length > 0) {
        const existingVisible = visiblePolls.some((poll) => poll.id === selectedPollId);
        const pollId = existingVisible ? selectedPollId : visiblePolls[0].id;
        await handleSelectElection(pollId, false);
      } else {
        setSelectedPollId("");
        setSelectedPollCompetitors([]);
        setSelectedPollResults(null);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectElection = async (pollId, clearMessages = true) => {
    if (!pollId) {
      return;
    }

    if (clearMessages) {
      setErrorMessage("");
      setStatusMessage("");
    }

    try {
      const response = await fetchVoterElectionCompetitors(pollId);
      setSelectedPollId(pollId);
      setSelectedPollCompetitors(response.competitors || []);
      setSelectedPollResults(null);
      setLiveResults(null);
      setLiveUpdatedAt(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleVote = async (competitorId) => {
    if (!selectedPollId) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsVoting(true);

    try {
      await voteForCompetitor(selectedPollId, competitorId);
      setStatusMessage("Vote submitted successfully.");
      await handleSelectElection(selectedPollId, false);
      await loadElections();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsVoting(false);
    }
  };

  const handleLoadResults = async () => {
    if (!selectedPollId) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await fetchVoterElectionResults(selectedPollId);
      setSelectedPollResults(response.results || null);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutVoter();
    } catch {
      // Keep local logout even if API logout fails.
    } finally {
      clearSession();
      navigate("/voter/login", { replace: true });
    }
  };

  const navigateToSection = (sectionId) => {
    const targetRoute = routeBySection[sectionId] || routeBySection.dashboard;
    navigate(targetRoute);
  };

  const electionsWithPhase = useMemo(
    () =>
      elections.map((poll) => ({
        ...poll,
        phase: getElectionPhase(poll, nowTs),
      })),
    [elections, nowTs]
  );

  const visibleElections = useMemo(
    () => electionsWithPhase.filter((poll) => poll.phase !== "upcoming"),
    [electionsWithPhase]
  );

  const nextUpcomingElection = useMemo(() => {
    const upcoming = electionsWithPhase
      .filter((poll) => poll.phase === "upcoming")
      .sort((a, b) => {
        const aStart = getTimestamp(a.startsAt) ?? Number.MAX_SAFE_INTEGER;
        const bStart = getTimestamp(b.startsAt) ?? Number.MAX_SAFE_INTEGER;
        return aStart - bStart;
      });

    return upcoming[0] || null;
  }, [electionsWithPhase]);

  const selectedElection = visibleElections.find((poll) => poll.id === selectedPollId) || null;
  const selectedElectionPhase = selectedElection ? getElectionPhase(selectedElection, nowTs) : "closed";
  const selectedElectionEndTs = getTimestamp(selectedElection?.endsAt);
  const selectedElectionStartTs = getTimestamp(selectedElection?.startsAt);
  const selectedElectionTimeLabel =
    selectedElectionPhase === "active"
      ? selectedElectionEndTs !== null
        ? `Ends in ${formatCountdown(selectedElectionEndTs, nowTs)}`
        : "No end time"
      : selectedElectionPhase === "closed"
      ? "Election closed"
      : selectedElectionStartTs !== null
      ? `Starts in ${formatCountdown(selectedElectionStartTs, nowTs)}`
      : "Upcoming";

  const hasVoted = selectedPollCompetitors.some((item) => item.isSelected);
  const voteClosed = !selectedElection || selectedElectionPhase !== "active";

  const liveRankingList = useMemo(() => {
    const source = liveResults?.competitors?.length ? liveResults.competitors : selectedPollCompetitors;

    const people = (source || []).map((competitor) => ({
      id: competitor.id,
      name: competitor.name,
      rank: competitor.votesCount || 0,
      votesCount: competitor.votesCount || 0,
      percentage: competitor.percentage || 0,
      isSelected: Boolean(competitor.isSelected),
    }));

    return updateRanking(people);
  }, [liveResults, selectedPollCompetitors]);

  const finalRankingList = useMemo(() => {
    const source = selectedPollResults?.competitors?.length
      ? selectedPollResults.competitors
      : selectedPollCompetitors;

    const people = (source || []).map((competitor) => ({
      id: competitor.id,
      name: competitor.name,
      rank: competitor.votesCount || 0,
      votesCount: competitor.votesCount || 0,
      percentage: competitor.percentage || 0,
      isSelected: Boolean(competitor.isSelected),
    }));

    return updateRanking(people);
  }, [selectedPollCompetitors, selectedPollResults]);

  const activeRankingList = activeMenu === "live-results" ? liveRankingList : finalRankingList;

  const topCompareMessage = useMemo(() => {
    if (activeRankingList.length < 2) {
      return "";
    }

    return compareTwo(activeRankingList[0], activeRankingList[1]);
  }, [activeRankingList]);

  const summary = useMemo(() => {
    const totalElections = electionsWithPhase.length;
    const ongoing = electionsWithPhase.filter((poll) => poll.phase === "active").length;
    const ended = electionsWithPhase.filter((poll) => poll.phase === "closed").length;
    const hiddenUpcoming = electionsWithPhase.filter((poll) => poll.phase === "upcoming").length;
    const voted = electionsWithPhase.filter((poll) =>
      (poll.competitors || []).some((competitor) => competitor.isSelected)
    ).length;

    return { totalElections, ongoing, ended, hiddenUpcoming, voted };
  }, [electionsWithPhase]);

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <aside className="fixed left-6 top-4 hidden h-[calc(100vh-2rem)] w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel lg:flex lg:flex-col">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-white">
            <p className="text-sm font-semibold">ElectionMS</p>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Voter Portal</p>
          </div>
          <nav className="mt-4 space-y-2">
            {[
              ["dashboard", "Dashboard"],
              ["elections", "Elections"],
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Voter</p>
            <h1 className="font-heading text-2xl font-semibold text-slate-900">Voter Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeMenu === "dashboard" && "Your voting activity and election overview."}
              {activeMenu === "elections" && "Select election and vote for one competitor."}
              {activeMenu === "live-results" && "Watch the latest vote totals update."}
              {activeMenu === "final-results" && "See final results for selected election."}
              {activeMenu === "profile" && "Your account information."}
            </p>
          </header>

          {statusMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {activeMenu === "dashboard" ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                <p className="text-xs uppercase text-slate-500">Total Elections</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalElections}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
                <p className="text-xs uppercase text-emerald-700">Ongoing</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{summary.ongoing}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-panel">
                <p className="text-xs uppercase text-rose-700">Ended</p>
                <p className="mt-1 text-2xl font-bold text-rose-900">{summary.ended}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-panel">
                <p className="text-xs uppercase text-blue-700">Voted Elections</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{summary.voted}</p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-200/60 p-4 shadow-panel">
                <p className="text-xs uppercase text-slate-700">Upcoming Hidden</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summary.hiddenUpcoming}</p>
              </div>
              {nextUpcomingElection ? (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 shadow-panel sm:col-span-2 xl:col-span-2">
                  <p className="text-xs uppercase text-cyan-700">Next Upcoming Election</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-900">{nextUpcomingElection.title}</p>
                  <p className="mt-1 text-xs text-cyan-700">
                    Starts in{" "}
                    {formatCountdown(getTimestamp(nextUpcomingElection.startsAt), nowTs)}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeMenu === "elections" ? (
            <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                <h2 className="font-heading text-lg font-semibold text-slate-900">Live Elections</h2>
                <div className="mt-3 space-y-2">
                  {visibleElections.map((poll) => (
                    <button
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        selectedPollId === poll.id
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                      key={poll.id}
                      type="button"
                      onClick={() => handleSelectElection(poll.id)}
                    >
                      {poll.imageUrl ? (
                        <img
                          className="mb-2 h-20 w-full rounded-md object-cover"
                          src={poll.imageUrl}
                          alt={poll.title}
                        />
                      ) : null}
                      <p className="font-semibold">{poll.title}</p>
                      <p className="text-xs capitalize">Status: {poll.phase}</p>
                    </button>
                  ))}
                </div>
                {visibleElections.length === 0 && !isLoading ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No election is open yet for voters.
                  </p>
                ) : null}
                {nextUpcomingElection ? (
                  <p className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                    Next open election: <b>{nextUpcomingElection.title}</b> in{" "}
                    {formatCountdown(getTimestamp(nextUpcomingElection.startsAt), nowTs)}
                  </p>
                ) : null}
              </aside>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                {isLoading ? (
                  <p className="text-sm text-slate-500">Loading elections...</p>
                ) : selectedElection ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {selectedElection.imageUrl ? (
                          <img
                            className="mb-3 h-44 w-full max-w-xl rounded-xl object-cover"
                            src={selectedElection.imageUrl}
                            alt={selectedElection.title}
                          />
                        ) : null}
                        <h2 className="font-heading text-2xl font-semibold text-slate-900">
                          {selectedElection.title}
                        </h2>
                        <p className="text-sm text-slate-600">{selectedElection.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Status: <b className="capitalize">{selectedElectionPhase}</b> | Votes:{" "}
                          <b>{selectedElection.totalVotes}</b>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{selectedElectionTimeLabel}</p>
                      </div>
                      <button
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                        type="button"
                        onClick={handleLoadResults}
                      >
                        View Results
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {(selectedPollCompetitors || []).map((competitor) => (
                        <article className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={competitor.id}>
                          <div className="mb-2 h-32 overflow-hidden rounded-lg bg-slate-200">
                            {competitor.imageUrl ? (
                              <img className="h-full w-full object-cover" src={competitor.imageUrl} alt={competitor.name} />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900">{competitor.name}</p>
                          <p className="text-xs text-slate-600">{competitor.email}</p>
                          <p className="text-xs text-slate-600">
                            {competitor.phone} | {competitor.sex}
                          </p>
                          <button
                            className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => handleVote(competitor.id)}
                            disabled={isVoting || voteClosed || hasVoted}
                          >
                            {competitor.isSelected
                              ? "Your Vote"
                              : voteClosed
                              ? "Closed"
                              : "Vote"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select an election to continue.</p>
                )}
              </section>
            </section>
          ) : null}

          {activeMenu === "live-results" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-xl font-semibold text-slate-900">Live Results View</h2>
                <button
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                  type="button"
                  onClick={() => handleSelectElection(selectedPollId, false)}
                  disabled={!selectedPollId}
                >
                  Refresh Results
                </button>
              </div>
              {selectedElection ? (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <p>
                    {selectedElection.title} | <b>{selectedElectionTimeLabel}</b>
                  </p>
                  <p className="text-xs">
                    Start: <b>{formatDateTime(selectedElection.startsAt)}</b> | End:{" "}
                    <b>{formatDateTime(selectedElection.endsAt)}</b>
                  </p>
                  <p className="text-xs text-slate-500">
                    Stream update: {liveUpdatedAt ? formatDateTime(liveUpdatedAt) : "waiting stream"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Open Elections page and select an active election first.
                </p>
              )}

              <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950 text-slate-100">
                <div className="border-b border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 via-cyan-400/10 to-transparent px-4 py-3">
                  <p className="text-sm font-semibold">Competitor Ranking (Live)</p>
                  <p className="text-xs text-slate-300">
                    Sorted by total votes. Higher votes means higher rank.
                  </p>
                  {topCompareMessage ? (
                    <p className="mt-1 text-xs text-emerald-200">{topCompareMessage}</p>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-300">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Competitor</th>
                        <th className="px-4 py-3">Total Votes</th>
                        <th className="px-4 py-3">Share</th>
                        <th className="px-4 py-3">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveRankingList.map((item, index) => {
                        const leadVotes = liveRankingList[0]?.votesCount ?? 0;
                        const gap = Math.max(0, leadVotes - item.votesCount);
                        return (
                          <tr
                            className="border-t border-emerald-300/10 text-slate-200"
                            key={item.id || item.name}
                          >
                            <td className="px-4 py-3 font-semibold">{index + 1}</td>
                            <td className="px-4 py-3">
                              {item.name}
                              {item.isSelected ? (
                                <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200">
                                  Your Vote
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-semibold">{item.votesCount}</td>
                            <td className="px-4 py-3">{item.percentage}%</td>
                            <td className="px-4 py-3 text-xs text-slate-300">
                              {index === 0 ? "Leader" : `${gap} votes behind`}
                            </td>
                          </tr>
                        );
                      })}
                      {!liveRankingList.length ? (
                        <tr>
                          <td className="px-4 py-5 text-sm text-slate-400" colSpan={5}>
                            No competitor data available for selected election.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {activeMenu === "final-results" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Final Results</h2>
              <p className="mt-2 text-sm text-slate-600">
                Select election in Elections page then click "View Results".
              </p>
              {selectedPollResults ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950 text-slate-100">
                  <div className="border-b border-emerald-400/20 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-transparent px-4 py-3">
                    <p className="text-sm font-semibold">Final Competitor Ranking</p>
                    {topCompareMessage ? (
                      <p className="text-xs text-emerald-200">{topCompareMessage}</p>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-300">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Competitor</th>
                          <th className="px-4 py-3">Total Votes</th>
                          <th className="px-4 py-3">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalRankingList.map((item, index) => (
                          <tr
                            className="border-t border-emerald-300/10 text-slate-200"
                            key={item.id || item.name}
                          >
                            <td className="px-4 py-3 font-semibold">{index + 1}</td>
                            <td className="px-4 py-3">{item.name}</td>
                            <td className="px-4 py-3 font-semibold">{item.votesCount}</td>
                            <td className="px-4 py-3">{item.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Go to Elections page, pick election, and click "View Results" first.
                </p>
              )}
            </section>
          ) : null}

          {activeMenu === "profile" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Profile</h2>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
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

export default VoterDashboardPage;
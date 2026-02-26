import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  changeCurrentVoterPassword,
  deleteCurrentVoterAccount,
  logoutVoter,
  updateCurrentVoterProfile,
} from "../api/authApi.js";
import {
  fetchVoterElectionCompetitors,
  fetchVoterElectionResults,
  fetchVoterElections,
  voteForCompetitor,
} from "../api/electionApi.js";
import SimpleVotesBarChart from "../components/SimpleVotesBarChart.jsx";
import SimpleVotePieChart from "../components/SimpleVotePieChart.jsx";
import { API_BASE_URL } from "../config/env.js";
import { clearSession, getSessionUser, saveSession } from "../utils/session.js";

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

const toBarChartData = (rankingList) =>
  (Array.isArray(rankingList) ? rankingList : []).map((item, index) => ({
    id: item.id || `${item.name}-${index}`,
    label: item.name || "Unknown",
    value: Number(item.votesCount || 0),
  }));

const LiveStatIcon = ({ type }) => {
  const common = "h-5 w-5";

  if (type === "votes") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 16v-4m4.5 4V8m4.5 8v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "time") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 3.5h8M8 20.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 3.5v4l3 3-3 3v7M15 3.5v4l-3 3 3 3v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 19a8 8 0 0 1 16 0v1H4v-1z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
};

function VoterDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = getSessionUser();
  const userRole = sessionUser?.role || "";

  const [elections, setElections] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState("");
  const [finalPollId, setFinalPollId] = useState("");
  const [selectedPollCompetitors, setSelectedPollCompetitors] = useState([]);
  const [selectedPollResults, setSelectedPollResults] = useState(null);
  const [liveResults, setLiveResults] = useState(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFinalResults, setIsLoadingFinalResults] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [electionSearch, setElectionSearch] = useState("");
  const [competitorSearch, setCompetitorSearch] = useState("");
  const [competitorViewMode, setCompetitorViewMode] = useState("cards");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: sessionUser?.name || "",
    email: sessionUser?.email || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return undefined;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isMobileSidebarOpen]);

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

  useEffect(() => {
    setProfileForm({
      name: sessionUser?.name || "",
      email: sessionUser?.email || "",
    });
  }, [sessionUser?.email, sessionUser?.name]);

  const loadElections = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchVoterElections();
      const polls = response.polls || [];
      setElections(polls);
      const visiblePolls = getVisiblePollsForVoter(polls, Date.now());
      const closedPolls = visiblePolls.filter((poll) => getElectionPhase(poll, Date.now()) === "closed");

      if (visiblePolls.length > 0) {
        const existingVisible = visiblePolls.some((poll) => poll.id === selectedPollId);
        const pollId = existingVisible ? selectedPollId : visiblePolls[0].id;
        await handleSelectElection(pollId, false);
      } else {
        setSelectedPollId("");
        setSelectedPollCompetitors([]);
        setSelectedPollResults(null);
      }

      setFinalPollId((prev) => {
        if (prev && closedPolls.some((poll) => poll.id === prev)) {
          return prev;
        }
        return closedPolls[0]?.id || "";
      });
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
      setCompetitorSearch("");
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

  const handleLoadResults = async (pollId = selectedPollId, showLoading = false) => {
    if (!pollId) {
      return;
    }

    setErrorMessage("");
    if (showLoading) {
      setIsLoadingFinalResults(true);
    }

    try {
      const response = await fetchVoterElectionResults(pollId);
      setSelectedPollResults(response.results || null);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      if (showLoading) {
        setIsLoadingFinalResults(false);
      }
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

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSavingProfile(true);

    try {
      const response = await updateCurrentVoterProfile(profileForm);
      if (response?.voter) {
        saveSession(response.voter);
        setProfileForm({
          name: response.voter.name || "",
          email: response.voter.email || "",
        });
      }
      setStatusMessage(response?.message || "Profile updated successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsChangingPassword(true);

    try {
      const response = await changeCurrentVoterPassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setStatusMessage(response?.message || "Password changed successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your voter account permanently? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsDeletingAccount(true);

    try {
      await deleteCurrentVoterAccount();
      clearSession();
      navigate("/voter/login", { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsDeletingAccount(false);
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

  const filteredVisibleElections = useMemo(() => {
    const query = electionSearch.trim().toLowerCase();
    if (!query) {
      return visibleElections;
    }

    return visibleElections.filter((poll) => {
      const title = String(poll?.title || "").toLowerCase();
      const description = String(poll?.description || "").toLowerCase();
      const phase = String(poll?.phase || "").toLowerCase();
      return title.includes(query) || description.includes(query) || phase.includes(query);
    });
  }, [electionSearch, visibleElections]);

  const closedElections = useMemo(
    () => electionsWithPhase.filter((poll) => poll.phase === "closed"),
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
  const selectedFinalElection = closedElections.find((poll) => poll.id === finalPollId) || null;
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
  const filteredSelectedCompetitors = useMemo(() => {
    const query = competitorSearch.trim().toLowerCase();
    if (!query) {
      return selectedPollCompetitors;
    }

    return selectedPollCompetitors.filter((competitor) => {
      const name = String(competitor?.name || "").toLowerCase();
      const email = String(competitor?.email || "").toLowerCase();
      const phone = String(competitor?.phone || "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [competitorSearch, selectedPollCompetitors]);

  const sortedSelectedCompetitors = useMemo(
    () =>
      [...filteredSelectedCompetitors].sort((a, b) => {
        const votesA = Number(a?.votesCount || 0);
        const votesB = Number(b?.votesCount || 0);
        if (votesB !== votesA) {
          return votesB - votesA;
        }

        const percentA = Number(a?.percentage || 0);
        const percentB = Number(b?.percentage || 0);
        if (percentB !== percentA) {
          return percentB - percentA;
        }

        return String(a?.name || "").localeCompare(String(b?.name || ""));
      }),
    [filteredSelectedCompetitors]
  );

  const selectedElectionVotes = Number(selectedElection?.totalVotes || 0);
  const voteStatusLabel = hasVoted ? "Submitted" : voteClosed ? "Closed" : "Pending";

  useEffect(() => {
    if (activeMenu !== "final-results" || !finalPollId) {
      return;
    }

    handleLoadResults(finalPollId, true);
  }, [activeMenu, finalPollId]);

  useEffect(() => {
    if (!finalPollId) {
      setSelectedPollResults(null);
    }
  }, [finalPollId]);

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
      : selectedFinalElection?.competitors || [];

    const people = (source || []).map((competitor) => ({
      id: competitor.id,
      name: competitor.name,
      rank: competitor.votesCount || 0,
      votesCount: competitor.votesCount || 0,
      percentage: competitor.percentage || 0,
      isSelected: Boolean(competitor.isSelected),
    }));

    return updateRanking(people);
  }, [selectedFinalElection, selectedPollResults]);

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

  const dashboardVotesChartData = useMemo(
    () =>
      [...visibleElections]
        .map((poll) => ({
          id: poll.id,
          label: poll.title || "Untitled",
          value: Number(poll.totalVotes || 0),
        }))
        .sort((a, b) => b.value - a.value),
    [visibleElections]
  );

  const liveVotesCast = useMemo(
    () => liveRankingList.reduce((sum, item) => sum + Number(item.votesCount || 0), 0),
    [liveRankingList]
  );

  const liveTotalVoters = Math.max(liveVotesCast, Number(selectedElection?.totalVotes || 0));
  const liveRemainingVoters = Math.max(0, liveTotalVoters - liveVotesCast);
  const liveTimeValue = selectedElection
    ? selectedElectionPhase === "closed"
      ? "Completed"
      : selectedElectionTimeLabel
    : "-";
  const livePieData = useMemo(
    () =>
      liveRankingList.map((item) => ({
        id: item.id,
        label: item.name,
        value: Number(item.votesCount || 0),
      })),
    [liveRankingList]
  );

  const finalTotalVotes = Number(selectedPollResults?.totalVotes || selectedFinalElection?.totalVotes || 0);
  const finalTotalCandidates = finalRankingList.length;
  const finalWinner = finalRankingList[0] || null;
  const finalPieData = useMemo(
    () =>
      finalRankingList.map((item) => ({
        id: item.id,
        label: item.name,
        value: Number(item.votesCount || 0),
      })),
    [finalRankingList]
  );

  return (
    <main className="ems-dashboard min-h-screen">
      <div className="w-full">
        <aside className="ems-sidebar fixed inset-y-0 left-0 z-30 hidden w-[268px] rounded-none p-4 lg:flex lg:flex-col">
          <div className="ems-brand rounded-2xl p-4">
            <p className="ems-brand-title text-sm font-semibold">ElectionMS</p>
            <p className="ems-brand-subtitle text-xs uppercase tracking-[0.2em]">Voter Portal</p>
          </div>
          <nav className="mt-4 space-y-2">
            <p className="ems-nav-group">Main Menu</p>
            <button
              className={`ems-nav-btn ${activeMenu === "dashboard" ? "is-active" : ""}`}
              type="button"
              onClick={() => navigateToSection("dashboard")}
            >
              Dashboard
            </button>

            <p className="ems-nav-group">Apps</p>
            <button
              className={`ems-nav-btn ${activeMenu === "elections" ? "is-active" : ""}`}
              type="button"
              onClick={() => navigateToSection("elections")}
            >
              Elections
            </button>

            <p className="ems-nav-group">Charts</p>
            {[
              ["live-results", "Live Results"],
              ["final-results", "Final Results"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`ems-nav-btn ${activeMenu === id ? "is-active" : ""}`}
                type="button"
                onClick={() => navigateToSection(id)}
              >
                {label}
              </button>
            ))}

            <p className="ems-nav-group">Account</p>
            <button
              className={`ems-nav-btn ${activeMenu === "profile" ? "is-active" : ""}`}
              type="button"
              onClick={() => navigateToSection("profile")}
            >
              Profile
            </button>
          </nav>
          <button
            className="ems-logout-btn mt-auto"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </aside>

        <div className="lg:hidden">
          <button
            className="ems-mobile-trigger"
            type="button"
            aria-label="Open menu"
            onClick={() => setIsMobileSidebarOpen(true)}
          >
            Menu
          </button>
          <div
            className={`ems-mobile-backdrop ${isMobileSidebarOpen ? "is-open" : ""}`}
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className={`ems-mobile-drawer ${isMobileSidebarOpen ? "is-open" : ""}`}>
            <div className="ems-mobile-drawer-head">
              <div>
                <p className="ems-mobile-drawer-title">ElectionMS</p>
                <p className="ems-mobile-drawer-subtitle">Voter System</p>
              </div>
              <button
                className="ems-mobile-drawer-close"
                type="button"
                aria-label="Close menu"
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                x
              </button>
            </div>

            <p className="ems-mobile-drawer-group">Main Menu</p>
            <div className="ems-mobile-drawer-nav">
              {[
                ["dashboard", "Dashboard"],
                ["elections", "My Elections"],
                ["live-results", "Live Results"],
                ["final-results", "Final Results"],
                ["profile", "Profile"],
              ].map(([id, label]) => (
                <button
                  className={`ems-mobile-drawer-btn ${activeMenu === id ? "is-active" : ""}`}
                  key={id}
                  type="button"
                  onClick={() => {
                    navigateToSection(id);
                    setIsMobileSidebarOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              className="ems-mobile-drawer-logout"
              type="button"
              onClick={() => {
                setIsMobileSidebarOpen(false);
                handleLogout();
              }}
            >
              Logout
            </button>
          </aside>
        </div>

        <div className="min-w-0 space-y-6 px-3 pb-6 sm:px-6 lg:ml-[268px] lg:pl-6">
          <header className="sticky top-0 z-20 border border-slate-200 bg-white px-5 py-4 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">Voter</p>
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
            <>
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

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <SimpleVotesBarChart
                  title="Votes per Election"
                  caption="Visible elections only"
                  data={dashboardVotesChartData}
                />
              </section>
            </>
          ) : null}

          {activeMenu === "elections" ? (
            <section className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Visible Elections</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{visibleElections.length}</p>
                </article>
                <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-indigo-700">Selected Candidates</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-900">{selectedPollCompetitors.length}</p>
                </article>
                <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-blue-700">Election Votes</p>
                  <p className="mt-1 text-2xl font-bold text-blue-900">{selectedElectionVotes}</p>
                </article>
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Your Vote Status</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{voteStatusLabel}</p>
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-[340px_1fr]">
                <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading text-xl font-semibold text-slate-900">Election Browser</h2>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {filteredVisibleElections.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Upcoming elections stay hidden until start time.
                  </p>

                  <input
                    className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search elections..."
                    value={electionSearch}
                    onChange={(event) => setElectionSearch(event.target.value)}
                  />

                  <div className="mt-3 max-h-[540px] space-y-2 overflow-auto pr-1">
                    {filteredVisibleElections.map((poll) => {
                      const isSelected = selectedPollId === poll.id;
                      const phase = poll.phase || "closed";
                      const phaseStyle =
                        phase === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600";
                      const timeLabel =
                        phase === "active"
                          ? `Ends in ${formatCountdown(getTimestamp(poll.endsAt), nowTs)}`
                          : "Election closed";

                      return (
                        <button
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                          }`}
                          key={poll.id}
                          type="button"
                          onClick={() => handleSelectElection(poll.id)}
                        >
                          <div className="flex gap-3">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                              {poll.imageUrl ? (
                                <img className="h-full w-full object-cover" src={poll.imageUrl} alt={poll.title} />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{poll.title}</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${phaseStyle}`}>
                                  {phase}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-1 text-xs text-slate-500">{poll.description || "No description"}</p>
                              <p className="mt-1 text-[11px] text-slate-600">{timeLabel}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {filteredVisibleElections.length === 0 && !isLoading ? (
                    <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      No elections found for this search.
                    </p>
                  ) : null}

                  {nextUpcomingElection ? (
                    <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-cyan-700">Next Upcoming</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-900">{nextUpcomingElection.title}</p>
                      <p className="text-xs text-cyan-700">
                        Starts in {formatCountdown(getTimestamp(nextUpcomingElection.startsAt), nowTs)}
                      </p>
                    </div>
                  ) : null}
                </aside>

                <section className="space-y-4">
                  {isLoading ? (
                    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-panel">
                      Loading elections...
                    </p>
                  ) : selectedElection ? (
                    <>
                      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel">
                        <div className="relative">
                          {selectedElection.imageUrl ? (
                            <img
                              className="h-48 w-full object-cover sm:h-56"
                              src={selectedElection.imageUrl}
                              alt={selectedElection.title}
                            />
                          ) : (
                            <div className="h-48 w-full bg-gradient-to-r from-slate-800 to-blue-700 sm:h-56" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/25 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="rounded-full border border-white/30 bg-black/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                                {selectedElectionPhase}
                              </span>
                              <span className="text-xs">{selectedElectionTimeLabel}</span>
                            </div>
                            <h2 className="mt-2 text-2xl font-bold">{selectedElection.title}</h2>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-100">
                              {selectedElection.description || "Election details will appear here."}
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs uppercase text-slate-500">Candidates</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">
                              {selectedPollCompetitors.length}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs uppercase text-slate-500">Votes Cast</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{selectedElectionVotes}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs uppercase text-slate-500">Your Status</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{voteStatusLabel}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs uppercase text-slate-500">Schedule</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">
                              {formatDateTime(selectedElection.startsAt)} - {formatDateTime(selectedElection.endsAt)}
                            </p>
                          </div>
                        </div>
                      </article>

                      <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-heading text-xl font-semibold text-slate-900">Candidate List</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              className="w-full min-w-[220px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-auto"
                              placeholder="Search candidates..."
                              value={competitorSearch}
                              onChange={(event) => setCompetitorSearch(event.target.value)}
                            />
                            <div className="inline-flex rounded-xl border border-slate-300 bg-slate-50 p-1">
                              <button
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                  competitorViewMode === "cards"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-700"
                                }`}
                                type="button"
                                onClick={() => setCompetitorViewMode("cards")}
                              >
                                Cards
                              </button>
                              <button
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                  competitorViewMode === "table"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-700"
                                }`}
                                type="button"
                                onClick={() => setCompetitorViewMode("table")}
                              >
                                Table
                              </button>
                            </div>
                            <button
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                              type="button"
                              onClick={() => navigateToSection("live-results")}
                            >
                              Live Results
                            </button>
                          </div>
                        </div>

                        {sortedSelectedCompetitors.length === 0 ? (
                          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            No candidates found for this search.
                          </p>
                        ) : null}

                        {sortedSelectedCompetitors.length > 0 && competitorViewMode === "cards" ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {sortedSelectedCompetitors.map((competitor) => {
                              const votes = Number(competitor.votesCount || 0);
                              const share = selectedElectionVotes > 0
                                ? Math.round((votes / selectedElectionVotes) * 100)
                                : Number(competitor.percentage || 0);
                              const buttonLabel = competitor.isSelected
                                ? "Your Vote"
                                : hasVoted
                                ? "Voted"
                                : voteClosed
                                ? "Closed"
                                : "Vote Now";

                              return (
                                <article
                                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                                  key={competitor.id}
                                >
                                  <div className="h-36 w-full bg-slate-200">
                                    {competitor.imageUrl ? (
                                      <img
                                        className="h-full w-full object-cover"
                                        src={competitor.imageUrl}
                                        alt={competitor.name}
                                      />
                                    ) : null}
                                  </div>
                                  <div className="p-4">
                                    <p className="text-lg font-semibold text-slate-900">{competitor.name}</p>
                                    <p className="mt-1 text-xs text-slate-600">{competitor.email || "-"}</p>
                                    <p className="text-xs text-slate-600">{competitor.phone || "-"} | {competitor.sex || "-"}</p>

                                    <div className="mt-3">
                                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                                        <span>{votes} votes</span>
                                        <span>{share}%</span>
                                      </div>
                                      <div className="h-2 rounded-full bg-slate-200">
                                        <div
                                          className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                                          style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                                        />
                                      </div>
                                    </div>

                                    <button
                                      className={`mt-4 w-full rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                                        competitor.isSelected
                                          ? "bg-emerald-600"
                                          : "bg-emerald-600 hover:bg-emerald-700"
                                      }`}
                                      type="button"
                                      onClick={() => handleVote(competitor.id)}
                                      disabled={isVoting || voteClosed || hasVoted}
                                    >
                                      {buttonLabel}
                                    </button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : null}

                        {sortedSelectedCompetitors.length > 0 && competitorViewMode === "table" ? (
                          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                                <tr>
                                  <th className="px-4 py-3">Candidate</th>
                                  <th className="px-4 py-3">Votes</th>
                                  <th className="px-4 py-3">Share</th>
                                  <th className="px-4 py-3">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedSelectedCompetitors.map((competitor) => {
                                  const votes = Number(competitor.votesCount || 0);
                                  const share = selectedElectionVotes > 0
                                    ? Math.round((votes / selectedElectionVotes) * 100)
                                    : Number(competitor.percentage || 0);
                                  const buttonLabel = competitor.isSelected
                                    ? "Your Vote"
                                    : hasVoted
                                    ? "Voted"
                                    : voteClosed
                                    ? "Closed"
                                    : "Vote";

                                  return (
                                    <tr className="border-t border-slate-200 bg-white" key={`row-${competitor.id}`}>
                                      <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{competitor.name}</p>
                                        <p className="text-xs text-slate-500">{competitor.email || "-"}</p>
                                      </td>
                                      <td className="px-4 py-3 font-semibold text-slate-700">{votes}</td>
                                      <td className="px-4 py-3 text-slate-700">{share}%</td>
                                      <td className="px-4 py-3">
                                        <button
                                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                                            competitor.isSelected
                                              ? "bg-emerald-600"
                                              : "bg-emerald-600 hover:bg-emerald-700"
                                          }`}
                                          type="button"
                                          onClick={() => handleVote(competitor.id)}
                                          disabled={isVoting || voteClosed || hasVoted}
                                        >
                                          {buttonLabel}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </article>
                    </>
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-panel">
                      Select an election to continue.
                    </p>
                  )}
                </section>
              </section>
            </section>
          ) : null}

          {activeMenu === "live-results" ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="text-5xl font-bold tracking-tight text-slate-900">Live Results</h2>

              <select
                className="w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={selectedPollId}
                onChange={(event) => handleSelectElection(event.target.value, false)}
              >
                <option value="">Select election</option>
                {visibleElections.map((poll) => (
                  <option key={poll.id} value={poll.id}>
                    {poll.title}
                  </option>
                ))}
              </select>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { id: "total", label: "Total Voters", value: liveTotalVoters, icon: "voters" },
                  { id: "cast", label: "Votes Cast", value: liveVotesCast, icon: "votes" },
                  { id: "remaining", label: "Remaining Voters", value: liveRemainingVoters, icon: "voters" },
                  { id: "time", label: "Time Remaining", value: liveTimeValue, icon: "time" },
                ].map((card) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel" key={card.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl text-slate-500">{card.label}</p>
                        <p className="mt-2 text-4xl font-bold text-black">{card.value}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <LiveStatIcon type={card.icon} />
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <SimpleVotePieChart title="Vote Distribution" data={livePieData} />
                <SimpleVotesBarChart
                  title="Votes per Candidate"
                  caption={`Updated: ${liveUpdatedAt ? formatDateTime(liveUpdatedAt) : "waiting stream"}`}
                  data={toBarChartData(liveRankingList)}
                  height={300}
                />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-3xl font-bold text-slate-900">Candidate Ranking</h3>
                {selectedElection ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedElection.title} | Start: {formatDateTime(selectedElection.startsAt)} | End:{" "}
                    {formatDateTime(selectedElection.endsAt)}
                  </p>
                ) : null}
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Candidate</th>
                        <th className="px-4 py-3">Votes</th>
                        <th className="px-4 py-3">Share</th>
                        <th className="px-4 py-3">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveRankingList.map((item, index) => {
                        const leadVotes = liveRankingList[0]?.votesCount ?? 0;
                        const gap = Math.max(0, leadVotes - item.votesCount);
                        return (
                          <tr className="border-t border-slate-200" key={item.id || item.name}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                            <td className="px-4 py-3 text-slate-800">
                              {item.name}
                              {item.isSelected ? (
                                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                  Your Vote
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{item.votesCount}</td>
                            <td className="px-4 py-3 text-slate-700">{item.percentage}%</td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {index === 0 ? "Leader" : `${gap} votes behind`}
                            </td>
                          </tr>
                        );
                      })}
                      {!liveRankingList.length ? (
                        <tr>
                          <td className="px-4 py-5 text-sm text-slate-500" colSpan={5}>
                            Select election to view live ranking.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {topCompareMessage ? (
                  <p className="mt-3 text-sm text-emerald-700">{topCompareMessage}</p>
                ) : null}
              </section>
            </section>
          ) : null}

          {activeMenu === "final-results" ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="text-5xl font-bold tracking-tight text-slate-900">Final Results</h2>

              <select
                className="w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={finalPollId}
                onChange={(event) => setFinalPollId(event.target.value)}
              >
                <option value="">Select closed election</option>
                {closedElections.map((poll) => (
                  <option key={poll.id} value={poll.id}>
                    {poll.title}
                  </option>
                ))}
              </select>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { id: "votes", label: "Total Votes", value: finalTotalVotes, icon: "votes" },
                  { id: "candidates", label: "Total Candidates", value: finalTotalCandidates, icon: "voters" },
                  { id: "winner", label: "Winner", value: finalWinner?.name || "-", icon: "voters" },
                  { id: "status", label: "Election Status", value: "Completed", icon: "time" },
                ].map((card) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel" key={card.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl text-slate-500">{card.label}</p>
                        <p className="mt-2 text-3xl font-bold text-black">{card.value}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <LiveStatIcon type={card.icon} />
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              {isLoadingFinalResults ? (
                <p className="text-sm text-slate-500">Loading final results...</p>
              ) : null}

              {!isLoadingFinalResults && finalRankingList.length > 0 ? (
                <>
                  <section className="grid gap-4 xl:grid-cols-2">
                    <SimpleVotePieChart title="Vote Distribution" data={finalPieData} />
                    <SimpleVotesBarChart
                      title="Votes per Candidate"
                      caption="Final result"
                      data={toBarChartData(finalRankingList)}
                      height={300}
                    />
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-3xl font-bold text-slate-900">Final Candidate Ranking</h3>
                    {selectedFinalElection ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedFinalElection.title} | Start: {formatDateTime(selectedFinalElection.startsAt)} | End:{" "}
                        {formatDateTime(selectedFinalElection.endsAt)}
                      </p>
                    ) : null}
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                          <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Candidate</th>
                            <th className="px-4 py-3">Total Votes</th>
                            <th className="px-4 py-3">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finalRankingList.map((item, index) => (
                            <tr className="border-t border-slate-200" key={item.id || item.name}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                              <td className="px-4 py-3 text-slate-800">
                                {item.name}
                                {item.isSelected ? (
                                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                    Your Vote
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{item.votesCount}</td>
                              <td className="px-4 py-3 text-slate-700">{item.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {topCompareMessage ? (
                      <p className="mt-3 text-sm text-emerald-700">{topCompareMessage}</p>
                    ) : null}
                  </section>
                </>
              ) : null}

              {!isLoadingFinalResults && finalPollId && finalRankingList.length === 0 ? (
                <p className="text-sm text-slate-500">No final result data found for this election.</p>
              ) : null}

              {!isLoadingFinalResults && !finalPollId ? (
                <p className="text-sm text-slate-500">Select a closed election to view final results.</p>
              ) : null}
            </section>
          ) : null}

          {activeMenu === "profile" ? (
            <section className="space-y-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h2 className="font-heading text-xl font-semibold text-slate-900">Profile Settings</h2>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleSaveProfile}>
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    name="name"
                    placeholder="Full name"
                    value={profileForm.name}
                    onChange={handleProfileInputChange}
                    required
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    name="email"
                    type="email"
                    placeholder="Email"
                    value={profileForm.email}
                    onChange={handleProfileInputChange}
                    required
                  />
                  <button
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 md:col-span-2"
                    type="submit"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </form>
                <div className="mt-3 text-xs text-slate-600">
                  <p><b>Role:</b> {sessionUser?.role || "-"}</p>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleChangePassword}>
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    name="currentPassword"
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                    required
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    name="newPassword"
                    type="password"
                    placeholder="New password"
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    required
                  />
                  <button
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 md:col-span-2"
                    type="submit"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </article>

              <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-panel">
                <h3 className="text-base font-semibold text-rose-800">Danger Zone</h3>
                <p className="mt-1 text-sm text-rose-700">
                  Delete your voter account permanently. This action cannot be undone.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Deleting..." : "Delete Account"}
                  </button>
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    type="button"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </article>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default VoterDashboardPage;

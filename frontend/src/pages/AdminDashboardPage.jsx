import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/env.js";
import {
  createCompetitor,
  createElection,
  deleteCompetitor,
  fetchAdminVoteAudit,
  fetchCompetitors,
  fetchElectionResults,
  fetchElections,
  updateCompetitor,
  updateElectionStatus,
} from "../api/electionApi.js";
import {
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
  logoutAdmin,
  updateCurrentUserProfile,
  fetchVoterRegistrations,
  updateVoterRegistrationStatus,
} from "../api/authApi.js";
import SimpleVotesBarChart from "../components/SimpleVotesBarChart.jsx";
import SimpleVotePieChart from "../components/SimpleVotePieChart.jsx";
import { clearSession, getSessionUser, saveSession } from "../utils/session.js";

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

const toBarChartData = (result) =>
  toChartData(result).map((item) => ({
    id: item.id || item.name,
    label: item.name,
    value: item.votesCount,
  }));

const StatIcon = ({ type }) => {
  const common = "h-6 w-6";
  if (type === "elections") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "competitors") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 18a4.5 4.5 0 0 1 9 0v1h-9v-1zM13 19v-1a3.5 3.5 0 0 1 7 0v1h-7z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === "voters") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 19a8 8 0 0 1 16 0v1H4v-1z" stroke="currentColor" strokeWidth="1.8" />
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
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 16v-4m4.5 4V8m4.5 8v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
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
  const [votedByPollId, setVotedByPollId] = useState("all");
  const [votedSearch, setVotedSearch] = useState("");
  const [isLoadingVotesAudit, setIsLoadingVotesAudit] = useState(false);
  const [votesAuditSummary, setVotesAuditSummary] = useState({
    totalVotes: 0,
    totalVoters: 0,
    totalElections: 0,
  });
  const [votesAuditRows, setVotesAuditRows] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isSavingCompetitor, setIsSavingCompetitor] = useState(false);
  const [isSavingElection, setIsSavingElection] = useState(false);
  const [editingCompetitorId, setEditingCompetitorId] = useState("");
  const [processingCompetitorId, setProcessingCompetitorId] = useState("");
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

  const [competitorForm, setCompetitorForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    sex: "male",
    image: null,
  });
  const [competitorSearch, setCompetitorSearch] = useState("");
  const [competitorViewMode, setCompetitorViewMode] = useState("cards");

  const [electionForm, setElectionForm] = useState({
    title: "",
    description: "",
    status: "active",
    startsAt: "",
    endsAt: "",
    competitorIds: [],
    image: null,
  });
  const [electionSearch, setElectionSearch] = useState("");
  const [electionViewMode, setElectionViewMode] = useState("cards");

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

  const dashboardVotesChartData = useMemo(
    () =>
      [...polls]
        .map((poll) => ({
          id: poll.id,
          label: poll.title || "Untitled",
          value: Number(poll.totalVotes || 0),
        }))
        .sort((a, b) => b.value - a.value),
    [polls]
  );

  const dashboardMetricCards = useMemo(
    () => [
      {
        id: "elections",
        label: "Total Elections",
        value: summary.totalElections,
        icon: "elections",
      },
      {
        id: "competitors",
        label: "Total Candidates",
        value: summary.totalCompetitors,
        icon: "competitors",
      },
      {
        id: "voters",
        label: "Total Voters",
        value: voterSummary.total || 0,
        icon: "voters",
      },
      {
        id: "votes",
        label: "Total Votes",
        value: summary.totalVotes,
        icon: "votes",
      },
    ],
    [summary.totalCompetitors, summary.totalElections, summary.totalVotes, voterSummary.total]
  );

  const electionStatusModel = useMemo(() => {
    const ongoing = summary.ongoing || 0;
    const ended = summary.ended || 0;
    const upcoming = summary.upcoming || 0;
    const total = Math.max(1, ongoing + ended + upcoming);
    const ongoingPct = Math.round((ongoing / total) * 100);
    const endedPct = Math.round((ended / total) * 100);

    return {
      ongoing,
      ended,
      upcoming,
      ongoingPct,
      endedPct,
      chartBackground: `conic-gradient(#14B8A6 0 ${ongoingPct}%, #CBD5E1 ${ongoingPct}% 100%)`,
    };
  }, [summary.ended, summary.ongoing, summary.upcoming]);

  const filteredCompetitors = useMemo(() => {
    const query = competitorSearch.trim().toLowerCase();
    if (!query) {
      return competitors;
    }

    return competitors.filter((item) => {
      const name = String(item?.name || "").toLowerCase();
      const email = String(item?.email || "").toLowerCase();
      const phone = String(item?.phone || "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [competitorSearch, competitors]);

  const filteredPolls = useMemo(() => {
    const query = electionSearch.trim().toLowerCase();
    if (!query) {
      return polls;
    }

    return polls.filter((item) => {
      const title = String(item?.title || "").toLowerCase();
      const description = String(item?.description || "").toLowerCase();
      const status = String(item?.status || "").toLowerCase();
      return title.includes(query) || description.includes(query) || status.includes(query);
    });
  }, [electionSearch, polls]);

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

  const liveCompetitorRows = useMemo(() => {
    const source = Array.isArray(liveResults?.competitors) && liveResults.competitors.length
      ? liveResults.competitors
      : selectedLivePoll?.competitors || [];

    return [...source]
      .map((item, index) => ({
        id: item?.id || `comp-${index}`,
        name: item?.name || "Unknown",
        votesCount: Number(item?.votesCount || 0),
        percentage: Number(item?.percentage || 0),
      }))
      .sort((a, b) => b.votesCount - a.votesCount);
  }, [liveResults, selectedLivePoll]);

  const liveVotesCast = useMemo(
    () => liveCompetitorRows.reduce((sum, item) => sum + item.votesCount, 0),
    [liveCompetitorRows]
  );

  const liveTotalVoters = Number(voterSummary.total || 0);
  const liveRemainingVoters = Math.max(0, liveTotalVoters - liveVotesCast);
  const livePieData = useMemo(
    () =>
      liveCompetitorRows.map((item) => ({
        id: item.id,
        label: item.name,
        value: item.votesCount,
      })),
    [liveCompetitorRows]
  );

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
        const [competitorsResponse, electionsResponse, voterSummaryResponse] = await Promise.all([
          fetchCompetitors(),
          fetchElections(),
          fetchVoterRegistrations({ status: "all" }),
        ]);

        const nextCompetitors = competitorsResponse.competitors || [];
        const nextPolls = electionsResponse.polls || [];
        setCompetitors(nextCompetitors);
        setPolls(nextPolls);
        setVoterSummary(
          voterSummaryResponse.summary || {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
          }
        );
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
    const [competitorsResponse, electionsResponse, voterSummaryResponse] = await Promise.all([
      fetchCompetitors(),
      fetchElections(),
      fetchVoterRegistrations({ status: "all" }),
    ]);

    const nextCompetitors = competitorsResponse.competitors || [];
    const nextPolls = electionsResponse.polls || [];
    setCompetitors(nextCompetitors);
    setPolls(nextPolls);
    setVoterSummary(
      voterSummaryResponse.summary || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      }
    );

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

  const loadVotesAudit = async (overrides = {}) => {
    const nextPollId = overrides.pollId ?? votedByPollId;
    const nextSearch = overrides.search ?? votedSearch;
    setIsLoadingVotesAudit(true);

    try {
      const response = await fetchAdminVoteAudit({
        pollId: nextPollId,
        search: nextSearch,
      });
      setVotesAuditRows(response.votes || []);
      setVotesAuditSummary(
        response.summary || {
          totalVotes: 0,
          totalVoters: 0,
          totalElections: 0,
        }
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsLoadingVotesAudit(false);
    }
  };

  useEffect(() => {
    if (activeMenu !== "voters") {
      return;
    }

    loadVoterApprovals();
  }, [activeMenu, voterFilter]);

  useEffect(() => {
    if (activeMenu !== "voters") {
      return;
    }

    loadVotesAudit();
  }, [activeMenu, votedByPollId]);

  useEffect(() => {
    setProfileForm({
      name: sessionUser?.name || "",
      email: sessionUser?.email || "",
    });
  }, [sessionUser?.email, sessionUser?.name]);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // Keep local logout fallback.
    } finally {
      clearSession();
      navigate("/admin/login", { replace: true });
    }
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

  const resetCompetitorForm = () => {
    setCompetitorForm({
      name: "",
      email: "",
      password: "",
      phone: "",
      sex: "male",
      image: null,
    });
    setEditingCompetitorId("");
  };

  const handleEditCompetitor = (competitor) => {
    setActionError("");
    setActionMessage("");
    setEditingCompetitorId(competitor?.id || "");
    setCompetitorForm({
      name: competitor?.name || "",
      email: competitor?.email || "",
      password: "",
      phone: competitor?.phone || "",
      sex: competitor?.sex || "male",
      image: null,
    });
  };

  const handleDeleteCompetitor = async (competitor) => {
    if (!competitor?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Delete candidate "${competitor.name}"? This removes the candidate if no vote history exists.`
    );
    if (!confirmed) {
      return;
    }

    setActionError("");
    setActionMessage("");
    setProcessingCompetitorId(competitor.id);

    try {
      await deleteCompetitor(competitor.id);
      if (editingCompetitorId === competitor.id) {
        resetCompetitorForm();
      }
      setActionMessage("Competitor deleted successfully.");
      await refreshData();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setProcessingCompetitorId("");
    }
  };

  const handleSaveCompetitor = async (event) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    setIsSavingCompetitor(true);

    try {
      if (editingCompetitorId) {
        await updateCompetitor(editingCompetitorId, {
          ...competitorForm,
          password: competitorForm.password || undefined,
        });
        setActionMessage("Competitor updated successfully.");
      } else {
        await createCompetitor(competitorForm);
        setActionMessage("Competitor created successfully.");
      }
      resetCompetitorForm();
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

  const handleSearchVotesAudit = async (event) => {
    event.preventDefault();
    await loadVotesAudit({ search: votedSearch });
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

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    setIsSavingProfile(true);

    try {
      const response = await updateCurrentUserProfile(profileForm);
      if (response?.user) {
        saveSession(response.user);
        setProfileForm({
          name: response.user.name || "",
          email: response.user.email || "",
        });
      }
      setActionMessage(response?.message || "Profile updated successfully.");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    setIsChangingPassword(true);

    try {
      const response = await changeCurrentUserPassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setActionMessage(response?.message || "Password changed successfully.");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your admin account permanently? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setActionError("");
    setActionMessage("");
    setIsDeletingAccount(true);

    try {
      await deleteCurrentUserAccount();
      clearSession();
      navigate("/admin/login", { replace: true });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const renderResultLegend = (result) => {
    const data = toChartData(result);
    if (!data.length) {
      return null;
    }

    return (
      <div className="mt-3 space-y-1">
        {data.map((item) => (
          <div className="flex items-center justify-between text-xs text-slate-700" key={`legend-${item.id || item.name}`}>
            <span>{item.name}</span>
            <span>
              {item.votesCount} votes ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    );
  };

  const approvalStatusStyles = {
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <main className="ems-dashboard min-h-screen">
      <div className="w-full">
        <aside className="ems-sidebar fixed inset-y-0 left-0 z-30 hidden w-[268px] rounded-none p-4 lg:flex lg:flex-col">
          <div className="ems-brand rounded-2xl p-4">
            <p className="ems-brand-title text-sm font-semibold">ElectionMS</p>
            <p className="ems-brand-subtitle text-xs uppercase tracking-[0.2em]">Admin System</p>
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
            {[
              ["elections", "Elections"],
              ["candidates", "Candidates"],
              ["voters", "Voter Approvals"],
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
                <p className="ems-mobile-drawer-subtitle">Admin System</p>
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
                ["elections", "Elections"],
                ["candidates", "Candidates"],
                ["voters", "Voters"],
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
          {activeMenu === "dashboard" ? (
            <header className="rounded-3xl border border-slate-200 bg-white shadow-panel">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Administration
                  </p>
                  <h1 className="text-4xl font-bold tracking-tight text-slate-800">Control Panel</h1>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 hover:bg-slate-100"
                    type="button"
                    aria-label="Theme"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" fill="currentColor" />
                    </svg>
                  </button>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 bg-slate-900 text-xl font-bold text-white">
                    {(sessionUser?.name || "A").slice(0, 1).toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="px-6 py-6">
                <h2 className="text-5xl font-bold text-black">Admin Dashboard</h2>
              </div>
            </header>
          ) : (
            <header className="sticky top-0 z-20 border border-slate-200 bg-white px-5 py-4 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">Admin</p>
              <h1 className="font-heading text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                {activeMenu === "candidates" && "Create and manage competitors."}
                {activeMenu === "elections" && "Create and manage elections."}
                {activeMenu === "voters" && "Approve or reject voter registration requests."}
                {activeMenu === "live-results" && "Watch live voting updates from stream."}
                {activeMenu === "final-results" && "Open final result and chart per election."}
                {activeMenu === "profile" && "Account details."}
              </p>
            </header>
          )}

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
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                {dashboardMetricCards.map((card) => (
                  <article
                    key={card.id}
                    className="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-panel"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[18px] leading-none text-slate-500">{card.label}</p>
                        <p className="mt-3 text-5xl font-bold leading-none text-black">{card.value}</p>
                      </div>
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <StatIcon type={card.icon} />
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
                  <h3 className="text-4xl font-bold text-slate-900">Elections Status</h3>
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <p className="text-5xl font-medium text-[#14B8A6]">{electionStatusModel.ongoing}</p>
                    <div className="relative h-72 w-72">
                      <div
                        className="absolute inset-0 rounded-full border border-[#8CA3A0]"
                        style={{ background: electionStatusModel.chartBackground }}
                      />
                      <div className="absolute inset-[34%] rounded-full bg-white" />
                      <div className="absolute left-[-82px] top-1/2 h-px w-[82px] -translate-y-1/2 bg-[#94A3B8]" />
                      <div className="absolute right-[-82px] top-1/2 h-px w-[82px] -translate-y-1/2 bg-[#94A3B8]" />
                    </div>
                    <p className="text-5xl font-medium text-[#14B8A6]">{electionStatusModel.ended}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-sm text-slate-600">
                    <span>Open: {electionStatusModel.ongoingPct}%</span>
                    <span>Closed: {electionStatusModel.endedPct}%</span>
                    <span>Upcoming: {electionStatusModel.upcoming}</span>
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
                  <SimpleVotesBarChart
                    title="Votes by Election"
                    caption="Live totals from election data"
                    data={dashboardVotesChartData}
                    height={300}
                  />
                </article>
              </section>
            </>
          ) : null}

          {activeMenu === "candidates" ? (
            <section className="space-y-5">
              <h2 className="text-5xl font-bold tracking-tight text-slate-900">Candidates Management</h2>

              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
                <h3 className="text-3xl font-bold text-slate-900">
                  {editingCompetitorId ? "Update Candidate" : "Add Candidate"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingCompetitorId
                    ? "Edit candidate data and save changes."
                    : "Create candidate profile. Election assignment is done in Elections section."}
                </p>

                <form className="mt-5 space-y-4" onSubmit={handleSaveCompetitor}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Candidate Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="name"
                        placeholder="Candidate name"
                        value={competitorForm.name}
                        onChange={handleCompetitorChange}
                        required
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Email</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="email"
                        type="email"
                        placeholder="Candidate email"
                        value={competitorForm.email}
                        onChange={handleCompetitorChange}
                        required
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Phone</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="phone"
                        placeholder="Candidate phone"
                        value={competitorForm.phone}
                        onChange={handleCompetitorChange}
                        required
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Sex</span>
                      <select
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="sex"
                        value={competitorForm.sex}
                        onChange={handleCompetitorChange}
                      >
                        <option value="male">male</option>
                        <option value="female">female</option>
                        <option value="other">other</option>
                      </select>
                    </label>

                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Password</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="password"
                        type="password"
                        minLength={6}
                        placeholder={editingCompetitorId ? "Leave empty to keep current password" : "Password"}
                        value={competitorForm.password}
                        onChange={handleCompetitorChange}
                        required={!editingCompetitorId}
                      />
                    </label>

                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Photo</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                        name="image"
                        type="file"
                        accept="image/*"
                        onChange={handleCompetitorChange}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {editingCompetitorId ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        type="button"
                        onClick={resetCompetitorForm}
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                      type="submit"
                      disabled={isSavingCompetitor}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {isSavingCompetitor
                        ? editingCompetitorId
                          ? "Updating..."
                          : "Creating..."
                        : editingCompetitorId
                        ? "Update Candidate"
                        : "Create Candidate"}
                    </button>
                  </div>
                </form>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    className="w-full max-w-xl rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    placeholder="Search candidates..."
                    value={competitorSearch}
                    onChange={(event) => setCompetitorSearch(event.target.value)}
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      className={`rounded-lg px-3 py-1.5 font-semibold ${
                        competitorViewMode === "cards" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                      type="button"
                      onClick={() => setCompetitorViewMode("cards")}
                    >
                      Cards
                    </button>
                    <button
                      className={`rounded-lg px-3 py-1.5 font-semibold ${
                        competitorViewMode === "table" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                      type="button"
                      onClick={() => setCompetitorViewMode("table")}
                    >
                      Table
                    </button>
                  </div>
                </div>

                {filteredCompetitors.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No candidates found for this search.</p>
                ) : null}

                {filteredCompetitors.length > 0 && competitorViewMode === "cards" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredCompetitors.map((comp) => {
                      const votes = Number(comp?.votesCount ?? comp?.totalVotes ?? 0);
                      return (
                        <article key={comp.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 h-36 overflow-hidden rounded-xl bg-slate-200">
                            {comp.imageUrl ? (
                              <img className="h-full w-full object-cover" src={comp.imageUrl} alt={comp.name} />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-500">No photo</div>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-2xl font-bold text-slate-900">{comp.name}</h4>
                            <p className="text-xs font-semibold text-slate-600">Votes: {votes}</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{comp.email}</p>
                          <p className="text-sm text-slate-600">
                            {comp.phone} | {comp.sex}
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              type="button"
                              onClick={() => handleEditCompetitor(comp)}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                              type="button"
                              disabled={processingCompetitorId === comp.id}
                              onClick={() => handleDeleteCompetitor(comp)}
                            >
                              {processingCompetitorId === comp.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {filteredCompetitors.length > 0 && competitorViewMode === "table" ? (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Candidate</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Sex</th>
                          <th className="px-4 py-3">Votes</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompetitors.map((comp) => (
                          <tr className="border-t border-slate-200 bg-white" key={`row-${comp.id}`}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{comp.name}</td>
                            <td className="px-4 py-3 text-slate-700">{comp.email}</td>
                            <td className="px-4 py-3 text-slate-700">{comp.phone}</td>
                            <td className="px-4 py-3 text-slate-700">{comp.sex}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {Number(comp?.votesCount ?? comp?.totalVotes ?? 0)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                  type="button"
                                  onClick={() => handleEditCompetitor(comp)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                  type="button"
                                  disabled={processingCompetitorId === comp.id}
                                  onClick={() => handleDeleteCompetitor(comp)}
                                >
                                  {processingCompetitorId === comp.id ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            </section>
          ) : null}

          {activeMenu === "elections" ? (
            <section className="space-y-5">
              <h2 className="text-5xl font-bold tracking-tight text-slate-900">Elections Management</h2>

              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
                <h3 className="text-3xl font-bold text-slate-900">Add Election</h3>
                <form className="mt-5 space-y-4" onSubmit={handleCreateElection}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Election Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="title"
                        placeholder="Election title"
                        value={electionForm.title}
                        onChange={handleElectionChange}
                        required
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Status</span>
                      <select
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="status"
                        value={electionForm.status}
                        onChange={handleElectionChange}
                      >
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="closed">closed</option>
                      </select>
                    </label>

                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Photo</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                        name="image"
                        type="file"
                        accept="image/*"
                        onChange={handleElectionChange}
                      />
                    </label>

                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Description</span>
                      <textarea
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="description"
                        placeholder="Description"
                        value={electionForm.description}
                        onChange={handleElectionChange}
                        rows={4}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Starts At</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="startsAt"
                        type="datetime-local"
                        value={electionForm.startsAt}
                        onChange={handleElectionChange}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">Ends At</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-3"
                        name="endsAt"
                        type="datetime-local"
                        value={electionForm.endsAt}
                        onChange={handleElectionChange}
                      />
                    </label>

                    <div className="space-y-1.5 md:col-span-2">
                      <p className="text-sm font-semibold text-slate-700">Assign Candidates</p>
                      <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {(competitors || []).map((competitor) => (
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700" key={competitor.id}>
                            <input
                              type="checkbox"
                              checked={electionForm.competitorIds.includes(competitor.id)}
                              onChange={() => handleToggleCompetitor(competitor.id)}
                            />
                            <span>{competitor.name}</span>
                            <span className="text-xs text-slate-500">({competitor.email})</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        Selected candidates: {electionForm.competitorIds.length}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                      type="submit"
                      disabled={isSavingElection || !canCreateElection}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {isSavingElection ? "Creating..." : "Create Election"}
                    </button>
                  </div>
                </form>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    className="w-full max-w-xl rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    placeholder="Search elections..."
                    value={electionSearch}
                    onChange={(event) => setElectionSearch(event.target.value)}
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      className={`rounded-lg px-3 py-1.5 font-semibold ${
                        electionViewMode === "cards" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                      type="button"
                      onClick={() => setElectionViewMode("cards")}
                    >
                      Cards
                    </button>
                    <button
                      className={`rounded-lg px-3 py-1.5 font-semibold ${
                        electionViewMode === "table" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                      type="button"
                      onClick={() => setElectionViewMode("table")}
                    >
                      Table
                    </button>
                  </div>
                </div>

                {filteredPolls.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No elections found for this search.</p>
                ) : null}

                {filteredPolls.length > 0 && electionViewMode === "cards" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredPolls.map((poll) => (
                      <article key={poll.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 h-36 overflow-hidden rounded-xl bg-slate-200">
                          {poll.imageUrl ? (
                            <img className="h-full w-full object-cover" src={poll.imageUrl} alt={poll.title} />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-2xl font-bold text-slate-900">{poll.title}</h4>
                          <span className="text-xs font-semibold capitalize text-slate-600">{poll.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{poll.description || "-"}</p>
                        <p className="mt-2 text-xs text-slate-600">Votes: {poll.totalVotes}</p>
                        <p className="text-xs text-slate-600">
                          {formatDateTime(poll.startsAt)} - {formatDateTime(poll.endsAt)}
                        </p>
                        {poll.status !== "closed" ? (
                          <button
                            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            type="button"
                            onClick={() => handleCloseElection(poll.id)}
                          >
                            Close
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}

                {filteredPolls.length > 0 && electionViewMode === "table" ? (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Election</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Votes</th>
                          <th className="px-4 py-3">Start</th>
                          <th className="px-4 py-3">End</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPolls.map((poll) => (
                          <tr className="border-t border-slate-200 bg-white" key={`row-poll-${poll.id}`}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{poll.title}</td>
                            <td className="px-4 py-3 capitalize text-slate-700">{poll.status}</td>
                            <td className="px-4 py-3 text-slate-700">{poll.totalVotes}</td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(poll.startsAt)}</td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(poll.endsAt)}</td>
                            <td className="px-4 py-3">
                              {poll.status !== "closed" ? (
                                <button
                                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  type="button"
                                  onClick={() => handleCloseElection(poll.id)}
                                >
                                  Close
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500">Closed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
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

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Voter Vote Activity</h3>
                    <p className="text-xs text-slate-500">
                      See which voter voted for which competitor in each election.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                      <p className="text-slate-500">Votes</p>
                      <p className="font-semibold text-slate-900">{votesAuditSummary.totalVotes}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                      <p className="text-slate-500">Voters</p>
                      <p className="font-semibold text-slate-900">{votesAuditSummary.totalVoters}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                      <p className="text-slate-500">Elections</p>
                      <p className="font-semibold text-slate-900">{votesAuditSummary.totalElections}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-[260px_1fr_auto]">
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={votedByPollId}
                    onChange={(event) => setVotedByPollId(event.target.value)}
                  >
                    <option value="all">All elections</option>
                    {polls.map((poll) => (
                      <option key={`votes-audit-poll-${poll.id}`} value={poll.id}>
                        {poll.title}
                      </option>
                    ))}
                  </select>
                  <form className="flex flex-wrap gap-2 md:col-span-2 md:grid md:grid-cols-[1fr_auto]" onSubmit={handleSearchVotesAudit}>
                    <input
                      className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Search voter or competitor"
                      value={votedSearch}
                      onChange={(event) => setVotedSearch(event.target.value)}
                    />
                    <button
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                      type="submit"
                    >
                      Search
                    </button>
                  </form>
                </div>

                {isLoadingVotesAudit ? (
                  <p className="mt-3 text-sm text-slate-500">Loading vote activity...</p>
                ) : null}

                {!isLoadingVotesAudit && votesAuditRows.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No vote activity found for current filter.</p>
                ) : null}

                {!isLoadingVotesAudit && votesAuditRows.length > 0 ? (
                  <>
                    <div className="mt-3 space-y-2 md:hidden">
                      {votesAuditRows.map((row) => (
                        <article className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={row.id}>
                          <p className="text-xs text-slate-500">Election</p>
                          <p className="font-semibold text-slate-900">{row.poll?.title || "-"}</p>
                          <p className="mt-2 text-xs text-slate-500">Voter</p>
                          <p className="text-sm font-medium text-slate-900">{row.voter?.name || "-"}</p>
                          <p className="text-xs text-slate-600">{row.voter?.email || "-"}</p>
                          <p className="mt-2 text-xs text-slate-500">Voted For</p>
                          <p className="text-sm font-medium text-slate-900">{row.competitor?.name || "-"}</p>
                          <p className="text-xs text-slate-600">{row.competitor?.email || "-"}</p>
                          <p className="mt-2 text-xs text-slate-500">Voted At</p>
                          <p className="text-xs text-slate-700">{formatDateTime(row.votedAt)}</p>
                        </article>
                      ))}
                    </div>

                    <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                          <tr>
                            <th className="px-4 py-3">Election</th>
                            <th className="px-4 py-3">Voter</th>
                            <th className="px-4 py-3">Competitor</th>
                            <th className="px-4 py-3">Voted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {votesAuditRows.map((row) => (
                            <tr className="border-t border-slate-200 bg-white" key={`vote-audit-row-${row.id}`}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-900">{row.poll?.title || "-"}</p>
                                <p className="text-xs capitalize text-slate-500">{row.poll?.status || "-"}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{row.voter?.name || "-"}</p>
                                <p className="text-xs text-slate-600">{row.voter?.email || "-"}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{row.competitor?.name || "-"}</p>
                                <p className="text-xs text-slate-600">{row.competitor?.email || "-"}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{formatDateTime(row.votedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeMenu === "live-results" ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="text-5xl font-bold tracking-tight text-slate-900">Live Results</h2>
              <select
                className="w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={livePollId}
                onChange={(event) => {
                  setLivePollId(event.target.value);
                  setLiveResults(null);
                }}
              >
                <option value="">Select election</option>
                {polls.map((poll) => (
                  <option key={poll.id} value={poll.id}>
                    {poll.title}
                  </option>
                ))}
              </select>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    id: "total",
                    label: "Total Voters",
                    value: liveTotalVoters,
                    icon: "voters",
                  },
                  {
                    id: "cast",
                    label: "Votes Cast",
                    value: liveVotesCast,
                    icon: "votes",
                  },
                  {
                    id: "remaining",
                    label: "Remaining Voters",
                    value: liveRemainingVoters,
                    icon: "voters",
                  },
                  {
                    id: "time",
                    label: "Time Remaining",
                    value: selectedLivePoll
                      ? selectedLivePhase === "ended"
                        ? "Completed"
                        : selectedLiveTimeLabel
                      : "-",
                    icon: "time",
                  },
                ].map((card) => (
                  <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl text-slate-500">{card.label}</p>
                        <p className="mt-2 text-4xl font-bold text-black">{card.value}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <StatIcon type={card.icon} />
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
                  data={liveCompetitorRows.map((item) => ({
                    id: item.id,
                    label: item.name,
                    value: item.votesCount,
                  }))}
                  height={300}
                />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-3xl font-bold text-slate-900">Candidate Ranking</h3>
                {selectedLivePoll ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedLivePoll.title} | Start: {formatDateTime(selectedLivePoll.startsAt)} | End:{" "}
                    {formatDateTime(selectedLivePoll.endsAt)}
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
                      </tr>
                    </thead>
                    <tbody>
                      {liveCompetitorRows.map((item, index) => (
                        <tr className="border-t border-slate-200" key={`live-row-${item.id}`}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                          <td className="px-4 py-3 text-slate-800">{item.name}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.votesCount}</td>
                          <td className="px-4 py-3 text-slate-700">{item.percentage}%</td>
                        </tr>
                      ))}
                      {liveCompetitorRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-slate-500" colSpan={4}>
                            Select election to stream live results.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
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
                        <SimpleVotesBarChart
                          title="Votes per Candidate"
                          data={toBarChartData(resultsByPollId[poll.id])}
                          caption="Final election result"
                        />
                        {renderResultLegend(resultsByPollId[poll.id])}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
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
                  Delete your admin account permanently. This action cannot be undone.
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

export default AdminDashboardPage;

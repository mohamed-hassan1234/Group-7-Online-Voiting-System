import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  changeCompetitorPassword,
  deleteCurrentCompetitorAccount,
  fetchCompetitorDashboard,
  fetchCurrentCompetitor,
  updateCurrentCompetitorProfile,
} from "../api/competitorApi.js";
import { logoutCompetitor } from "../api/authApi.js";
import SimpleVotesBarChart from "../components/SimpleVotesBarChart.jsx";
import { clearSession, getSessionUser, saveSession } from "../utils/session.js";

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

const phasePillClasses = {
  ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
  upcoming: "border-amber-200 bg-amber-50 text-amber-700",
  ended: "border-rose-200 bg-rose-50 text-rose-700",
};

const getPhaseTimeLabel = (item, nowTs = Date.now()) => {
  const startTs = toTimestamp(item?.startsAt);
  const endTs = toTimestamp(item?.endsAt);

  if (item?.phase === "ongoing") {
    return endTs ? `Ends in ${formatCountdown(endTs, nowTs)}` : "Ongoing";
  }
  if (item?.phase === "upcoming") {
    return startTs ? `Starts in ${formatCountdown(startTs, nowTs)}` : "Upcoming";
  }
  return "Competition ended";
};

function CompetitorDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = getSessionUser();
  const userRole = sessionUser?.role || "";

  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({
    totalParticipations: 0,
    totalVotesReceived: 0,
    leadingCount: 0,
    ongoing: 0,
    upcoming: 0,
    ended: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [competitionSearch, setCompetitionSearch] = useState("");
  const [competitionPhase, setCompetitionPhase] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    sex: "male",
    image: null,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const routeBySection = useMemo(
    () => ({
      dashboard: "/competitor/dashboard",
      competitions: "/competitor/competitions",
      profile: "/competitor/profile",
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

  const applyDashboardResponse = (response) => {
    const nextProfile = response?.competitor || null;
    setProfile(nextProfile);
    setSummary(response?.summary || {});
    setChartData(response?.chartData || []);
    setParticipations(response?.participations || []);
    if (nextProfile) {
      setProfileForm({
        name: nextProfile.name || "",
        email: nextProfile.email || "",
        phone: nextProfile.phone || "",
        sex: nextProfile.sex || "male",
        image: null,
      });
      saveSession(nextProfile);
    }
  };

  const loadDashboard = async () => {
    setErrorMessage("");
    const response = await fetchCompetitorDashboard();
    applyDashboardResponse(response);
  };

  useEffect(() => {
    if (userRole !== "competitor") {
      navigate("/competitor/login", { replace: true });
      return;
    }

    const boot = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        await loadDashboard();
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    boot();
  }, [navigate, userRole]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutCompetitor();
    } catch {
      // local logout fallback
    } finally {
      clearSession();
      navigate("/competitor/login", { replace: true });
    }
  };

  const navigateToSection = (sectionId) => {
    const targetRoute = routeBySection[sectionId] || routeBySection.dashboard;
    navigate(targetRoute);
  };

  const chartVotesSeries = useMemo(
    () =>
      (Array.isArray(chartData) ? chartData : []).map((item, index) => ({
        id: item.pollId || `poll-${index}`,
        label: item.pollTitle || "Untitled",
        value: Number(item.votes || 0),
      })),
    [chartData]
  );

  const filteredParticipations = useMemo(() => {
    const query = competitionSearch.trim().toLowerCase();
    return (participations || []).filter((item) => {
      const byPhase = competitionPhase === "all" || item.phase === competitionPhase;
      if (!byPhase) {
        return false;
      }
      if (!query) {
        return true;
      }
      const title = String(item?.title || "").toLowerCase();
      const description = String(item?.description || "").toLowerCase();
      const leader = String(item?.leader?.name || "").toLowerCase();
      return title.includes(query) || description.includes(query) || leader.includes(query);
    });
  }, [competitionPhase, competitionSearch, participations]);

  const endedWithWinner = useMemo(
    () =>
      filteredParticipations
        .filter((item) => item.phase === "ended")
        .map((item) => ({
          id: item.id,
          title: item.title,
          winnerName: item.leader?.name || "No winner",
          winnerVotes: Number(item.leader?.votesCount || 0),
          myRank: item.rank,
          totalCompetitors: item.totalCompetitors,
        })),
    [filteredParticipations]
  );

  const handleProfileInputChange = (event) => {
    const { name, value, files, type } = event.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: type === "file" ? files?.[0] || null : value,
    }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSavingProfile(true);

    try {
      const response = await updateCurrentCompetitorProfile(profileForm);
      const updatedProfile = response?.competitor || null;
      if (updatedProfile) {
        setProfile(updatedProfile);
        setProfileForm((prev) => ({
          ...prev,
          name: updatedProfile.name || "",
          email: updatedProfile.email || "",
          phone: updatedProfile.phone || "",
          sex: updatedProfile.sex || "male",
          image: null,
        }));
        saveSession(updatedProfile);
      }
      setStatusMessage(response?.message || "Profile updated.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsChangingPassword(true);

    try {
      const response = await changeCompetitorPassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setStatusMessage(response?.message || "Password changed.");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your competitor account permanently? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsDeletingAccount(true);

    try {
      await deleteCurrentCompetitorAccount();
      clearSession();
      navigate("/competitor/login", { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const refreshProfile = async () => {
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetchCurrentCompetitor();
      const current = response?.competitor || null;
      if (!current) {
        return;
      }
      setProfile(current);
      setProfileForm({
        name: current.name || "",
        email: current.email || "",
        phone: current.phone || "",
        sex: current.sex || "male",
        image: null,
      });
      saveSession(current);
      setStatusMessage("Profile refreshed.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <main className="ems-dashboard min-h-screen">
      <div className="w-full">
        <aside className="ems-sidebar fixed inset-y-0 left-0 z-30 hidden w-[268px] rounded-none p-4 lg:flex lg:flex-col">
          <div className="ems-brand rounded-2xl p-4">
            <p className="ems-brand-title text-sm font-semibold">ElectionMS</p>
            <p className="ems-brand-subtitle text-xs uppercase tracking-[0.2em]">Competitor Panel</p>
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
              className={`ems-nav-btn ${activeMenu === "competitions" ? "is-active" : ""}`}
              type="button"
              onClick={() => navigateToSection("competitions")}
            >
              Competitions
            </button>
            <p className="ems-nav-group">Account</p>
            <button
              className={`ems-nav-btn ${activeMenu === "profile" ? "is-active" : ""}`}
              type="button"
              onClick={() => navigateToSection("profile")}
            >
              Profile
            </button>
          </nav>
          <button className="ems-logout-btn mt-auto" type="button" onClick={handleLogout}>
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
                <p className="ems-mobile-drawer-subtitle">Competitor Panel</p>
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
                ["competitions", "Competitions"],
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">Competitor</p>
            <h1 className="font-heading text-2xl font-semibold text-slate-900">Competitor Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeMenu === "dashboard" && "Track your votes, participation, and competition status."}
              {activeMenu === "competitions" && "See all competitions, winners, and your ranking."}
              {activeMenu === "profile" && "Manage your profile, password, and account settings."}
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
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                  <p className="text-xs uppercase text-slate-500">Participations</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalParticipations || 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                  <p className="text-xs uppercase text-slate-500">Total Votes</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalVotesReceived || 0}</p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-indigo-700">Leading</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-900">{summary.leadingCount || 0}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-emerald-700">Ongoing</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{summary.ongoing || 0}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-amber-700">Upcoming</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{summary.upcoming || 0}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-rose-700">Ended</p>
                  <p className="mt-1 text-2xl font-bold text-rose-900">{summary.ended || 0}</p>
                </div>
              </div>

              <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                  {isLoading ? <p className="text-sm text-slate-500">Loading chart...</p> : null}
                  {!isLoading ? (
                    <>
                      <SimpleVotesBarChart
                        title="Votes per Competition"
                        caption="Your votes in each election"
                        data={chartVotesSeries}
                      />
                      <div className="mt-3 space-y-1">
                        {chartData.map((item, index) => (
                          <div
                            className="flex items-center justify-between text-xs text-slate-700"
                            key={`legend-${item.pollId || index}`}
                          >
                            <span>{item.pollTitle}</span>
                            <span>
                              {item.votes} votes ({item.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                  <h3 className="text-lg font-semibold text-slate-900">Winner Overview</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Ended competitions and winner information.
                  </p>
                  <div className="mt-3 space-y-2">
                    {endedWithWinner.slice(0, 6).map((item) => (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={`winner-${item.id}`}>
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Winner: <b>{item.winnerName}</b> ({item.winnerVotes} votes)
                        </p>
                        <p className="text-xs text-slate-600">
                          My Rank: <b>{item.myRank || "-"}</b> / {item.totalCompetitors}
                        </p>
                      </div>
                    ))}
                    {endedWithWinner.length === 0 ? (
                      <p className="text-sm text-slate-500">No ended competitions yet.</p>
                    ) : null}
                  </div>
                </article>
              </section>
            </section>
          ) : null}

          {activeMenu === "competitions" ? (
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search competition..."
                    value={competitionSearch}
                    onChange={(event) => setCompetitionSearch(event.target.value)}
                  />
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={competitionPhase}
                    onChange={(event) => setCompetitionPhase(event.target.value)}
                  >
                    <option value="all">All phases</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>
              </div>

              {isLoading ? <p className="text-sm text-slate-500">Loading competitions...</p> : null}
              {!isLoading && filteredParticipations.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  No competitions found with this filter.
                </p>
              ) : null}

              <div className="space-y-4">
                {filteredParticipations.map((item) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel" key={item.id}>
                    {item.imageUrl ? (
                      <img className="mb-3 h-44 w-full rounded-xl object-cover" src={item.imageUrl} alt={item.title} />
                    ) : null}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                        <p className="text-sm text-slate-600">{item.description || "-"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(item.startsAt)} - {formatDateTime(item.endsAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{getPhaseTimeLabel(item, nowTs)}</p>
                      </div>
                      <div className="space-y-2 text-right">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                            phasePillClasses[item.phase] || "border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.phase}
                        </span>
                        {item.phase === "ended" ? (
                          <p className="text-xs text-slate-700">
                            Winner: <b>{item.leader?.name || "No winner"}</b>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        My Votes: <b>{item.selfVotes}</b>
                      </p>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        My Share: <b>{item.selfPercentage}%</b>
                      </p>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        Rank: <b>{item.rank || "-"}</b> / {item.totalCompetitors}
                      </p>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        Total Votes: <b>{item.totalVotes}</b>
                      </p>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-100 uppercase tracking-wide text-slate-600">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Competitor</th>
                            <th className="px-3 py-2">Votes</th>
                            <th className="px-3 py-2">Share</th>
                            <th className="px-3 py-2">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(item.competitors || []).map((row, index) => {
                            const isMe = String(row.id) === String(profile?.id || sessionUser?.id || "");
                            const leaderVotes = Number(item.competitors?.[0]?.votesCount || 0);
                            const gap = Math.max(0, leaderVotes - Number(row.votesCount || 0));

                            return (
                              <tr
                                className={`border-t border-slate-200 ${isMe ? "bg-blue-50" : "bg-white"}`}
                                key={`${item.id}-${row.id}-${index}`}
                              >
                                <td className="px-3 py-2 font-semibold text-slate-700">{index + 1}</td>
                                <td className="px-3 py-2 text-slate-800">
                                  {row.name}
                                  {isMe ? (
                                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                                      You
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-700">{row.votesCount}</td>
                                <td className="px-3 py-2 text-slate-700">{row.percentage}%</td>
                                <td className="px-3 py-2 text-slate-600">
                                  {index === 0 ? "Leader" : `${gap} votes behind`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeMenu === "profile" ? (
            <section className="space-y-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-heading text-xl font-semibold text-slate-900">Profile Settings</h2>
                  <button
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    type="button"
                    onClick={refreshProfile}
                  >
                    Refresh
                  </button>
                </div>

                {profile?.imageUrl ? (
                  <img className="mt-3 h-28 w-28 rounded-xl object-cover" src={profile.imageUrl} alt={profile.name} />
                ) : null}

                <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSaveProfile}>
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
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    name="phone"
                    placeholder="Phone"
                    value={profileForm.phone}
                    onChange={handleProfileInputChange}
                    required
                  />
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    name="sex"
                    value={profileForm.sex}
                    onChange={handleProfileInputChange}
                  >
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                  </select>
                  <label className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 md:col-span-2">
                    Profile image
                    <input
                      className="mt-1 block w-full text-xs"
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={handleProfileInputChange}
                    />
                  </label>
                  <button
                    className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60 md:col-span-2"
                    type="submit"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </form>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handlePasswordChange}>
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
                  Delete your account permanently. This action cannot be undone.
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

export default CompetitorDashboardPage;

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchCompetitorDashboard } from "../api/competitorApi.js";
import { logoutCompetitor } from "../api/authApi.js";
import { clearSession, getSessionUser } from "../utils/session.js";

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

const phasePillClasses = {
  ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
  upcoming: "border-amber-200 bg-amber-50 text-amber-700",
  ended: "border-rose-200 bg-rose-50 text-rose-700",
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
    if (userRole !== "competitor") {
      navigate("/competitor/login", { replace: true });
      return;
    }

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchCompetitorDashboard();
        setProfile(response.competitor || null);
        setSummary(response.summary || {});
        setChartData(response.chartData || []);
        setParticipations(response.participations || []);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [navigate, userRole]);

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

  const renderVotesChart = () => {
    if (!chartData.length) {
      return <p className="text-sm text-slate-500">No election data for chart yet.</p>;
    }

    const maxVotes = Math.max(1, ...chartData.map((item) => item.votes || 0));

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[560px] rounded-2xl border border-slate-300 bg-slate-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
            My Votes By Election
          </p>
          <div className="mt-3 rounded-xl border-2 border-slate-700 bg-white p-4">
            <div className="flex h-72 items-end justify-around gap-4 border-b border-slate-300">
              {chartData.map((item) => {
                const votes = Number(item.votes || 0);
                const barHeight = votes === 0 ? 0 : Math.max(10, Math.round((votes / maxVotes) * 240));

                return (
                  <div className="flex w-full max-w-24 flex-col items-center justify-end" key={item.pollId}>
                    <p className="mb-1 text-xs font-semibold text-slate-700">{votes}</p>
                    <div
                      className="w-14 rounded-t-sm bg-[#0B5B93] transition-all duration-500"
                      style={{ height: `${barHeight}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-start justify-around gap-4">
              {chartData.map((item) => (
                <div className="w-full max-w-24 text-center" key={`label-${item.pollId}`}>
                  <p className="text-xs font-semibold text-slate-800">{item.pollTitle}</p>
                  <p className="text-[11px] text-slate-600">{item.percentage}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <aside className="fixed left-6 top-4 hidden h-[calc(100vh-2rem)] w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel lg:flex lg:flex-col">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-500 p-4 text-white">
            <p className="text-sm font-semibold">ElectionMS</p>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Competitor Panel</p>
          </div>
          <nav className="mt-4 space-y-2">
            {[
              ["dashboard", "Dashboard"],
              ["competitions", "Competitions"],
              ["profile", "Profile"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  activeMenu === id
                    ? "bg-indigo-600 text-white"
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
              Competitor
            </p>
            <h1 className="font-heading text-2xl font-semibold text-slate-900">
              Competitor Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeMenu === "dashboard" && "See your vote totals and performance chart."}
              {activeMenu === "competitions" && "All elections where you are participating."}
              {activeMenu === "profile" && "Your account details."}
            </p>
          </header>

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
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {summary.totalParticipations || 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                  <p className="text-xs uppercase text-slate-500">Total Votes</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {summary.totalVotesReceived || 0}
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-panel">
                  <p className="text-xs uppercase text-indigo-700">Leading Elections</p>
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

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                {isLoading ? <p className="text-sm text-slate-500">Loading chart...</p> : null}
                {!isLoading ? renderVotesChart() : null}
              </section>
            </section>
          ) : null}

          {activeMenu === "competitions" ? (
            <section className="space-y-3">
              {isLoading ? <p className="text-sm text-slate-500">Loading competitions...</p> : null}
              {!isLoading && participations.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  You are not assigned to any election yet.
                </p>
              ) : null}
              {participations.map((item) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel" key={item.id}>
                  {item.imageUrl ? (
                    <img
                      className="mb-3 h-44 w-full rounded-xl object-cover"
                      src={item.imageUrl}
                      alt={item.title}
                    />
                  ) : null}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(item.startsAt)} - {formatDateTime(item.endsAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                        phasePillClasses[item.phase] || "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.phase}
                    </span>
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
                </article>
              ))}
            </section>
          ) : null}

          {activeMenu === "profile" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Profile</h2>
              {profile?.imageUrl ? (
                <img className="mt-3 h-40 w-40 rounded-xl object-cover" src={profile.imageUrl} alt={profile.name} />
              ) : null}
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p>
                  <b>Name:</b> {profile?.name || sessionUser?.name || "-"}
                </p>
                <p>
                  <b>Email:</b> {profile?.email || sessionUser?.email || "-"}
                </p>
                <p>
                  <b>Role:</b> {profile?.role || sessionUser?.role || "competitor"}
                </p>
                <p>
                  <b>Phone:</b> {profile?.phone || "-"}
                </p>
                <p>
                  <b>Sex:</b> {profile?.sex || "-"}
                </p>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default CompetitorDashboardPage;
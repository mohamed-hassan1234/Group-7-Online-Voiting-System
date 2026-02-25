import { Link, Navigate } from "react-router-dom";
import { getSessionUser } from "../utils/session.js";

function HomePage() {
  const user = getSessionUser();

  if (user?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user?.role === "user") {
    return <Navigate to="/voter/dashboard" replace />;
  }

  if (user?.role === "competitor") {
    return <Navigate to="/competitor/dashboard" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
          Election Management
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-slate-900">
          Online Voting Portal
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Choose your portal. Admin can create competitors and elections. Voter can register,
          login, view elections, and vote only one competitor per election.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Admin Portal</h2>
            <p className="mt-2 text-sm text-slate-600">
              Register/login as admin, create competitors, assign to elections, and view final
              results.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                to="/admin/login"
              >
                Admin Login
              </Link>
              <Link
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                to="/admin/register"
              >
                Admin Register
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-sky-50 p-5">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Voter Portal</h2>
            <p className="mt-2 text-sm text-slate-600">
              Register/login as voter, see elections, choose one competitor, and submit one vote.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
                to="/voter/login"
              >
                Voter Login
              </Link>
              <Link
                className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                to="/voter/register"
              >
                Voter Register
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-indigo-50 p-5">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Competitor Portal</h2>
            <p className="mt-2 text-sm text-slate-600">
              Competitors login with account created by admin and track participation, votes,
              and chart performance.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-900"
                to="/competitor/login"
              >
                Competitor Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;

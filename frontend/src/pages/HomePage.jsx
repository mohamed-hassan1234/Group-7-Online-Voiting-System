import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getSessionUser } from "../utils/session.js";

function HomePage() {
  const user = getSessionUser();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <main className="min-h-screen bg-[#F9FAFB] px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <header className="app-navbar px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
                Online Voting
              </p>
              <h1 className="text-lg font-bold text-[#111827] sm:text-xl">Election Management</h1>
            </div>

            <button
              className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-slate-800 md:hidden"
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              Menu
            </button>

            <nav className="hidden items-center gap-2 md:flex">
              <Link className="app-btn-primary px-4 py-2 text-sm" to="/admin/login">
                Admin
              </Link>
              <Link className="app-btn-success px-4 py-2 text-sm" to="/voter/login">
                Voter
              </Link>
              <Link
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                to="/competitor/login"
              >
                Competitor
              </Link>
            </nav>
          </div>

          {menuOpen ? (
            <nav className="mt-3 grid gap-2 md:hidden">
              <Link className="app-btn-primary px-4 py-2 text-center text-sm" to="/admin/login">
                Admin Login
              </Link>
              <Link className="app-btn-success px-4 py-2 text-center text-sm" to="/voter/login">
                Voter Login
              </Link>
              <Link
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                to="/competitor/login"
              >
                Competitor Login
              </Link>
            </nav>
          ) : null}
        </header>

        <section className="mt-6 app-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">Control Center</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-[#111827] sm:text-4xl">
            Professional Online Voting System
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
            Secure role-based voting platform for admins, voters, and competitors. Create elections,
            assign competitors, cast one vote per voter, and track live/final results with clear analytics.
          </p>

          <div className="mt-8 app-responsive-grid">
            <article className="app-card p-5">
              <h3 className="font-heading text-xl font-semibold text-[#111827]">Admin Portal</h3>
              <p className="mt-2 text-sm text-slate-600">
                Create elections, manage competitors, monitor approvals, and view final analytics.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link className="app-btn-primary px-4 py-2 text-center text-sm" to="/admin/login">
                  Admin Login
                </Link>
                <Link
                  className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  to="/admin/register"
                >
                  Admin Register
                </Link>
              </div>
            </article>

            <article className="app-card p-5">
              <h3 className="font-heading text-xl font-semibold text-[#111827]">Voter Portal</h3>
              <p className="mt-2 text-sm text-slate-600">
                Register, login after approval, view active elections, and vote once per election.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link className="app-btn-success px-4 py-2 text-center text-sm" to="/voter/login">
                  Voter Login
                </Link>
                <Link
                  className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  to="/voter/register"
                >
                  Voter Register
                </Link>
              </div>
            </article>

            <article className="app-card p-5">
              <h3 className="font-heading text-xl font-semibold text-[#111827]">Competitor Portal</h3>
              <p className="mt-2 text-sm text-slate-600">
                Track competition participation, votes received, ranks, and winner summaries.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link className="app-btn-primary px-4 py-2 text-center text-sm" to="/competitor/login">
                  Competitor Login
                </Link>
              </div>
            </article>
          </div>
        </section>

        <footer className="app-footer mt-8 px-1 py-4 text-center text-xs sm:text-sm">
          <p>Election Management System. Secure voting, transparent results.</p>
        </footer>
      </div>
    </main>
  );
}

export default HomePage;

import { Link } from "react-router-dom";
import { getSessionUser } from "../utils/session.js";

function NotFoundPage() {
  const user = getSessionUser();
  const backPath = user ? `/dashboard/${user.role}` : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-panel">
        <p className="font-heading text-6xl font-bold text-slate-900">404</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">The route you requested does not exist.</p>
        <Link
          className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          to={backPath}
        >
          Go back
        </Link>
      </section>
    </main>
  );
}

export default NotFoundPage;

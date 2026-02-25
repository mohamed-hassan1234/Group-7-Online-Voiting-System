import { Link } from "react-router-dom";

function AuthLayout({ title, subtitle, children, altText, altLink, altLabel }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="absolute -top-12 left-1/4 h-52 w-52 rounded-full bg-sky-300/45 blur-3xl" />
      <div className="absolute bottom-6 right-1/4 h-56 w-56 rounded-full bg-amber-300/45 blur-3xl" />

      <section className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-panel backdrop-blur sm:p-8">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
          Role Aware Auth
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

        <div className="mt-6">{children}</div>

        <p className="mt-6 text-center text-sm text-slate-600">
          {altText}{" "}
          <Link className="font-semibold text-sky-700 hover:text-sky-900" to={altLink}>
            {altLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}

export default AuthLayout;

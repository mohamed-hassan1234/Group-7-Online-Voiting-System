import { Link } from "react-router-dom";

function AuthLayout({ title, subtitle, children, altText, altLink, altLabel }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4 py-8 sm:px-6">
      <div className="absolute -top-10 left-1/4 h-52 w-52 rounded-full bg-slate-300/35 blur-3xl" />
      <div className="absolute bottom-8 right-1/4 h-56 w-56 rounded-full bg-teal-200/45 blur-3xl" />

      <section className="relative z-10 w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-panel sm:p-8">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.25em] text-slate-800">
          Online Voting System
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold text-[#111827]">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

        <div className="mt-6">{children}</div>

        <p className="mt-6 text-center text-sm text-slate-600">
          {altText}{" "}
          <Link className="app-link-accent font-semibold" to={altLink}>
            {altLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}

export default AuthLayout;

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { loginVoter } from "../api/authApi.js";
import { saveSession } from "../utils/session.js";

function VoterLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    password: "",
  });
  const [statusMessage, setStatusMessage] = useState(location.state?.message || "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await loginVoter(formData);
      saveSession(response.voter);
      navigate("/voter/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Voter Login"
      subtitle="Login and vote one competitor in each election."
      altText="No voter account?"
      altLink="/voter/register"
      altLabel="Voter Register"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Password</span>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>

        {statusMessage ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          className="w-full rounded-xl bg-sky-700 px-4 py-2.5 font-medium text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Voter Login"}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-slate-500">
        <Link className="underline hover:text-slate-700" to="/admin/login">
          Are you admin? Go to admin login
        </Link>
      </div>
    </AuthLayout>
  );
}

export default VoterLoginPage;

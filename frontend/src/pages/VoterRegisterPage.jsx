import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { registerVoter } from "../api/authApi.js";

function VoterRegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      await registerVoter(formData);
      navigate("/voter/login", {
        replace: true,
        state: {
          email: formData.email,
          message: "Registration submitted. Wait for admin approval before login.",
        },
      });
    } catch (error) {
      if (String(error.message).toLowerCase().includes("email already exists")) {
        navigate("/voter/login", {
          replace: true,
          state: {
            email: formData.email,
            message: "Voter already exists. Please login.",
          },
        });
        return;
      }

      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Voter Register"
      subtitle="Create voter account. Admin approval is required before login."
      altText="Already have voter account?"
      altLink="/voter/login"
      altLabel="Voter Login"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Full Name</span>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </label>

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
            minLength={6}
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>

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
          {isLoading ? "Creating voter..." : "Register Voter"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default VoterRegisterPage;

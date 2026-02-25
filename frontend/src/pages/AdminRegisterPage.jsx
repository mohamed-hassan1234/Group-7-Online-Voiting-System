import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { registerUser } from "../api/authApi.js";

function AdminRegisterPage() {
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
      await registerUser({ ...formData, role: "admin" });
      navigate("/admin/login", {
        replace: true,
        state: {
          email: formData.email,
          message: "Admin registration complete. Login now.",
        },
      });
    } catch (error) {
      if (String(error.message).toLowerCase().includes("email already exists")) {
        navigate("/admin/login", {
          replace: true,
          state: {
            email: formData.email,
            message: "Admin already exists. Please login.",
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
      title="Admin Register"
      subtitle="Create an admin account to manage competitors and elections."
      altText="Already have admin account?"
      altLink="/admin/login"
      altLabel="Admin Login"
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
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Creating admin..." : "Register Admin"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default AdminRegisterPage;

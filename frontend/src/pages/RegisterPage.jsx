import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAvailableRoles, registerUser } from "../api/authApi.js";
import AuthLayout from "../components/AuthLayout.jsx";

function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
  });

  const [roles, setRoles] = useState([]);
  const [defaultRole, setDefaultRole] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchAvailableRoles();
        setRoles(data.roles || []);
        setDefaultRole(data.defaultRole || "");
        setFormData((prev) => ({ ...prev, role: data.defaultRole || "" }));
      } catch (error) {
        setErrorMessage(error.message);
      }
    };

    loadRoles();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      await registerUser(formData);
      navigate("/login", {
        replace: true,
        state: {
          email: formData.email,
          message: "Registration complete. Login to continue.",
        },
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="The role list comes from backend constants, so frontend stays synced automatically."
      altText="Already have an account?"
      altLink="/login"
      altLabel="Login"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Full Name</span>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="name"
            type="text"
            placeholder="Your name"
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
            placeholder="name@example.com"
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
            placeholder="At least 6 characters"
            minLength={6}
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Role {defaultRole ? `(default: ${defaultRole})` : ""}
          </span>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
          >
            {roles.length === 0 ? <option value="">Loading roles...</option> : null}
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        {errorMessage && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          className="w-full rounded-xl bg-sky-700 px-4 py-2.5 font-medium text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isLoading || roles.length === 0}
        >
          {isLoading ? "Creating account..." : "Register"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;

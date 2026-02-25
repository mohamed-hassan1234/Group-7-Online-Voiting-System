import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminRegisterPage from "./pages/AdminRegisterPage.jsx";
import CompetitorDashboardPage from "./pages/CompetitorDashboardPage.jsx";
import CompetitorLoginPage from "./pages/CompetitorLoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import VoterDashboardPage from "./pages/VoterDashboardPage.jsx";
import VoterLoginPage from "./pages/VoterLoginPage.jsx";
import VoterRegisterPage from "./pages/VoterRegisterPage.jsx";
import { getSessionUser } from "./utils/session.js";

const redirectByRole = (user) => {
  if (!user) {
    return "/";
  }

  if (user.role === "admin") {
    return "/admin/dashboard";
  }

  if (user.role === "competitor") {
    return "/competitor/dashboard";
  }

  return "/voter/dashboard";
};

const RoleProtectedRoute = ({ allowedRole, children }) => {
  const user = getSessionUser();
  if (!user) {
    if (allowedRole === "admin") {
      return <Navigate to="/admin/login" replace />;
    }

    if (allowedRole === "competitor") {
      return <Navigate to="/competitor/login" replace />;
    }

    return <Navigate to="/voter/login" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={redirectByRole(user)} replace />;
  }

  return children;
};

const GuestRoute = ({ children }) => {
  const user = getSessionUser();
  if (user) {
    return <Navigate to={redirectByRole(user)} replace />;
  }

  return children;
};

const LegacyRedirect = () => <Navigate to={redirectByRole(getSessionUser())} replace />;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/admin/register"
          element={
            <GuestRoute>
              <AdminRegisterPage />
            </GuestRoute>
          }
        />

        <Route
          path="/admin/login"
          element={
            <GuestRoute>
              <AdminLoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/voter/register"
          element={
            <GuestRoute>
              <VoterRegisterPage />
            </GuestRoute>
          }
        />

        <Route
          path="/voter/login"
          element={
            <GuestRoute>
              <VoterLoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/competitor/login"
          element={
            <GuestRoute>
              <CompetitorLoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/elections"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/candidates"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/live-results"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/final-results"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/voters"
          element={
            <RoleProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/voter/dashboard"
          element={
            <RoleProtectedRoute allowedRole="user">
              <VoterDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/voter/elections"
          element={
            <RoleProtectedRoute allowedRole="user">
              <VoterDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/voter/live-results"
          element={
            <RoleProtectedRoute allowedRole="user">
              <VoterDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/voter/final-results"
          element={
            <RoleProtectedRoute allowedRole="user">
              <VoterDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/voter/profile"
          element={
            <RoleProtectedRoute allowedRole="user">
              <VoterDashboardPage />
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/competitor/dashboard"
          element={
            <RoleProtectedRoute allowedRole="competitor">
              <CompetitorDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/competitor/competitions"
          element={
            <RoleProtectedRoute allowedRole="competitor">
              <CompetitorDashboardPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/competitor/profile"
          element={
            <RoleProtectedRoute allowedRole="competitor">
              <CompetitorDashboardPage />
            </RoleProtectedRoute>
          }
        />

        {/* Legacy routes kept for compatibility with older links */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard/:role" element={<LegacyRedirect />} />
        <Route path="/dashboard" element={<LegacyRedirect />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

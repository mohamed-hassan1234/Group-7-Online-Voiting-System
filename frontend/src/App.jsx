import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import Votes from "./dashboards/Votes.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import { getSessionUser } from "./utils/session.js";
import FinalResultsPage from './dashboards/FinalResultsPage.jsx'
const ProtectedRoute = ({ children }) => {
  const user = getSessionUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const GuestRoute = ({ children }) => {
  const user = getSessionUser();
  if (user) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  return children;
};

const getHomePath = () => {
  const user = getSessionUser();
  return user ? `/dashboard/${user.role}` : "/login";
};

const DashboardRootRedirect = () => {
  const user = getSessionUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/dashboard/${user.role}`} replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={getHomePath()} replace />} />
        <Route path="/votes" element={<Votes to={getHomePath()} replace />} />  

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />

           <Route
          path="/FinalResultsPage"
          element={
            
              <FinalResultsPage />
           
          }
        />

        <Route
          path="/dashboard/:role"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* One dashboard route works for all roles, plus /dashboard auto-redirects. */}
        <Route path="/dashboard" element={<DashboardRootRedirect />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

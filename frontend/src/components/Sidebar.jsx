import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Vote,
  Users,
  UserCheck,
  BarChart,
  Trophy,
  User,
  LogOut
} from "lucide-react";

function Sidebar() {
  const linkClass =
    "flex items-center gap-3 p-3 rounded-lg hover:bg-blue-500 hover:text-white transition";

  return (
    <div className="w-64 h-screen p-4 bg-white shadow-lg">
      <h2 className="mb-8 text-xl font-bold">Admin</h2>

      <nav className="space-y-2">
        <NavLink to="/" className={linkClass}>
          <LayoutDashboard size={18} /> Dashboard
        </NavLink>

        <NavLink to="/elections" className={linkClass}>
          <Vote size={18} /> Elections
        </NavLink>

        <NavLink to="/candidates" className={linkClass}>
          <UserCheck size={18} /> Candidates
        </NavLink>

        <NavLink to="/votes" className={linkClass}>
          <BarChart size={18} /> Votes
        </NavLink>

        <NavLink to="/live-results" className={linkClass}>
          <BarChart size={18} /> Live Results
        </NavLink>

        <NavLink to="/final-results" className={linkClass}>
          <Trophy size={18} /> Final Results
        </NavLink>

        <NavLink to="/profile" className={linkClass}>
          <User size={18} /> Profile
        </NavLink>

         <NavLink to="/logout" className={linkClass}>
          <LogOut size={18} /> Logout
        </NavLink>
      </nav>
    </div>
  );
}

export default Sidebar;
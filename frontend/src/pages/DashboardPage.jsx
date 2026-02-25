import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { getSessionUser } from "../utils/session.js";

import AdminDashboard from "../dashboards/AdminDashboard.jsx";
import ManagerDashboard from "../dashboards/ManagerDashboard.jsx";

import CashierDashboard from "../dashboards/CashierDashboard.jsx";
import User from "../dashboards/User.jsx";

const DashboardPage = () => {
  const { role } = useParams();        // role from URL
  const user = getSessionUser();       // user from session

  // not logged in
  if (!user) return <Navigate to="/login" replace />;

  // user tries to open different role dashboard
  if (user.role !== role) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  // ✅ role dashboards (if / else if)
  if (role === "admin") return <AdminDashboard />;
  else if (role === "manager") return <ManagerDashboard />;
  
  else if (role === "cashier") return <CashierDashboard />;
  else if (role ==="user") return <User/>
  // fallback if role not found
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>No dashboard for this role: <b>{role}</b></p>
    </div>
  );
};

export default DashboardPage;
import React from "react";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../utils/session.js";

const CashierDashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession(); // remove user from storage
    navigate("/login", { replace: true }); // redirect to login
  };

  return (
    <div >
      <div >
        <h1 >Cashier Dashboard</h1>

        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      <div className="mt-6">
        <p>Welcome Cashier ✅</p>
      </div>
    </div>
  );
};

export default CashierDashboard;
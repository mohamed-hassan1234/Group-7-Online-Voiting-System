import React from "react";

function Votes() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-gray-500 font-semibold">
          ADMINISTRATION
          <br />
          <span className="text-2xl text-gray-900 font-bold">
            Control Panel
          </span>
        </h1>
      </div>

      {/* Page Title */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Votes Audit
        </h2>

        {/* Filters */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="All elections"
            className="px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            className="px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <p className="text-sm text-gray-500 mb-4">
          Showing 3 vote records
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-gray-600 text-sm border-b">
                <th className="py-3 font-semibold">Voter</th>
                <th className="py-3 font-semibold">Election</th>
                <th className="py-3 font-semibold">Candidate</th>
                <th className="py-3 font-semibold">Timestamp</th>
                <th className="py-3 font-semibold">IP Address</th>
                <th className="py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-b hover:bg-gray-50 transition">
                <td className="py-4">
                  <p className="font-medium text-gray-900">Mohamed</p>
                  <p className="text-sm text-gray-500">moh@gmail.com</p>
                </td>
                <td className="py-4 text-gray-800">Gudomiye</td>
                <td className="py-4 text-gray-800">Axmed</td>
                <td className="py-4 text-gray-800">
                  25 Feb 2026, 09:39
                </td>
                <td className="py-4 text-gray-800">192.168.1.1</td>
                <td className="py-4 text-center">
                  <button className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
}

export default Votes;
import React from "react";

function Elections() {
  return (
    <div className="min-h-screen p-6 bg-gray-100">
      {/* Page Title */}
      <h1 className="mb-8 text-3xl font-bold text-gray-800">
        Elections Management
      </h1>

      {/* Add Election Form */}
      <div className="w-full max-w-5xl p-8 mx-auto mb-12 bg-white shadow-xl rounded-2xl">
        <h2 className="mb-6 text-2xl font-semibold text-gray-700">
          Add Election
        </h2>

        <form className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Election Name */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-600">
              Election Name
            </label>
            <input
              type="text"
              placeholder="Enter election name"
              className="px-4 py-3 transition border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Photo */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-600">
              Photo
            </label>
            <input
              type="file"
              className="px-4 py-3 transition border rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Start Date */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-600">
              Start Date
            </label>
            <input
              type="date"
              className="px-4 py-3 transition border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-600">
              End Date
            </label>
            <input
              type="date"
              className="px-4 py-3 transition border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col md:col-span-2">
            <label className="mb-2 text-sm font-medium text-gray-600">
              Description
            </label>
            <textarea
              placeholder="Short description"
              className="w-full px-4 py-3 transition border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              required
            />
          </div>

          {/* Submit Button */}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-3 font-semibold text-white transition duration-300 bg-blue-600 rounded-xl hover:bg-blue-700"
            >
              Create Election
            </button>
          </div>
        </form>
      </div>

      {/* View Elections Section */}
      <div className="max-w-6xl mx-auto">
        {/* Search + Filter */}
        <div className="flex flex-col items-center justify-between gap-4 mb-6 md:flex-row">
          <input
            type="text"
            placeholder="Search elections..."
            className="w-full px-4 py-2 border rounded-lg md:w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select className="w-full px-4 py-2 border rounded-lg md:w-1/4 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>All Elections</option>
            <option>Active Elections</option>
            <option>Past Elections</option>
          </select>
        </div>

        {/* Elections Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card */}
          <div className="overflow-hidden transition bg-white shadow-lg rounded-2xl hover:shadow-xl">
            <img
              src="data:image/jpeg;base64,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"
              alt="Election"
              className="object-cover w-full h-40"
            />

            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-700">
                  Godoomiyo Kooxeed
                </h2>
                <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  Ongoing
                </span>
              </div>

              <p className="mb-2 text-sm text-gray-500">
                Start: 2024-01-01
              </p>
              <p className="mb-4 text-sm text-gray-500">
                End: 2024-01-15
              </p>

              <div className="flex gap-3">
                <button className="w-full py-2 text-sm font-medium text-white transition bg-yellow-500 rounded-lg hover:bg-yellow-600">
                  Edit
                </button>
                <button className="w-full py-2 text-sm font-medium text-white transition bg-red-500 rounded-lg hover:bg-red-600">
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Card two */}
                    <div className="overflow-hidden transition bg-white shadow-lg rounded-2xl hover:shadow-xl">
            <img
              src="data:image/jpeg;base64,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"
              alt="Election"
              className="object-cover w-full h-40"
            />

            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-700">
                  Godoomiyo Kooxeed
                </h2>
                <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  Ongoing
                </span>
              </div>

              <p className="mb-2 text-sm text-gray-500">
                Start: 2024-01-01
              </p>
              <p className="mb-4 text-sm text-gray-500">
                End: 2024-01-15
              </p>

              <div className="flex gap-3">
                <button className="w-full py-2 text-sm font-medium text-white transition bg-yellow-500 rounded-lg hover:bg-yellow-600">
                  Edit
                </button>
                <button className="w-full py-2 text-sm font-medium text-white transition bg-red-500 rounded-lg hover:bg-red-600">
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* card 3 */}
                    <div className="overflow-hidden transition bg-white shadow-lg rounded-2xl hover:shadow-xl">
            <img
              src="data:image/jpeg;base64,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"
              alt="Election"
              className="object-cover w-full h-40"
            />

            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-700">
                  Godoomiyo Kooxeed
                </h2>
                <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  Ongoing
                </span>
              </div>

              <p className="mb-2 text-sm text-gray-500">
                Start: 2024-01-01
              </p>
              <p className="mb-4 text-sm text-gray-500">
                End: 2024-01-15
              </p>

              <div className="flex gap-3">
                <button className="w-full py-2 text-sm font-medium text-white transition bg-yellow-500 rounded-lg hover:bg-yellow-600">
                  Edit
                </button>
                <button className="w-full py-2 text-sm font-medium text-white transition bg-red-500 rounded-lg hover:bg-red-600">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Elections;
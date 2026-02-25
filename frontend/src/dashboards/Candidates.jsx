import { useMemo, useState } from "react";
import {
  Plus,
  LayoutGrid,
  Table2,
  Pencil,
  Trash2,
} from "lucide-react";

export default function CandidatesPage() {
  const [name, setName] = useState("");
  const [election, setElection] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cards");

  const [candidates, setCandidates] = useState([
    {
      id: 1,
      name: "Nuux Ali",
      votes: 0,
      description: "Cusub",
      photo: null,
      election: "General election",
    },
    {
      id: 2,
      name: "Ahmed",
      votes: 1,
      description: "Welcome",
      photo: null,
      election: "General election",
    },
  ]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [candidates, search]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !election) return;

    setCandidates((prev) => [
      ...prev,
      {
        id: Date.now(),
        name,
        election,
        description,
        votes: 0,
        photo,
      },
    ]);

    setName("");
    setElection("");
    setDescription("");
    setPhoto(null);
  };

  const handleDelete = (id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Candidates Management
        </h1>
      </div>

      {/* Add Candidate Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Add Candidate
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Candidate name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Candidate Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="Candidate name"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
            />
          </div>

          {/* Election */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Election
            </label>
            <select
              value={election}
              onChange={(e) => setElection(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
            >
              <option value="">Select election</option>
              <option>General election</option>
              <option>Local election</option>
            </select>
          </div>

          {/* Photo */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Photo
            </label>

            <input
              type="file"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="block w-full text-sm rounded-lg border border-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none"
            />
          </div>

          {/* Button */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
            >
              <Plus size={16} />
              Create Candidate
            </button>
          </div>
        </form>
      </div>

      {/* Search + toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          placeholder="Search candidates..."
          className="w-full md:max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
        />

        <div className="flex items-center gap-4 text-sm font-medium">
          <button
            onClick={() => setView("cards")}
            className={`flex items-center gap-2 ${
              view === "cards"
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid size={16} />
            Cards
          </button>

          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-2 ${
              view === "table"
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Table2 size={16} />
            Table
          </button>
        </div>
      </div>

      {/* Cards View */}
      {view === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              onDelete={handleDelete}
            />
          ))}

          {filteredCandidates.length === 0 && (
            <div className="col-span-full text-center text-sm text-gray-500 py-10">
              No candidates found.
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Election
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Votes
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCandidates.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">
                    {c.name}
                  </td>
                  <td className="px-4 py-3">
                    {c.election}
                  </td>
                  <td className="px-4 py-3">
                    {c.votes}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredCandidates.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    No candidates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Card component ---------- */

function CandidateCard({ candidate, onDelete }) {
  const [preview, setPreview] = useState(null);

  if (candidate.photo && !preview) {
    const url = URL.createObjectURL(candidate.photo);
    setPreview(url);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt={candidate.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-gray-500">
              {candidate.name?.charAt(0)}
            </span>
          )}
        </div>

        <div>
          <p className="font-semibold text-gray-900 leading-tight">
            {candidate.name}
          </p>
          <p className="text-sm text-gray-500">
            Votes: {candidate.votes}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">
        {candidate.description || "No description"}
      </p>

      <div className="flex items-center gap-4 pt-2">
        <button className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
          <Pencil size={14} />
          Edit
        </button>

        <button
          onClick={() => onDelete(candidate.id)}
          className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
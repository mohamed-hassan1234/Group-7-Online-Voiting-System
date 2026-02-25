import React from 'react';
import { Trophy, ChevronDown, Download } from 'lucide-react';

const FinalResultsPage = () => {
  const data = [
    { rank: 1, name: 'Anas', votes: 1, percentage: '100.0%', status: 'Winner' },
    { rank: 2, name: 'Ibrahim', votes: 0, percentage: '0.0%', status: 'Loser' },
  ];

  const winner = data.find((item) => item.status === 'Winner');

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6 bg-[#f8f9fa] min-h-screen">
      <h2 className="text-3xl font-bold text-slate-900">Final Results</h2>

      {/* Candidate Selector */}
      <div className="relative w-full md:w-96">
        <select className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-5 py-3.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all cursor-pointer text-slate-700">
          <option>Mohamed</option>
        </select>
        <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
      </div>

      {/* Winner Hero Card */}
      <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex flex-col items-start gap-5">
          <span className="bg-[#0f172a] text-white text-[11px] font-bold px-4 py-2 rounded-full flex items-center gap-2 uppercase tracking-tight">
            <Trophy size={14} fill="currentColor" /> Winner
          </span>
          
          <div className="flex items-center gap-8 mt-2">
            {/* Profile Image Placeholder */}
            <div className="w-28 h-28 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden">
               <img 
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${winner.name}`} 
                alt="Winner Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{winner.name}</h3>
              <p className="text-gray-500 text-xl font-medium">
                {winner.votes} votes <span className="text-gray-400">({winner.percentage})</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table Card */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-xl font-bold text-slate-900">Results Table</h3>
          <button className="bg-[#2563eb] hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20">
            <Download size={18} /> Export Results
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-gray-50">
                <th className="pb-6 font-semibold uppercase tracking-wider">Rank</th>
                <th className="pb-6 font-semibold uppercase tracking-wider">Candidate</th>
                <th className="pb-6 font-semibold uppercase tracking-wider text-center">Votes</th>
                <th className="pb-6 font-semibold uppercase tracking-wider text-center">Percentage</th>
                <th className="pb-6 font-semibold uppercase tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((row) => (
                <tr key={row.rank} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="py-6 font-bold text-slate-800">#{row.rank}</td>
                  <td className="py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200">
                        <img 
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${row.name}`} 
                          className="w-8 h-8 opacity-60" 
                          alt="" 
                        />
                      </div>
                      <span className="font-bold text-slate-900 text-lg">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-6 font-bold text-slate-700 text-center text-lg">{row.votes}</td>
                  <td className="py-6 font-bold text-slate-700 text-center text-lg">{row.percentage}</td>
                  <td className="py-6 text-right">
                    <span className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                      row.status === 'Winner' 
                      ? 'bg-[#e2e8f0] text-slate-600' 
                      : 'bg-[#fef2f2] text-[#f87171]'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinalResultsPage;
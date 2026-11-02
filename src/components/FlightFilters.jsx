// Komponen Pencarian dan Filter Pesawat OpenSky (Task-10)
import React from 'react';

export default function FlightFilters({ searchQuery, setSearchQuery, statusFilter, setStatusFilter, totalCount }) {
  return (
    <div className="space-y-3 p-3 bg-slate-900/60 border-b border-slate-800/80 text-xs">
      {/* Input Pencarian */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari callsign, ICAO24, atau negara..."
          className="w-full rounded-lg bg-slate-950/80 px-3 py-2 text-slate-200 placeholder-slate-500 border border-slate-800 focus:border-teal-500 focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            title="Reset pencarian"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Status (All / Airborne / Ground) & Jumlah */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800/80">
          {[
            { id: 'all', label: 'All' },
            { id: 'airborne', label: 'Airborne' },
            { id: 'ground', label: 'Ground' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          {totalCount} pesawat
        </span>
      </div>
    </div>
  );
}
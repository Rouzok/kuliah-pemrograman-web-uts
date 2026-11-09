// Komponen Tabel Pesawat OpenSky untuk Live Map (Task-09)
import React from 'react';
import { formatAltitude, formatSpeed, formatCallsign, formatFlightStatus } from '../utils/aircraft';

export default function FlightTable({ flights = [], onSelectFlight, savedIds = [], onToggleSave }) {
  if (!flights || flights.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-400">
        Tidak ada pesawat yang termuat dalam viewport saat ini.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto border border-slate-800 rounded-lg">
      <table className="w-full text-left border-collapse text-xs text-slate-300">
        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider z-10">
          <tr>
            <th className="p-2.5 font-semibold">Flight</th>
            <th className="p-2.5 font-semibold">Country</th>
            <th className="p-2.5 font-semibold text-right">Alt (ft)</th>
            <th className="p-2.5 font-semibold text-right">Spd (kt)</th>
            <th className="p-2.5 font-semibold">Status</th>
            <th className="p-2.5 font-semibold text-center">Save</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {flights.map((flight) => {
            const callsignDisplay = formatCallsign(flight.callsign, flight.icao24);
            const altDisplay = formatAltitude(flight.baro_altitude ?? flight.geo_altitude);
            const spdDisplay = formatSpeed(flight.velocity);
            const statusDisplay = formatFlightStatus(flight.on_ground);
            const isSaved = savedIds.includes(flight.icao24?.toLowerCase());

            return (
              <tr 
                key={flight.icao24} 
                onClick={() => onSelectFlight && onSelectFlight(flight)}
                className="hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <td className="p-2.5 font-medium text-teal-300">{callsignDisplay}</td>
                <td className="p-2.5 text-slate-400 truncate max-w-[80px]">{flight.origin_country || '—'}</td>
                <td className="p-2.5 text-right font-mono text-slate-300">{altDisplay}</td>
                <td className="p-2.5 text-right font-mono text-slate-300">{spdDisplay}</td>
                <td className="p-2.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    flight.on_ground 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {statusDisplay}
                  </span>
                </td>
                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleSave && onToggleSave(flight)}
                    className={`p-1 rounded hover:bg-slate-700 transition-colors ${
                      isSaved ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title={isSaved ? 'Hapus bookmark' : 'Simpan pesawat'}
                  >
                    {isSaved ? '★' : '☆'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
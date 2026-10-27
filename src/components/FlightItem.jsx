import React, { useState, useEffect } from 'react';
import { saveFlight, removeFlight, isFlightSaved } from '../utils/storage';

export default function FlightItem({ flight, onSelect }) {
  const [isSaved, setIsSaved] = useState(false);

  // Cek status bookmark saat komponen dimuat atau flight berubah
  useEffect(() => {
    if (flight?.id) {
      setIsSaved(isFlightSaved(flight.id));
    }
  }, [flight]);

  const handleBookmarkToggle = (e) => {
    // Mencegah event click merambat ke parent (agar tidak memicu onSelect baris penerbangan)
    e.stopPropagation();

    if (isSaved) {
      removeFlight(flight.id);
      setIsSaved(false);
    } else {
      saveFlight(flight);
      setIsSaved(true);
    }
  };

  return (
    <div
      onClick={() => onSelect && onSelect(flight)}
      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition-colors"
    >
      <div>
        <h4 className="text-sm font-semibold text-slate-200">{flight.code || flight.flight_iata || flight.flight_icao || flight.id}</h4>
        <p className="text-xs text-slate-400">{flight.airline}</p>
      </div>

      {/* Area Tombol Aksi */}
      <div className="flex items-center gap-2">
        {/* Tombol Open baru */}
        {onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Mencegah bentrok dengan klik baris
              onSelect(flight);
            }}
            className="text-xs px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md transition-colors"
          >
            Open
          </button>
        )}

        {/* Tombol Bookmark (Tetap seperti sebelumnya) */}
        <button
          onClick={handleBookmarkToggle}
          className={`p-2 rounded-md transition-colors ${
            isSaved
              ? 'text-teal-400 hover:text-teal-300'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title={isSaved ? 'Remove from saved' : 'Save flight'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 256 256">
            <path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.76,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Komponen Kontrol Kolom Tabel Pesawat (Task-11)
import React from 'react';

export default function FlightColumnToggle({ visibleColumns, setVisibleColumns }) {
  const columns = [
    { id: 'origin_country', label: 'Country' },
    { id: 'baro_altitude', label: 'Altitude' },
    { id: 'velocity', label: 'Speed' },
    { id: 'on_ground', label: 'Status' },
  ];

  const toggleColumn = (colId) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/40 border-b border-slate-800/80 text-xs">
      <span className="text-slate-400 font-medium">Kolom:</span>
      <div className="flex flex-wrap gap-1.5">
        {columns.map((col) => {
          const isVisible = visibleColumns[col.id] ?? true;
          return (
            <button
              key={col.id}
              onClick={() => toggleColumn(col.id)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                isVisible
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                  : 'bg-slate-950 text-slate-500 border border-slate-800 line-through'
              }`}
              title={isVisible ? 'Sembunyikan kolom' : 'Tampilkan kolom'}
            >
              {col.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
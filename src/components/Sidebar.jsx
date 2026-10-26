import React from 'react';

export default function Sidebar() {
  return (
    <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col z-10 shrink-0">
      {/* Header Branding */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-teal-400 animate-pulse" />
        <h1 className="text-xl font-bold tracking-wide text-teal-400">skytrace</h1>
      </div>

      {/* Area Konten Navigasi */}
      <div className="p-4 text-slate-400 text-sm">
        Area Navigasi Sidebar
      </div>
    </aside>
  );
}
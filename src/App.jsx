import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LiveMap from "./pages/LiveMap";
import Airports from "./pages/Airports";
import SavedFlights from "./pages/SavedFlights";

export default function App() {
  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* Wadah Sidebar (Sisi Kiri) */}
        <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-slate-800">
            <h1 className="text-xl font-bold text-teal-400">skytrace</h1>
          </div>
          <div className="p-4 text-slate-400 text-sm">Area Sidebar (Konten Navigasi)</div>
        </aside>

        {/* Wadah Map Utama (Sisi Kanan) */}
        <main className="flex-1 relative h-full bg-slate-950 flex items-center justify-center text-slate-500">
          <Routes>
            <Route path="/" element={<LiveMap />} />
            <Route path="/airports" element={<Airports />} />
            <Route path="/saved" element={<SavedFlights />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

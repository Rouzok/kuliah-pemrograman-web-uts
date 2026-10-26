import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LiveMap from './pages/LiveMap';
import Airports from './pages/Airports';
import SavedFlights from './pages/SavedFlights';

export default function App() {
  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* Komponen Sidebar */}
        <Sidebar />

        {/* Area Map Utama */}
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
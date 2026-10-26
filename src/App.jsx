import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import CompanyProfile from './pages/CompanyProfile';
import MapLayout from './layouts/MapLayout';
import Airports from './pages/Airports';
import SavedFlights from './pages/SavedFlights';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Halaman Landing / Company Profile */}
        <Route path="/" element={<CompanyProfile />} />

        {/* Aplikasi Map dengan Sidebar */}
        <Route path="/map" element={<MapLayout />}>
          <Route index element={<div className="text-slate-400 text-sm">Pilih penerbangan di peta untuk melihat detail.</div>} />
          <Route path="airports" element={<Airports />} />
          <Route path="saved" element={<SavedFlights />} />
        </Route>
      </Routes>
    </Router>
  );
}
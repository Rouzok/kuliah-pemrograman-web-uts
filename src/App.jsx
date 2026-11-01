import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import CompanyProfileLayout from './layouts/CompanyProfileLayout';
import AboutUs from './pages/AboutUs';
import ContactUs from './pages/ContactUs';
import MapLayout from './layouts/MapLayout';
import Airports from './pages/Airports';
import SavedFlights from './pages/SavedFlights';
import Flights from './pages/Flights';

const Home = lazy(() => import('./pages/Home'));

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Halaman Landing / Company Profile */}
        <Route path="/" element={<CompanyProfileLayout />}>
          <Route index element={<Suspense fallback={<p className="p-6">Loading Home…</p>}><Home /></Suspense>} />
          <Route path="about" element={<AboutUs />} />
          <Route path="contact" element={<ContactUs />} />
        </Route>

        {/* Aplikasi Map dengan Sidebar */}
        <Route path="/map" element={<MapLayout />}>
          <Route index element={<Flights />} />
          <Route path="airports" element={<Airports />} />
          <Route path="saved" element={<SavedFlights />} />
        </Route>
      </Routes>
    </Router>
  );
}

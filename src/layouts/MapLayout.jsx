import React from 'react';
import Sidebar from '../components/Sidebar';

export default function MapLayout() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      {/* LAYER 1: Peta Full Screen */}
      <main className="absolute inset-0 z-0 bg-slate-800">
        <div className="flex h-full w-full items-center justify-center text-slate-500">
          (Area Peta Leaflet/Mapbox)
        </div>
      </main>

      {/* LAYER 2: Sidebar Floating */}
      <div className="absolute left-0 top-0 z-10 h-full pointer-events-none">
        <div className="h-full pointer-events-auto shadow-2xl">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
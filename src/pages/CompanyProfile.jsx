import React from 'react';
import { Link } from 'react-router-dom';

export default function CompanyProfile() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Halaman Company Profile</h1>
      
      {/* Gunakan Link dari react-router-dom alih-alih tag <a> agar pindah halaman tidak loading ulang */}
      <Link 
        to="/map" 
        className="rounded bg-teal-500 px-4 py-2 text-slate-900 font-semibold hover:bg-teal-400 transition"
      >
        Buka Aplikasi Map
      </Link>
    </div>
  );
}
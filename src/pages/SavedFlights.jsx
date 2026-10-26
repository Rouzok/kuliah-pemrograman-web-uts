import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSavedFlights } from '../utils/storage';
import FlightItem from '../components/FlightItem';

export default function SavedFlights() {
  const [savedFlights, setSavedFlights] = useState([]);
  const navigate = useNavigate();

  const loadFlights = () => {
    setSavedFlights(getSavedFlights());
  };

  useEffect(() => {
    loadFlights();
    window.addEventListener('bookmarksUpdated', loadFlights);
    return () => {
      window.removeEventListener('bookmarksUpdated', loadFlights);
    };
  }, []);

  const handleOpenFlight = (flight) => {
    navigate('/map', { state: { selectedFlightId: flight.id } });
  };

  return (
    <div className="flex flex-col p-4 h-full">
      {savedFlights.length > 0 ? (
        // Jika ada data, tampilkan daftarnya
        <div className="flex flex-col gap-3">
          {savedFlights.map((flight) => (
            <FlightItem 
              key={flight.id} 
              flight={flight} 
              onSelect={handleOpenFlight} 
            />
          ))}
        </div>
      ) : (
        // Jika kosong (Empty State), tampilkan pesan dan ikon
        <div className="flex flex-col items-center justify-center mt-24 text-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="64" 
            height="64" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            className="text-slate-600 mb-4" 
            viewBox="0 0 256 256"
          >
            <path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.76,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-300">Belum ada penerbangan</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-[200px]">
            Penerbangan yang kamu simpan dari peta akan muncul di sini.
          </p>
        </div>
      )}
    </div>
  );
}
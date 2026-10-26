import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import navigasi
import { getSavedFlights } from '../utils/storage';
import FlightItem from '../components/FlightItem';

export default function SavedFlights() {
  const [savedFlights, setSavedFlights] = useState([]);
  const navigate = useNavigate(); // Inisialisasi fungsi navigasi

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

  // Fungsi untuk pindah ke map
  const handleOpenFlight = (flight) => {
    // Arahkan ke rute map (biasanya '/map' atau '/'). Sesuaikan jika rute map kamu berbeda!
    navigate('/map', { state: { selectedFlightId: flight.id } });
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {savedFlights.map((flight) => (
        <FlightItem 
          key={flight.id} 
          flight={flight} 
          onSelect={handleOpenFlight} // Kirim fungsi ke FlightItem
        />
      ))}
    </div>
  );
}
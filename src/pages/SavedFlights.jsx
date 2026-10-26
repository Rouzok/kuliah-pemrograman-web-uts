import React, { useState, useEffect } from 'react';
import { getSavedFlights } from '../utils/storage';
import FlightItem from "../components/FlightItem";

export default function SavedFlights() {
  const [savedFlights, setSavedFlights] = useState([]);

  // Fungsi untuk memuat ulang data dari localStorage
  const loadFlights = () => {
    setSavedFlights(getSavedFlights());
  };

  useEffect(() => {
    // Muat data saat komponen pertama kali dirender
    loadFlights();

    // Pasang pendengar sinyal dari storage.js (Langkah 3.4)
    window.addEventListener('bookmarksUpdated', loadFlights);

    // Bersihkan pendengar saat komponen ditutup/pindah tab
    return () => {
      window.removeEventListener('bookmarksUpdated', loadFlights);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4">
      {savedFlights.map((flight) => (
        <FlightItem key={flight.id} flight={flight} />
      ))}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSavedFlights } from '../utils/storage';
import FlightItem from '../components/FlightItem';
import { getSavedFlightIdentifier } from '../api/client.js';

export default function SavedFlights() {
  const [savedFlights, setSavedFlights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openError, setOpenError] = useState(null);
  const navigate = useNavigate();

  const loadFlights = () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = getSavedFlights();
      // Validasi: pastikan data dari storage adalah array
      if (!Array.isArray(data)) {
        throw new Error("Data penerbangan tidak valid.");
      }
      setSavedFlights(data);
    } catch (err) {
      console.error("Error loading flights:", err);
      setError("Gagal memuat data. Penyimpanan lokal mungkin bermasalah.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlights();
    window.addEventListener('bookmarksUpdated', loadFlights);
    return () => {
      window.removeEventListener('bookmarksUpdated', loadFlights);
    };
  }, []);

  const handleOpenFlight = (flight) => {
    try {
      const openSavedFlight = getSavedFlightIdentifier(flight);
      setOpenError(null);
      navigate('/map', { state: { openSavedFlight } });
    } catch {
      setOpenError('Identitas penerbangan ini belum memiliki kode dan jenis IATA/ICAO yang valid. Simpan ulang dari data penerbangan. Bookmark tetap tersimpan.');
    }
  };

  // Tampilan saat proses Loading
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  // Tampilan saat terjadi Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center mt-24 text-center p-4">
        <div className="text-red-500 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"></path>
          </svg>
        </div>
        <p className="text-sm text-slate-300">{error}</p>
        <button 
          onClick={loadFlights}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-xs transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 h-full">
      {openError && <p role="alert" className="mb-4 text-sm text-amber-300">{openError}</p>}
      {savedFlights.length > 0 ? (
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
        <div className="flex flex-col items-center justify-center mt-24 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600 mb-4" viewBox="0 0 256 256">
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

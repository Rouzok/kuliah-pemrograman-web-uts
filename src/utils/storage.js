const STORAGE_KEY = 'skytrace_saved_flights';

// Fungsi internal untuk memicu sinyal/alarm ke seluruh aplikasi
const notifyChange = () => {
  window.dispatchEvent(new Event('bookmarksUpdated'));
};

export const getSavedFlights = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse saved flights:', error);
    // Lempar error agar bisa ditangkap oleh komponen UI (SavedFlights.jsx)
    throw new Error("Data penyimpanan lokal bermasalah atau rusak."); 
  }
};

export const saveFlight = (flight) => {
  try {
    const currentFlights = getSavedFlights();
    const isExist = currentFlights.some((item) => item.id === flight.id);
    
    if (!isExist) {
      const updatedFlights = [...currentFlights, flight];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFlights));
      notifyChange(); // Panggil sinyal update
      return updatedFlights;
    }
    return currentFlights;
  } catch (error) {
    console.error('Failed to save flight to localStorage:', error);
    return [];
  }
};

export const removeFlight = (id) => {
  try {
    const currentFlights = getSavedFlights();
    const updatedFlights = currentFlights.filter((flight) => flight.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFlights));
    notifyChange(); // Panggil sinyal update
    return updatedFlights;
  } catch (error) {
    console.error('Failed to remove flight from localStorage:', error);
    return [];
  }
};

export const isFlightSaved = (id) => {
  try {
    const currentFlights = getSavedFlights();
    return currentFlights.some((flight) => flight.id === id);
  } catch (error) {
    return false;
  }
};
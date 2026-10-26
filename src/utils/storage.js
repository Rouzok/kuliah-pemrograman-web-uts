const STORAGE_KEY = 'skytrace_saved_flights';

// Mengambil semua daftar penerbangan tersimpan
export const getSavedFlights = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get saved flights from localStorage:', error);
    return [];
  }
};

// Menambahkan penerbangan baru ke localStorage
export const saveFlight = (flight) => {
  try {
    const currentFlights = getSavedFlights();
    // Cek apakah penerbangan sudah ada berdasarkan id
    const isExist = currentFlights.some((item) => item.id === flight.id);
    
    if (!isExist) {
      const updatedFlights = [...currentFlights, flight];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFlights));
      return updatedFlights;
    }
    return currentFlights;
  } catch (error) {
    console.error('Failed to save flight to localStorage:', error);
    return [];
  }
};

// Menghapus penerbangan dari localStorage berdasarkan id
export const removeFlight = (id) => {
  try {
    const currentFlights = getSavedFlights();
    const updatedFlights = currentFlights.filter((flight) => flight.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFlights));
    return updatedFlights;
  } catch (error) {
    console.error('Failed to remove flight from localStorage:', error);
    return [];
  }
};
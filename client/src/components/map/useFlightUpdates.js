import { useEffect, useRef, useState, useCallback } from 'react';
import { getFlights as defaultGetFlights } from '../../api/client.js';
import { getViewportBounds } from './mapBounds.js';
import { createFlightUpdateController } from './flightUpdatesController.js';

/**
 * React Hook for the 30-second live flight updates loop (Task-12).
 *
 * @param {object} options
 * @param {import('maplibre-gl').Map|null} options.mapInstance - Current MapLibre instance
 * @param {boolean} [options.enabled=true] - Whether updates are currently enabled (e.g. on /map route)
 * @param {Function} [options.getFlights] - Injected API client for testing or custom origin
 */
export function useFlightUpdates({
  mapInstance = null,
  enabled = true,
  getFlights = defaultGetFlights,
} = {}) {
  const [flights, setFlights] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);
  const mapRef = useRef(mapInstance);
  mapRef.current = mapInstance;

  useEffect(() => {
    const isOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);
    const isVisible = () => (typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);

    const controller = createFlightUpdateController({
      getBounds: () => getViewportBounds(mapRef.current),
      getFlights,
      onData: (payload) => {
        setFlights(payload.data);
        setMeta(payload.meta);
        setIsStale(false);
        setError(null);
      },
      onError: (err) => {
        setIsStale(true); // Retain previous records with stale indication (F-03)
        setError(err);
      },
      onPending: (pending) => {
        setIsPending(pending);
      },
    });

    controllerRef.current = controller;

    function evaluateEligibility() {
      const eligible = enabled && isOnline() && isVisible();
      controller.setEligibility(eligible);
    }

    // Initial evaluation & first fetch on entry (F-03)
    evaluateEligibility();
    if (enabled && isOnline() && isVisible()) {
      controller.update(false);
    }

    const handleVisibility = () => evaluateEligibility();
    const handleOnline = () => evaluateEligibility();
    const handleOffline = () => evaluateEligibility();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      controller.dispose();
      controllerRef.current = null;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [enabled, getFlights]);

  const refresh = useCallback((explicit = true) => {
    if (controllerRef.current) {
      return controllerRef.current.update(explicit);
    }
    return Promise.resolve(false);
  }, []);

  return {
    flights,
    meta,
    isPending,
    isStale,
    error,
    refresh,
  };
}


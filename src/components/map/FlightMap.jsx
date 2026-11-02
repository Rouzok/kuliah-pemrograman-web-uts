import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  INDONESIA_CENTER,
  INDONESIA_ZOOM,
  DEFAULT_STYLE,
  formatAttribution,
  isWebGLSupported,
} from './mapConfig.js';

/**
 * FlightMap Component (MapLibre GL 5)
 *
 * Requirements fulfilled:
 * - F-02: Starts around Indonesia, valid coordinates, pan/zoom, visible attribution
 * - NF-01: Uses maplibre-gl with standard React hooks
 * - NF-08: Permitted tiles with visible legal attribution
 * - NF-11: WebGL detection & error recovery banner ensuring list/sidebar remains usable
 */
export default function FlightMap({
  initialCenter = INDONESIA_CENTER,
  initialZoom = INDONESIA_ZOOM,
  style = DEFAULT_STYLE.style,
  onMapReady,
  onMoveEnd,
  className = 'h-full w-full',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [mapError, setMapError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // 1. Check WebGL support (graceful degradation per NF-11)
    if (!isWebGLSupported()) {
      setIsSupported(false);
      setMapError({
        type: 'WEBGL_UNSUPPORTED',
        message: 'Akselerasi WebGL tidak didukung atau dinonaktifkan di browser ini.',
      });
      return;
    }

    if (!mapContainerRef.current) return;

    let map = null;
    let resizeObserver = null;

    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: style,
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: false, // Custom attribution added below
      });

      // Add navigation controls (zoom, compass)
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add legal attribution control (bottom-right)
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: formatAttribution(DEFAULT_STYLE),
        }),
        'bottom-right'
      );

      map.on('load', () => {
        setIsMapReady(true);
        setMapError(null);
        if (onMapReady) {
          onMapReady(map);
        }
      });

      if (onMoveEnd) {
        map.on('moveend', () => {
          onMoveEnd(map);
        });
      }

      map.on('error', (event) => {
        // Only treat fatal WebGL context losses or 401 style errors as blocking
        if (event?.error?.message?.includes('WebGL') || event?.status === 401) {
          setMapError({
            type: 'MAP_ERROR',
            message: 'Gagal memuat layer peta. Periksa koneksi jaringan Anda.',
          });
        }
      });

      mapInstanceRef.current = map;

      // Automatically resize map when sidebar toggles or viewport dimensions change
      resizeObserver = new ResizeObserver(() => {
        if (map && !map._removed) {
          map.resize();
        }
      });

      resizeObserver.observe(mapContainerRef.current);
    } catch (err) {
      setMapError({
        type: 'INIT_ERROR',
        message: err?.message || 'Inisialisasi peta gagal.',
      });
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (map) {
        map.remove();
        mapInstanceRef.current = null;
        setIsMapReady(false);
      }
    };
  }, [retryCount, style, initialCenter, initialZoom, onMapReady, onMoveEnd]);

  const handleRetry = () => {
    setMapError(null);
    setIsSupported(true);
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
      {/* Map canvas container */}
      <div ref={mapContainerRef} className="h-full w-full" data-testid="maplibre-container" />

      {/* Loading state indicator before map first loads */}
      {!isMapReady && !mapError && isSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 pointer-events-none transition-opacity">
          <div className="flex items-center gap-2 rounded-lg bg-slate-800/90 px-4 py-2 text-xs text-slate-300 shadow-lg border border-slate-700">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            Memuat peta wilayah Indonesia…
          </div>
        </div>
      )}

      {/* Graceful recovery banner if WebGL / map fails (NF-11) */}
      {mapError && (
        <div
          role="alert"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-md rounded-xl border border-red-500/40 bg-slate-900/95 p-4 text-center shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a88,88,0,1,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" />
            </svg>
            Tampilan Peta Terkendala
          </div>
          <p className="mt-1 text-xs text-slate-300">
            {mapError.message} Daftar dan pencarian pesawat di sidebar tetap dapat digunakan sepenuhnya.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-teal-500 focus-visible:outline-2 focus-visible:outline-teal-400"
          >
            Coba Muat Ulang Peta
          </button>
        </div>
      )}
    </div>
  );
}

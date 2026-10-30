import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapService } from '../../../services/MapService';

/**
 * DeliveryMap Component
 * Interactive map component for Captain delivery navigation.
 * Renders live Google Maps route between Captain location, Seller Store Pickup, and Customer Drop-off.
 */
const DeliveryMap = ({
  pickupLocation,
  dropLocation,
  captainLocation,
  pickupAddress = '',
  dropAddress = '',
  sellerStoreName = 'Seller Store',
  recipientName = 'Customer',
  currentStep = 1,
  isReturn = false,
  isTransport = false,
  stops = [],
  onMapLoad,
}) => {
  const mapDivRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef({});
  const infoWindowRef = useRef(null);
  const fallbackPolylineRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'seller' | 'customer' | 'full'
  const [routeInfo, setRouteInfo] = useState(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  // Helper to normalize coordinates
  const extractCoords = (loc) => {
    if (!loc) return null;
    if (typeof loc === 'object') {
      const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat ?? loc.latitude;
      const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng ?? (loc.lon || loc.longitude);
      if (lat !== undefined && lng !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        return { lat: Number(lat), lng: Number(lng) };
      }
    }
    return null;
  };

  const capCoords = extractCoords(captainLocation);
  const pickCoords = extractCoords(pickupLocation);
  const drpCoords = extractCoords(dropLocation);

  // Determine current active navigation target based on activeTab or delivery step
  const getActiveTarget = useCallback(() => {
    if (activeTab === 'seller') return 'seller';
    if (activeTab === 'customer') return 'customer';
    if (activeTab === 'full') return 'full';
    // 'auto' mode
    return currentStep <= 2 ? 'seller' : 'customer';
  }, [activeTab, currentStep]);

  const activeTarget = getActiveTarget();

  // Initialize Map Instance
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      try {
        const google = await MapService.loadGoogleMaps();
        if (isCancelled || !mapDivRef.current) return;

        const initialCenter = capCoords || pickCoords || drpCoords || { lat: 22.7196, lng: 75.8577 }; // Default Indore

        const map = new google.maps.Map(mapDivRef.current, {
          center: initialCenter,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'transit',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#059669', // Emerald
            strokeWeight: 6,
            strokeOpacity: 0.9,
          },
        });

        const directionsService = new google.maps.DirectionsService();
        const infoWindow = new google.maps.InfoWindow();

        mapInstanceRef.current = map;
        directionsServiceRef.current = directionsService;
        directionsRendererRef.current = directionsRenderer;
        infoWindowRef.current = infoWindow;

        setMapReady(true);
        setMapError(null);
        onMapLoad?.(map);
      } catch (err) {
        console.error('DeliveryMap initialization error:', err);
        if (!isCancelled) {
          setMapError(err?.message || 'Failed to initialize Google Maps');
        }
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (fallbackPolylineRef.current) fallbackPolylineRef.current.setMap(null);
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
      Object.values(markersRef.current).forEach((m) => m?.setMap(null));
      markersRef.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update Custom Markers
  useEffect(() => {
    if (!mapReady || !window.google || !mapInstanceRef.current) return;
    const google = window.google;
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    // Helper to create or update marker
    const syncMarker = (key, position, title, iconConfig, clickContent) => {
      if (!position) {
        if (markersRef.current[key]) {
          markersRef.current[key].setMap(null);
          delete markersRef.current[key];
        }
        return;
      }

      if (!markersRef.current[key]) {
        const marker = new google.maps.Marker({
          map,
          position,
          title,
          icon: iconConfig,
          zIndex: key === 'captain' ? 30 : key === activeTarget ? 25 : 20,
        });

        if (clickContent) {
          marker.addListener('click', () => {
            infoWindow.setContent(clickContent);
            infoWindow.open(map, marker);
          });
        }

        markersRef.current[key] = marker;
      } else {
        markersRef.current[key].setPosition(position);
        markersRef.current[key].setTitle(title);
        markersRef.current[key].setIcon(iconConfig);
        markersRef.current[key].setZIndex(key === 'captain' ? 30 : key === activeTarget ? 25 : 20);
      }
    };

    // 1. Captain Marker (Live GPS Position)
    if (capCoords) {
      const captainIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      };
      const captainContent = `
        <div style="padding: 6px 8px; font-family: sans-serif; min-width: 140px;">
          <div style="font-weight: bold; color: #047857; font-size: 13px;">🛵 Your Location</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Captain Live GPS</div>
        </div>
      `;
      syncMarker('captain', capCoords, 'Your Location', captainIcon, captainContent);
    }

    // 2. Seller Store Pickup Marker
    if (pickCoords) {
      const isTarget = activeTarget === 'seller';
      const pickupIcon = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: isTarget ? '#0284c7' : '#0369a1',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: isTarget ? 1.8 : 1.5,
        anchor: new google.maps.Point(12, 22),
      };
      const pickupContent = `
        <div style="padding: 6px 8px; font-family: sans-serif; max-width: 220px;">
          <div style="font-weight: bold; color: #0369a1; font-size: 13px;">🏬 ${sellerStoreName}</div>
          <div style="color: #475569; font-size: 11px; margin-top: 3px; line-height: 1.3;">
            ${pickupAddress || 'Store Pickup Location'}
          </div>
          <div style="display: inline-block; margin-top: 6px; background: #e0f2fe; color: #0369a1; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
            ${isReturn ? 'Return Drop-off' : 'Store Pickup'}
          </div>
        </div>
      `;
      syncMarker('pickup', pickCoords, sellerStoreName, pickupIcon, pickupContent);
    }

    // 3. Customer Drop-off Marker
    if (drpCoords) {
      const isTarget = activeTarget === 'customer';
      const dropIcon = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: isTarget ? '#ea580c' : '#c2410c',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: isTarget ? 1.8 : 1.5,
        anchor: new google.maps.Point(12, 22),
      };
      const dropContent = `
        <div style="padding: 6px 8px; font-family: sans-serif; max-width: 220px;">
          <div style="font-weight: bold; color: #ea580c; font-size: 13px;">📍 ${recipientName}</div>
          <div style="color: #475569; font-size: 11px; margin-top: 3px; line-height: 1.3;">
            ${dropAddress || 'Customer Drop Destination'}
          </div>
          <div style="display: inline-block; margin-top: 6px; background: #ffedd5; color: #c2410c; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
            ${isReturn ? 'Customer Pickup' : 'Delivery Destination'}
          </div>
        </div>
      `;
      syncMarker('drop', drpCoords, recipientName, dropIcon, dropContent);
    }
  }, [mapReady, capCoords, pickCoords, drpCoords, activeTarget, sellerStoreName, recipientName, pickupAddress, dropAddress, isReturn]);

  // Calculate and Render Directions Route
  useEffect(() => {
    if (!mapReady || !window.google || !mapInstanceRef.current || !directionsServiceRef.current || !directionsRendererRef.current) {
      return;
    }

    const google = window.google;
    const map = mapInstanceRef.current;
    const directionsService = directionsServiceRef.current;
    const directionsRenderer = directionsRendererRef.current;

    // Clean up fallback polyline
    if (fallbackPolylineRef.current) {
      fallbackPolylineRef.current.setMap(null);
      fallbackPolylineRef.current = null;
    }

    // Determine start and destination based on activeTarget
    let origin = null;
    let destination = null;
    let waypoints = [];

    const startLocation = capCoords || (activeTarget === 'customer' ? pickCoords : null);

    if (activeTarget === 'seller') {
      origin = startLocation || capCoords;
      destination = pickCoords || (pickupAddress?.trim() ? pickupAddress : null);
    } else if (activeTarget === 'customer') {
      origin = startLocation || capCoords || pickCoords;
      destination = drpCoords || (dropAddress?.trim() ? dropAddress : null);
    } else if (activeTarget === 'full') {
      origin = capCoords || pickCoords;
      destination = drpCoords || (dropAddress?.trim() ? dropAddress : null);
      if (capCoords && pickCoords) {
        waypoints = [{ location: pickCoords, stopover: true }];
      }
      const extraStops = (Array.isArray(stops) ? stops : [])
        .map((s) => {
          const lat = Number(s?.lat ?? s?.latitude);
          const lng = Number(s?.lng ?? s?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { location: { lat, lng }, stopover: true };
          if (typeof s === 'string' && s.trim()) return { location: s.trim(), stopover: true };
          if (s?.address) return { location: s.address, stopover: true };
          return null;
        })
        .filter(Boolean);
      waypoints = [...waypoints, ...extraStops];
    }

    if (!origin || !destination) {
      // Just fit bounds to available markers
      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;
      if (capCoords) { bounds.extend(capCoords); hasPoints = true; }
      if (pickCoords) { bounds.extend(pickCoords); hasPoints = true; }
      if (drpCoords) { bounds.extend(drpCoords); hasPoints = true; }

      if (hasPoints) {
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.setZoom(15);
        }
      }
      return;
    }

    setCalculatingRoute(true);

    const request = {
      origin,
      destination,
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false,
    };

    directionsService.route(request, (result, status) => {
      setCalculatingRoute(false);
      if (status === google.maps.DirectionsStatus.OK && result) {
        // Customize route color depending on target
        const strokeColor = activeTarget === 'seller' ? '#0284c7' : activeTarget === 'customer' ? '#ea580c' : '#059669';
        directionsRenderer.setOptions({
          polylineOptions: {
            strokeColor,
            strokeWeight: 6,
            strokeOpacity: 0.95,
          },
        });
        directionsRenderer.setDirections(result);

        const route = result.routes[0];
        if (route && route.legs && route.legs.length > 0) {
          let totalDistanceMeters = 0;
          let totalDurationSec = 0;
          route.legs.forEach((leg) => {
            totalDistanceMeters += leg.distance?.value || 0;
            totalDurationSec += leg.duration?.value || 0;
          });

          const distKm = Math.round((totalDistanceMeters / 1000) * 10) / 10;
          const durMin = Math.ceil(totalDurationSec / 60);

          setRouteInfo({
            distanceText: `${distKm} km`,
            durationText: `${durMin} mins`,
            summary: route.summary || '',
          });
        }
      } else {
        console.warn('DirectionsService failed with status:', status);
        // Fallback: draw straight dashed polyline if both coordinates exist
        const originCoord = extractCoords(origin);
        const destCoord = extractCoords(destination);
        if (originCoord && destCoord) {
          const lineCoordinates = [originCoord, destCoord];
          const lineSymbol = {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 4,
          };
          const polyline = new google.maps.Polyline({
            path: lineCoordinates,
            strokeColor: activeTarget === 'seller' ? '#0284c7' : '#ea580c',
            strokeOpacity: 0,
            icons: [{
              icon: lineSymbol,
              offset: '0',
              repeat: '20px',
            }],
            map,
          });
          fallbackPolylineRef.current = polyline;

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(originCoord);
          bounds.extend(destCoord);
          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        }
      }
    });
  }, [mapReady, capCoords, pickCoords, drpCoords, pickupAddress, dropAddress, activeTarget, stops]);

  // Handle external navigation in Google Maps App
  const handleOpenGoogleMaps = () => {
    let dest = '';
    let orig = '';

    if (capCoords) {
      orig = `${capCoords.lat},${capCoords.lng}`;
    }

    if (activeTarget === 'seller') {
      dest = pickCoords ? `${pickCoords.lat},${pickCoords.lng}` : pickupAddress || sellerStoreName;
    } else if (activeTarget === 'customer') {
      dest = drpCoords ? `${drpCoords.lat},${drpCoords.lng}` : dropAddress || recipientName;
    } else {
      dest = drpCoords ? `${drpCoords.lat},${drpCoords.lng}` : dropAddress;
    }

    let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
    if (orig) url += `&origin=${encodeURIComponent(orig)}`;
    if (activeTarget === 'full' && pickCoords) {
      url += `&waypoints=${encodeURIComponent(`${pickCoords.lat},${pickCoords.lng}`)}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden border border-emerald-900/20 shadow-md bg-slate-900">
      {/* Route Switcher Tabs on Map */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1.5 p-1 bg-slate-900/85 backdrop-blur-md rounded-xl border border-white/10 shadow-lg text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('seller')}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
            activeTarget === 'seller'
              ? 'bg-sky-600 text-white shadow-sm font-extrabold'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🏬</span>
          <span className="truncate">{isReturn ? 'Return Hub' : 'To Store'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customer')}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
            activeTarget === 'customer'
              ? 'bg-orange-600 text-white shadow-sm font-extrabold'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>📍</span>
          <span className="truncate">{isReturn ? 'To Customer' : 'To Customer'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('full')}
          className={`py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTarget === 'full'
              ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title="Show Full Route"
        >
          <span>🗺️</span>
          <span>Full</span>
        </button>
      </div>

      {/* Map Canvas Container */}
      <div
        ref={mapDivRef}
        className="w-full h-[280px] md:h-[340px] bg-slate-900 transition-opacity duration-300"
        style={{ minHeight: '280px' }}
      />

      {/* Loading Overlay */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2.5 z-10">
          <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-emerald-300 tracking-wide">Loading Live Directions...</p>
        </div>
      )}

      {/* Error Fallback HUD */}
      {mapError && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center text-white gap-3 z-10">
          <span className="material-symbols-outlined text-3xl text-amber-400">location_off</span>
          <div>
            <p className="text-xs font-bold text-slate-200">Map preview unavailable</p>
            <p className="text-[11px] text-slate-400 mt-0.5">You can still navigate directly with Google Maps app</p>
          </div>
          <button
            type="button"
            onClick={handleOpenGoogleMaps}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">navigation</span>
            <span>Open in Google Maps</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Navigation HUD */}
      {mapReady && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2 p-2 bg-slate-900/90 backdrop-blur-md rounded-xl border border-white/10 shadow-lg text-white">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 ${
                activeTarget === 'seller' ? 'bg-sky-600' : activeTarget === 'customer' ? 'bg-orange-600' : 'bg-emerald-600'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {activeTarget === 'seller' ? 'store' : 'home_pin'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                {activeTarget === 'seller'
                  ? `Store: ${sellerStoreName}`
                  : activeTarget === 'customer'
                  ? `Drop: ${recipientName}`
                  : 'Complete Route'}
              </p>
              <p className="text-xs font-extrabold text-white flex items-center gap-1.5 truncate">
                {calculatingRoute ? (
                  <span className="text-slate-400 animate-pulse">Calculating road route...</span>
                ) : routeInfo ? (
                  <>
                    <span className="text-emerald-400">{routeInfo.distanceText}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-400">~{routeInfo.durationText}</span>
                  </>
                ) : (
                  <span className="text-slate-300">Live Turn-by-Turn Route</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenGoogleMaps}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-md shrink-0 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Open in Google Maps Navigation App"
          >
            <span className="material-symbols-outlined text-sm">near_me</span>
            <span>Navigate</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;

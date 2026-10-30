import React, { useEffect, useRef, useState } from 'react';
import { MapService } from '../../../services/MapService';

// Live map showing the captain's current position and the route (polyline)
// to the customer's delivery address. Uses the same Google Maps SDK loader
// (MapService) already used elsewhere in the app so the script is only
// injected once.
const LiveDeliveryMap = ({ captainPosition, destinationAddress, destinationPosition, pickupPosition, dropPosition }) => {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const captainMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const lastRouteKeyRef = useRef('');

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Initialize the map + renderer once
  useEffect(() => {
    let cancelled = false;

    MapService.loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapDivRef.current) return;

        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: captainPosition,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
        });

        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#ea580c', strokeWeight: 5 },
        });

        captainMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: captainPosition,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#ea580c',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          zIndex: 10,
        });

        setMapReady(true);
      })
      .catch(() => setMapError(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the captain marker + route in sync as new positions arrive
  useEffect(() => {
    if (!mapReady || !window.google || !captainPosition) return;

    captainMarkerRef.current?.setPosition(captainPosition);
    mapRef.current?.panTo(captainPosition);

    const placeMarker = (ref, position, color) => {
      if (!position) {
        ref.current?.setMap(null);
        return;
      }
      if (!ref.current) {
        ref.current = new window.google.maps.Marker({
          map: mapRef.current,
          position,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      } else {
        ref.current.setMap(mapRef.current);
        ref.current.setPosition(position);
      }
    };
    placeMarker(pickupMarkerRef, pickupPosition, '#047857');
    placeMarker(dropMarkerRef, dropPosition, '#ff5500');

    const destination = destinationPosition || destinationAddress;
    if (!destination) return;

    const routeKey = `${captainPosition.lat.toFixed(4)},${captainPosition.lng.toFixed(4)}|${
      destinationPosition ? `${destinationPosition.lat},${destinationPosition.lng}` : destinationAddress
    }`;
    if (routeKey === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = routeKey;

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: captainPosition,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        }
      }
    );
  }, [mapReady, captainPosition, destinationAddress, destinationPosition, pickupPosition, dropPosition]);

  if (mapError) return null;

  return (
    <div className="relative w-full h-[220px] md:h-[280px] rounded-2xl overflow-hidden border border-slate-100 bg-slate-100">
      <div ref={mapDivRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400">
          Loading live map...
        </div>
      )}
    </div>
  );
};

export default LiveDeliveryMap;

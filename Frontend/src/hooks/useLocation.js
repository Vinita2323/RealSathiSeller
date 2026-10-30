import { useState, useCallback } from 'react';

export const useLocation = () => {
  const [error, setError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [coords, setCoords] = useState(null);

  const requestLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      setIsLocating(true);
      setError(null);

      if (!navigator.geolocation) {
        const msg = 'Geolocation is not supported by your browser.';
        setError(msg);
        setIsLocating(false);
        reject(new Error(msg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCoords(newCoords);
          setIsLocating(false);
          resolve(newCoords);
        },
        (err) => {
          setIsLocating(false);
          let msg = 'Unable to retrieve your location.';
          if (err.code === 1) msg = 'Location permission denied.';
          else if (err.code === 2) msg = 'Location unavailable (GPS disabled or no signal).';
          else if (err.code === 3) msg = 'Location request timed out.';
          
          setError(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { coords, error, isLocating, requestLocation };
};

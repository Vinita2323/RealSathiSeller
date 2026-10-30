import { MapService } from '../services/MapService';

export const geocodeAddress = async (address) => {
  if (!address || typeof address !== 'string' || !address.trim()) {
    throw new Error('Address string is required for geocoding');
  }

  try {
    const google = await MapService.loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: address.trim(), componentRestrictions: { country: 'in' } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: typeof location.lat === 'function' ? location.lat() : location.lat,
            lng: typeof location.lng === 'function' ? location.lng() : location.lng,
          });
        } else {
          // Retry without country restriction if needed
          geocoder.geocode({ address: address.trim() }, (res2, stat2) => {
            if (stat2 === 'OK' && res2 && res2[0]) {
              const loc = res2[0].geometry.location;
              resolve({
                lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
                lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
              });
            } else {
              reject(new Error(`Geocoding failed: ${status}`));
            }
          });
        }
      });
    });
  } catch (err) {
    console.warn('Geocoding error for address:', address, err);
    throw err;
  }
};

export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
};

export const calculateDistanceKm = (loc1, loc2) => {
  if (!loc1 || !loc2) return null;
  const lat1 = typeof loc1.lat === 'function' ? loc1.lat() : loc1.lat !== undefined ? loc1.lat : loc1.latitude;
  const lon1 = typeof loc1.lng === 'function' ? loc1.lng() : loc1.lng !== undefined ? loc1.lng : (loc1.lon || loc1.longitude);
  const lat2 = typeof loc2.lat === 'function' ? loc2.lat() : loc2.lat !== undefined ? loc2.lat : loc2.latitude;
  const lon2 = typeof loc2.lng === 'function' ? loc2.lng() : loc2.lng !== undefined ? loc2.lng : (loc2.lon || loc2.longitude);

  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return null;
  }

  const R = 6371; // Earth radius in KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
};

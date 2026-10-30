// Google Maps API Service
// Key is provided via the VITE_GOOGLE_MAPS_API_KEY environment variable (see Frontend/.env).

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB0tFQwGvrhwJH71Jwhp-qeY3DoCm34Qb0';

let googleMapsScriptPromise = null;

export const MapService = {
  /**
   * Ensures the Google Maps JavaScript SDK is loaded and ready to use.
   */
  loadGoogleMaps: () => {
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      return Promise.resolve(window.google);
    }

    if (googleMapsScriptPromise) {
      return googleMapsScriptPromise;
    }

    googleMapsScriptPromise = new Promise((resolve, reject) => {
      // Check if script tag already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.google && window.google.maps && window.google.maps.places) {
            clearInterval(checkInterval);
            resolve(window.google);
          } else if (attempts > 50) {
            clearInterval(checkInterval);
            reject(new Error('Google Maps SDK initialization timed out'));
          }
        }, 100);
        return;
      }

      // Inject dynamically if not present
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.google && window.google.maps && window.google.maps.places) {
            clearInterval(checkInterval);
            resolve(window.google);
          } else if (attempts > 30) {
            clearInterval(checkInterval);
            resolve(window.google);
          }
        }, 50);
      };
      script.onerror = (err) => {
        googleMapsScriptPromise = null;
        reject(new Error('Failed to load Google Maps SDK: ' + (err?.message || 'Network error')));
      };
      document.head.appendChild(script);
    });

    return googleMapsScriptPromise;
  },

  /**
   * Fetch live autocomplete place predictions for a user's search query.
   * @param {string} input - User typed query (e.g. "Cyber Hub", "Sector 62")
   * @param {Object} [options] - Additional options (e.g. componentRestrictions: { country: 'in' })
   * @returns {Promise<Array>} List of formatted predictions
   */
  getPlacePredictions: async (input, options = {}) => {
    if (!input || !input.trim()) return [];
    try {
      await MapService.loadGoogleMaps();
      const service = new window.google.maps.places.AutocompleteService();
      
      const request = {
        input: input.trim(),
        componentRestrictions: options.country ? { country: options.country } : { country: 'in' },
        types: options.types || [],
        ...options,
      };

      return new Promise((resolve) => {
        service.getPlacePredictions(request, (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const formatted = predictions.map((p) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || '',
              types: p.types || [],
            }));
            resolve(formatted);
          } else {
            resolve([]);
          }
        });
      });
    } catch (error) {
      console.error('[MapService] getPlacePredictions error:', error);
      return [];
    }
  },

  /**
   * Fetch complete place details and coordinates given a Google Place ID.
   * @param {string} placeId
   * @returns {Promise<Object>} Standardized structured address object
   */
  getPlaceDetails: async (placeId) => {
    try {
      const Geocoder = await MapService.ensureGeocoder();

      // First try using Geocoder with placeId for clean address components
      const geocoder = new Geocoder();
      return new Promise((resolve, reject) => {
        geocoder.geocode({ placeId }, (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
            resolve(MapService.parseAddressComponents(results[0]));
          } else {
            // Fallback to PlacesService
            const dummyElem = document.createElement('div');
            const placesService = new window.google.maps.places.PlacesService(dummyElem);
            placesService.getDetails(
              {
                placeId,
                fields: ['formatted_address', 'geometry', 'address_components', 'name', 'place_id'],
              },
              (place, placeStatus) => {
                if (placeStatus === window.google.maps.places.PlacesServiceStatus.OK && place) {
                  const parsed = MapService.parseAddressComponents({
                    formatted_address: place.formatted_address || place.name,
                    geometry: place.geometry,
                    address_components: place.address_components || [],
                    name: place.name,
                  });
                  resolve(parsed);
                } else {
                  reject(new Error('Could not fetch details for selected place'));
                }
              }
            );
          }
        });
      });
    } catch (error) {
      console.error('[MapService] getPlaceDetails error:', error);
      throw error;
    }
  },

  ensureGeocoder: async () => {
    await MapService.loadGoogleMaps();
    if (window.google?.maps?.importLibrary) {
      const lib = await window.google.maps.importLibrary('geocoding');
      if (lib?.Geocoder) return lib.Geocoder;
    }
    if (typeof window.google?.maps?.Geocoder === 'function') {
      return window.google.maps.Geocoder;
    }
    throw new Error('Google Maps geocoder is not available');
  },

  /**
   * Reverse geocode GPS coordinates into a complete structured address.
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Standardized structured address object
   */
  reverseGeocode: async (lat, lng) => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) {
      throw new Error('Invalid coordinates for reverse geocoding');
    }

    try {
      const Geocoder = await MapService.ensureGeocoder();
      const geocoder = new Geocoder();
      const latlng = { lat: latN, lng: lngN };

      return new Promise((resolve, reject) => {
        geocoder.geocode({ location: latlng }, (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
            const parsed = MapService.parseAddressComponents(results[0]);
            if (parsed && !parsed.postalCode) {
              for (const result of results) {
                const postal = (result.address_components || []).find((comp) => (comp.types || []).includes('postal_code'));
                if (postal?.long_name) {
                  parsed.postalCode = postal.long_name;
                  parsed.pincode = postal.long_name;
                  break;
                }
              }
            }
            resolve(parsed);
          } else {
            reject(new Error(`Reverse geocoding failed: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('[MapService] reverseGeocode error:', error);
      throw error;
    }
  },

  /**
   * Geocode a freeform address string into coordinates and structured address.
   * @param {string} address - Freeform address
   * @returns {Promise<Object>} Standardized structured address object
   */
  geocodeAddress: async (address) => {
    if (!address || !address.trim()) {
      throw new Error('Address string is required for geocoding');
    }

    try {
      const Geocoder = await MapService.ensureGeocoder();
      const geocoder = new Geocoder();

      return new Promise((resolve, reject) => {
        geocoder.geocode({ address: address.trim(), componentRestrictions: { country: 'in' } }, (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
            resolve(MapService.parseAddressComponents(results[0]));
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('[MapService] geocodeAddress error:', error);
      throw error;
    }
  },

  /**
   * Standardized parser converting Google Maps Geocoder or Place Result into a comprehensive, uniform address object.
   */
  parseAddressComponents: (geocodeResult) => {
    if (!geocodeResult) return null;

    const lat = typeof geocodeResult.geometry?.location?.lat === 'function'
      ? geocodeResult.geometry.location.lat()
      : geocodeResult.geometry?.location?.lat ?? null;

    const lng = typeof geocodeResult.geometry?.location?.lng === 'function'
      ? geocodeResult.geometry.location.lng()
      : geocodeResult.geometry?.location?.lng ?? null;

    const formattedAddress = geocodeResult.formatted_address || geocodeResult.name || '';

    let building = '';
    let street = '';
    let subpremise = '';
    let premise = '';
    let streetNumber = '';
    let route = '';
    let sublocality1 = '';
    let sublocality2 = '';
    let neighborhood = '';
    let locality = '';
    let district = '';
    let state = '';
    let postalCode = '';
    let country = 'India';
    let landmark = '';

    const components = geocodeResult.address_components || [];

    components.forEach((comp) => {
      const types = comp.types || [];

      if (types.includes('subpremise')) subpremise = comp.long_name;
      if (types.includes('premise')) premise = comp.long_name;
      if (types.includes('street_number')) streetNumber = comp.long_name;
      if (types.includes('route')) route = comp.long_name;
      if (types.includes('point_of_interest') || types.includes('establishment')) landmark = comp.long_name;
      if (types.includes('neighborhood')) neighborhood = comp.long_name;
      if (types.includes('sublocality_level_2')) sublocality2 = comp.long_name;
      if (types.includes('sublocality_level_1') || types.includes('sublocality')) sublocality1 = comp.long_name;
      if (types.includes('locality')) locality = comp.long_name;
      if (types.includes('administrative_area_level_3') || types.includes('administrative_area_level_2')) {
        district = comp.long_name;
      }
      if (types.includes('administrative_area_level_1')) state = comp.long_name;
      if (types.includes('postal_code')) postalCode = comp.long_name;
      if (types.includes('country')) country = comp.long_name;
    });

    // Assemble clean fields
    building = [subpremise, premise, streetNumber].filter(Boolean).join(', ') || geocodeResult.name || '';
    street = route || '';
    const areaParts = [sublocality2, sublocality1, neighborhood].filter(Boolean);
    const area = areaParts.length > 0 ? Array.from(new Set(areaParts)).join(', ') : '';
    const city = locality || district || area || 'City';

    return {
      formattedAddress,
      address: formattedAddress,
      latitude: lat != null ? Number(lat.toFixed(7)) : null,
      longitude: lng != null ? Number(lng.toFixed(7)) : null,
      lat: lat != null ? Number(lat.toFixed(7)) : null,
      lng: lng != null ? Number(lng.toFixed(7)) : null,
      building,
      street,
      area,
      landmark,
      city,
      district,
      state,
      postalCode,
      pincode: postalCode,
      country,
    };
  },

  /**
   * Request device GPS coordinates with high accuracy and descriptive error states.
   */
  getCurrentCoordinates: () => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser/device.'));
        return;
      }

      const readPosition = (options) => new Promise((resolvePos, rejectPos) => {
        navigator.geolocation.getCurrentPosition(resolvePos, rejectPos, options);
      });

      const toCoords = (pos) => ({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });

      const describeError = (err) => {
        if (err?.code === 1) return 'Location permission was denied. Please enable GPS/location permissions in your browser.';
        if (err?.code === 2) return 'Location is unavailable. Please check your device GPS signal.';
        if (err?.code === 3) return 'Location request timed out. Please try again.';
        return 'Unable to detect your current location.';
      };

      readPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })
        .catch((err) => {
          if (err?.code === 1) throw err;
          return readPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
        })
        .then((pos) => resolve(toCoords(pos)))
        .catch((err) => reject(new Error(describeError(err))));
    });
  },

  /**
   * Calculate road distance and driving duration using Google Distance Matrix Service.
   */
  calculateDistanceAndDuration: async (originCoords, destinationCoords) => {
    try {
      await MapService.loadGoogleMaps();
      const service = new window.google.maps.DistanceMatrixService();

      const origin = new window.google.maps.LatLng(originCoords.lat, originCoords.lng);
      const destination = new window.google.maps.LatLng(destinationCoords.lat, destinationCoords.lng);

      return new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins: [origin],
            destinations: [destination],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC,
          },
          (response, status) => {
            if (status === 'OK' && response.rows?.[0]?.elements?.[0]?.status === 'OK') {
              const element = response.rows[0].elements[0];
              const distanceKm = Math.round((element.distance.value / 1000) * 100) / 100;
              const durationMin = Math.ceil(element.duration.value / 60);
              resolve({
                distanceKm,
                durationMin,
                distanceText: element.distance.text,
                durationText: element.duration.text,
              });
            } else {
              // Haversine fallback
              const d = MapService.haversineFallback(originCoords, destinationCoords);
              resolve({
                distanceKm: d,
                durationMin: Math.max(5, Math.round((d / 25) * 60)),
                distanceText: `${d} km`,
                durationText: `${Math.max(5, Math.round((d / 25) * 60))} mins`,
              });
            }
          }
        );
      });
    } catch {
      const d = MapService.haversineFallback(originCoords, destinationCoords);
      return {
        distanceKm: d,
        durationMin: Math.max(5, Math.round((d / 25) * 60)),
        distanceText: `${d} km`,
        durationText: `${Math.max(5, Math.round((d / 25) * 60))} mins`,
      };
    }
  },

  /** Crow-flies × 1.25 so Maps fallback matches backend estimateRoadDistanceKm. */
  ROAD_DISTANCE_FACTOR: 1.25,

  haversineFallback: (coord1, coord2) => {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLng = toRad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straight = R * c;
    return Math.max(1, Math.round(straight * MapService.ROAD_DISTANCE_FACTOR * 100) / 100);
  },
};

export default MapService;

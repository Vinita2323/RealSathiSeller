import React, { createContext, useContext, useState, useEffect } from 'react';
import { applySavedAddressesAsDeliveryLocation, isDeliverableLocation } from '../utils/userLocation';

const LocationContext = createContext();

function readStoredLocation() {
  try {
    const saved = localStorage.getItem('userLocation');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!isDeliverableLocation(parsed)) {
      localStorage.removeItem('userLocation');
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

function initialLocation() {
  try {
    if (localStorage.getItem('sathiseller_user_token')) {
      const raw = localStorage.getItem('sathiseller_saved_addresses');
      if (raw == null) return null;
      const addresses = JSON.parse(raw);
      if (!Array.isArray(addresses) || addresses.length === 0) {
        localStorage.removeItem('userLocation');
        return null;
      }
      return applySavedAddressesAsDeliveryLocation(addresses, { notify: false });
    }
  } catch (e) {
    return null;
  }
  return readStoredLocation();
}

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(initialLocation);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event?.type === 'sathiseller_location_changed') {
        const next = event.detail ?? null;
        setCurrentLocation(isDeliverableLocation(next) ? next : null);
        return;
      }
      setCurrentLocation(readStoredLocation());
    };

    window.addEventListener('sathiseller_location_changed', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('sathiseller_location_changed', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const setLocation = (locationObj) => {
    const next = isDeliverableLocation(locationObj) ? locationObj : null;
    setCurrentLocation(next);
    if (next) {
      localStorage.setItem('userLocation', JSON.stringify(next));
    } else {
      localStorage.removeItem('userLocation');
    }
    try {
      window.dispatchEvent(new CustomEvent('sathiseller_location_changed', { detail: next }));
    } catch (e) {}
  };

  const clearLocation = () => {
    setCurrentLocation(null);
    localStorage.removeItem('userLocation');
    try {
      window.dispatchEvent(new CustomEvent('sathiseller_location_changed', { detail: null }));
    } catch (e) {}
  };

  return (
    <LocationContext.Provider 
      value={{ 
        currentLocation, 
        setLocation, 
        setCurrentLocation: setLocation,
        clearLocation, 
        permissionGranted, 
        setPermissionGranted,
        isLoading
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => useContext(LocationContext);

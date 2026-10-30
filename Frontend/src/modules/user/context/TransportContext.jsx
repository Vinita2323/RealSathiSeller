import React, { createContext, useContext, useState } from 'react';

const TransportContext = createContext();

export const useTransport = () => {
  const context = useContext(TransportContext);
  if (!context) {
    throw new Error('useTransport must be used within a TransportProvider');
  }
  return context;
};

const DRAFT_STORAGE_KEY = 'sathiseller_transport_draft';

const defaultDraft = {
  pickup: null,
  stops: [],
  drop: null,
  goods: {
    category: '',
    customCategory: '',
    weight: '',
    packages: '',
    instructions: '',
  },
  vehicle: null,
  fareEstimate: null,
};

export const TransportProvider = ({ children }) => {
  // Active booking draft initialized from sessionStorage
  const [activeBooking, setActiveBooking] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        return { ...defaultDraft, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not parse transport draft from storage:', e);
    }
    return defaultDraft;
  });

  const updateActiveBooking = (key, value) => {
    setActiveBooking((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const clearActiveBooking = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
    setActiveBooking(defaultDraft);
  };

  const value = {
    activeBooking,
    updateActiveBooking,
    clearActiveBooking,
  };

  return <TransportContext.Provider value={value}>{children}</TransportContext.Provider>;
};

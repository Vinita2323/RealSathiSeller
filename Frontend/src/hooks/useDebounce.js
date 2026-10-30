import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a fast-changing value (such as search inputs)
 * @param {*} value - The input value to debounce
 * @param {number} delay - Debounce delay in milliseconds (default 300ms)
 * @returns {*} debouncedValue
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;

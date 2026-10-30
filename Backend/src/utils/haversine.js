/**
 * Haversine Formula
 * Calculates the great-circle distance between two geographic points
 * on a sphere (Earth radius = 6371 km).
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lng1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lng2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometers (2 decimal places)
 */

/** Typical city road distance ≈ crow-flies × this factor (matches FareSummary UI). */
export const ROAD_DISTANCE_FACTOR = 1.25;

export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // 2 decimal places
};

/**
 * Estimate billable road distance from coordinates.
 * Prefer a client/Google driving distance when provided and within a sane range;
 * otherwise use crow-flies × ROAD_DISTANCE_FACTOR (min 1 km).
 */
export const estimateRoadDistanceKm = (lat1, lng1, lat2, lng2, clientDistanceKm = null) => {
  const straight = haversineDistance(lat1, lng1, lat2, lng2);
  const fallback = Math.max(1, Math.round(straight * ROAD_DISTANCE_FACTOR * 100) / 100);

  const client = Number(clientDistanceKm);
  if (Number.isFinite(client) && client > 0) {
    const minAllowed = Math.max(0.5, straight * 0.85);
    const maxAllowed = Math.max(fallback * 2.5, straight * 3);
    if (client >= minAllowed && client <= maxAllowed) {
      return Math.round(client * 100) / 100;
    }
  }

  return fallback;
};

/**
 * Estimates travel duration based on distance.
 * Uses an average speed of 25 km/h for city transport vehicles.
 *
 * @param {number} distanceKm
 * @returns {number} Estimated duration in minutes (integer)
 */
export const estimateDuration = (distanceKm) => {
  const avgSpeedKmh = 25;
  const hours = distanceKm / avgSpeedKmh;
  const minutes = hours * 60;
  return Math.max(5, Math.round(minutes)); // minimum 5 minutes
};

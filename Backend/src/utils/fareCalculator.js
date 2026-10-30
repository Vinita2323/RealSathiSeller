/**
 * Fare Calculator
 * Uses Admin → Vehicle Details rates (base / perKm / minimum / platform)
 * plus Admin → Pricing & Charges extras (waiting / stops / night surge).
 *
 * Formula:
 *   distanceCharge = distanceKm × perKmFare
 *   waitingCharge  = waitingMinutes × waitingChargePerMin
 *   stopsCharge    = stopsCount × additionalStopCharge
 *   nightSurge     = (nightPeakActive ? (baseFare + distanceCharge) × (multiplier - 1) + flatSurge : 0)
 *   rawFare        = baseFare + distanceCharge + waitingCharge + stopsCharge + nightSurge
 *   cappedFare     = max(rawFare, minimumFare)
 *   totalFare      = max(0, cappedFare + platformFee - discount)
 */

const parseHourToMinutes = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

/** Detect night/peak window from TransportPricing.startHour / endHour (supports overnight windows). */
export const isNightPeakNow = (pricing, date = new Date()) => {
  if (!pricing?.nightPeakPricing?.enabled) return false;
  const start = parseHourToMinutes(pricing.nightPeakPricing.startHour || '22:00');
  const end = parseHourToMinutes(pricing.nightPeakPricing.endHour || '06:00');
  if (start == null || end == null) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
};

/**
 * @param {Object} vehicle - VehicleType document or snapshot from DB
 * @param {number} distanceKm - Calculated distance in km
 * @param {number|Object} [optionsOrDiscount=0] - Optional discount amount or options object:
 *        { discount, stopsCount, waitingMinutes, isNightPeak, transportPricing }
 * @returns {{ baseFare, perKmFare, distanceKm, distanceCharge, waitingMinutes, waitingCharge, stopsCount, stopsCharge, nightSurge, platformFee, discount, totalFare }}
 */
export const calculateFare = (vehicle, distanceKm, optionsOrDiscount = 0) => {
  const options = typeof optionsOrDiscount === 'number'
    ? { discount: optionsOrDiscount }
    : (optionsOrDiscount || {});

  const discount = Math.max(0, Number(options.discount || 0));
  const stopsCount = Math.max(0, Number(options.stopsCount || (Array.isArray(options.stops) ? options.stops.length : 0)));
  const waitingMinutes = Math.max(0, Number(options.waitingMinutes || 0));
  const dist = Math.max(0.1, Number(distanceKm || 0));
  const pricing = options.transportPricing || null;

  // Vehicle Details (admin) are source of truth; global TransportPricing is fallback only
  const baseFare = Number(vehicle?.baseFare ?? pricing?.baseFare ?? 50);
  const perKmFare = Number(vehicle?.perKmFare ?? pricing?.perKmFare ?? 15);
  const minimumFare = Number(vehicle?.minimumFare ?? pricing?.minimumFare ?? 60);
  const platformFee = Number(vehicle?.platformFee ?? pricing?.platformFee ?? 10);

  const waitingRate = Number(pricing?.waitingChargePerMin ?? 0);
  const stopRate = Number(pricing?.additionalStopCharge ?? 0);

  const distanceCharge = Math.round(dist * perKmFare * 100) / 100;
  const waitingCharge = Math.round(waitingMinutes * waitingRate * 100) / 100;
  const stopsCharge = Math.round(stopsCount * stopRate * 100) / 100;

  let nightSurge = 0;
  const isNightPeak = options.isNightPeak !== undefined
    ? Boolean(options.isNightPeak)
    : isNightPeakNow(pricing);
  if (isNightPeak && pricing?.nightPeakPricing?.enabled) {
    const mult = Number(pricing.nightPeakPricing.surgeMultiplier || 1.0);
    const flat = Number(pricing.nightPeakPricing.surgeFlat || 0);
    nightSurge = Math.round(((baseFare + distanceCharge) * Math.max(0, mult - 1) + flat) * 100) / 100;
  }

  const rawFare = baseFare + distanceCharge + waitingCharge + stopsCharge + nightSurge;
  const cappedFare = Math.max(rawFare, minimumFare);
  const totalFare = Math.max(0, Math.round((cappedFare + platformFee - discount) * 100) / 100);

  return {
    baseFare,
    perKmFare,
    distanceKm: dist,
    distanceCharge,
    waitingMinutes,
    waitingCharge,
    stopsCount,
    stopsCharge,
    nightSurge,
    platformFee,
    discount,
    totalFare,
  };
};

/** Persistable fareBreakdown subset matching TransportBooking schema + extras for admin UI. */
export const toStoredFareBreakdown = (fare) => ({
  baseFare: fare.baseFare,
  distanceCharge: fare.distanceCharge,
  platformFee: fare.platformFee,
  discount: fare.discount,
  totalFare: fare.totalFare,
  waitingCharge: fare.waitingCharge || 0,
  stopsCharge: fare.stopsCharge || 0,
  nightSurge: fare.nightSurge || 0,
});

export default calculateFare;

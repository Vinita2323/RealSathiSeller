/**
 * Transport Booking ID Generator
 * Produces a unique, human-readable booking ID.
 * Format: TRB-{timestamp}-{5 random alphanumeric chars}
 * Example: TRB-1724168400-A1B2C
 */
export const generateBookingId = () => {
  const timestamp = Math.floor(Date.now() / 1000); // Unix seconds
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `TRB-${timestamp}-${random}`;
};

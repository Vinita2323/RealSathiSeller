import crypto from 'crypto';

/**
 * Global mock OTP configured for all panels
 */
export const MOCK_OTP = process.env.MOCK_OTP || '123456';

/**
 * Checks whether an entered OTP is the designated mock OTP
 * @param {string|number} inputOtp
 * @returns {boolean}
 */
export const isMockOtp = (inputOtp) => {
  if (!inputOtp) return false;
  const clean = String(inputOtp).trim();
  return clean === '123456' || clean === String(MOCK_OTP).trim();
};

/**
 * Generates OTP with validity
 * In mock mode, defaults to 123456
 * @returns {{ otp: string, otpExpiry: Date }}
 */
export const generateOtp = () => {
  const otp = MOCK_OTP;
  // Valid for 24 hours
  const otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { otp, otpExpiry };
};

export default generateOtp;


import dotenv from 'dotenv';
dotenv.config();

/**
 * SMS India Hub Centralized OTP Service
 * Reusable SMS provider service for User, Seller, and Captain authentication flows.
 * 
 * SMS India Hub Approved DLT Configuration:
 * - Sender ID: BGADEC
 * - Template ID: 1007282516644508833
 * - Template Name: OTP
 * - Approved Text: "Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC"
 */

const DEFAULT_SENDER_ID = 'BGADEC';
const DEFAULT_TEMPLATE_ID = '1007282516644508833';
const DEFAULT_API_URL = 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
const DEFAULT_APP_NAME = 'Sathi Seller';

/**
 * Normalizes Indian mobile number to clean 10 digits
 * @param {string|number} phone 
 * @returns {string} 10-digit phone number
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10);
};

/**
 * Generates the exact DLT-approved SMS template text with variable substitution
 * @param {string} appName - Variable 1 (Application/Brand Name)
 * @param {string} otp - Variable 2 (Generated numeric OTP)
 * @returns {string} Exact approved message string
 */
export const formatOtpMessage = (appName, otp) => {
  // Use registered DLT App Name first to guarantee 100% template match
  const brand = process.env.SMS_INDIA_HUB_APP_NAME || appName || process.env.APP_NAME || DEFAULT_APP_NAME;
  return `Welcome to the ${brand} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
};

/**
 * Sends OTP SMS via SMS India Hub Gateway
 * 
 * @param {Object} params
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.otp - 6-digit numeric OTP
 * @param {string} [params.appName] - Brand / role identifier (e.g. 'Sathi Seller', 'Sathi Seller Seller', 'Sathi Seller Captain')
 * @param {string} [params.role] - Context role for logging ('user' | 'seller' | 'captain')
 * @returns {Promise<{ success: boolean, message: string, messageId?: string, isMock?: boolean }>}
 */
export const sendOtpSMS = async ({ phone, otp, appName = DEFAULT_APP_NAME, role = 'user' }) => {
  const cleanPhone = normalizePhoneNumber(phone);

  if (!cleanPhone || cleanPhone.length !== 10) {
    return {
      success: false,
      message: 'Please provide a valid 10-digit Indian mobile number',
    };
  }

  if (!otp || String(otp).length < 4) {
    return {
      success: false,
      message: 'Invalid OTP code to send',
    };
  }

  const apiKey = process.env.SMS_INDIA_HUB_API_KEY || process.env.SMS_API_KEY;
  const senderId = process.env.SMS_INDIA_HUB_SENDER_ID || DEFAULT_SENDER_ID;
  const templateId = process.env.SMS_INDIA_HUB_TEMPLATE_ID || DEFAULT_TEMPLATE_ID;
  const entityId = process.env.SMS_INDIA_HUB_ENTITY_ID || process.env.SMS_INDIA_HUB_PEID || process.env.DLT_PE_ID;
  const apiUrl = process.env.SMS_INDIA_HUB_API_URL || DEFAULT_API_URL;
  const providerMode = (process.env.SMS_PROVIDER_MODE || '').toLowerCase();

  const messageText = formatOtpMessage(appName, otp);
  const maskedPhone = `+91-XXXXXX${cleanPhone.slice(-4)}`;

  // Development / Sandbox / Fallback Mode when API Key is not configured
  if (!apiKey || providerMode === 'test' || providerMode === 'sandbox') {
    console.log(`\n========================================`);
    console.log(`[SMS INDIA HUB] [${role.toUpperCase()}] OTP Dispatch (Sandbox/Dev Mode)`);
    console.log(`  Recipient: ${maskedPhone}`);
    console.log(`  Sender ID: ${senderId}`);
    console.log(`  Template ID: ${templateId}`);
    console.log(`  Message: "${messageText}"`);
    console.log(`  Status: Simulated delivery (Configure SMS_INDIA_HUB_API_KEY for live delivery)`);
    console.log(`========================================\n`);

    return {
      success: true,
      message: 'OTP processed successfully',
      isMock: true,
    };
  }

  // Live Gateway Request
  try {
    const queryParams = {
      APIKey: apiKey,
      msisdn: cleanPhone,
      sid: senderId,
      msg: messageText,
      fl: '0',
      gwid: '2',
      templateid: templateId,
    };

    if (entityId) {
      queryParams.entityid = entityId;
      queryParams.peid = entityId;
    }

    const params = new URLSearchParams(queryParams);
    const targetUrl = `${apiUrl}?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sathi Seller-SMSIndiaHub/1.0',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawResponse = await response.text();
    let parsedResponse = null;

    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      parsedResponse = null;
    }

    // Evaluate SMS India Hub response
    // Typical successful response: {"ErrorCode":"000","ErrorMessage":"Done","JobId":"..."} or contains JobId/numeric ID
    const isSuccess = parsedResponse 
      ? (parsedResponse.ErrorCode === '000' || parsedResponse.ErrorMessage === 'Done' || !!parsedResponse.JobId)
      : (rawResponse.toLowerCase().includes('jobid') || rawResponse.toLowerCase().includes('done') || rawResponse.toLowerCase().includes('success') || (response.status === 200 && !rawResponse.toLowerCase().includes('error')));

    if (isSuccess) {
      const jobId = parsedResponse?.JobId || parsedResponse?.messageId || 'DELIVERED';
      console.log(`[SMS INDIA HUB] [${role.toUpperCase()}] ✅ OTP SMS dispatched to ${maskedPhone} (JobId: ${jobId})`);
      return {
        success: true,
        message: 'OTP sent successfully to your mobile number',
        messageId: jobId,
      };
    } else {
      const errorMsg = parsedResponse?.ErrorMessage || parsedResponse?.message || rawResponse.substring(0, 100);
      console.error(`[SMS INDIA HUB] [${role.toUpperCase()}] ❌ SMS Gateway Error for ${maskedPhone}:`, errorMsg);
      return {
        success: false,
        message: 'Unable to deliver SMS OTP. Please verify phone number and try again.',
        error: errorMsg,
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[SMS INDIA HUB] [${role.toUpperCase()}] ⏱️ Request timed out after 10s for ${maskedPhone}`);
      return {
        success: false,
        message: 'SMS service timed out. Please try again.',
      };
    }
    console.error(`[SMS INDIA HUB] [${role.toUpperCase()}] ❌ Network/Connection Error:`, err.message);
    return {
      success: false,
      message: 'SMS service temporarily unavailable. Please try again.',
    };
  }
};

export default {
  normalizePhoneNumber,
  formatOtpMessage,
  sendOtpSMS,
};

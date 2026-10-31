#!/usr/bin/env node

/**
 * ==============================================================================
 * ShippNex Environment Setup & Configuration Audit Validator
 * ==============================================================================
 * Validates Frontend and Backend environment configurations, identifies missing
 * variables, placeholder values, invalid URL structures, and checks security.
 *
 * CRITICAL SECURITY PRINCIPLE:
 * Never prints actual passwords, private keys, tokens, or raw secrets.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Terminal color formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const symbols = {
  ok: `${colors.green}✔${colors.reset}`,
  warn: `${colors.yellow}▲${colors.reset}`,
  fail: `${colors.red}✖${colors.reset}`,
  info: `${colors.cyan}ℹ${colors.reset}`,
};

// Safe secret masking helper
function maskSecret(val) {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (trimmed.length <= 6) return '******';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 2)}`;
}

// Checks if value is an unconfigured placeholder
function isPlaceholder(val) {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  return (
    s === '' ||
    s.includes('your_') ||
    s.includes('_here') ||
    s.includes('placeholder') ||
    s.includes('example') ||
    s.includes('<username>') ||
    s.includes('<password>') ||
    s.includes('xxxx') ||
    s === 'undefined' ||
    s === 'null'
  );
}

// Parse .env file without external dependencies
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const envMap = {};

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();

    // Remove quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.substring(1, val.length - 1);
    }

    envMap[key] = val;
  }

  return envMap;
}

console.log(`\n${colors.bold}${colors.cyan}===================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}    Sathi Seller Environment Setup & Configuration Audit Report    ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}===================================================================${colors.reset}\n`);

const backendEnvPath = path.resolve(__dirname, 'Backend', '.env');
const frontendEnvPath = path.resolve(__dirname, 'Frontend', '.env');
const backendExamplePath = path.resolve(__dirname, 'Backend', '.env.example');
const frontendExamplePath = path.resolve(__dirname, 'Frontend', '.env.example');

let hasCriticalErrors = false;
let warningsCount = 0;
let passedCount = 0;

// 1. FILE EXISTENCE AUDIT
console.log(`${colors.bold}[1/4] Environment Files Presence Audit:${colors.reset}`);

function checkFile(name, filePath, isExample = false) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    console.log(`  ${symbols.ok} ${name}: Found (${colors.dim}${path.relative(__dirname, filePath)}${colors.reset})`);
    passedCount++;
    return true;
  } else {
    if (isExample) {
      console.log(`  ${symbols.warn} ${name}: Missing template`);
      warningsCount++;
    } else {
      console.log(`  ${symbols.fail} ${name}: Missing file (${colors.yellow}Create from .env.example${colors.reset})`);
      hasCriticalErrors = true;
    }
    return false;
  }
}

const hasBackendEnv = checkFile('Backend .env', backendEnvPath);
checkFile('Backend .env.example', backendExamplePath, true);
const hasFrontendEnv = checkFile('Frontend .env', frontendEnvPath);
checkFile('Frontend .env.example', frontendExamplePath, true);

const backendEnv = hasBackendEnv ? parseEnvFile(backendEnvPath) : {};
const frontendEnv = hasFrontendEnv ? parseEnvFile(frontendEnvPath) : {};

// 2. BACKEND AUDIT
console.log(`\n${colors.bold}[2/4] Backend Configuration Audit:${colors.reset}`);

if (!hasBackendEnv) {
  console.log(`  ${symbols.fail} Backend .env does not exist. Skipping detailed checks.`);
} else {
  // A. Port & Environment
  const port = backendEnv.PORT || '5000';
  if (!isNaN(Number(port)) && Number(port) > 0) {
    console.log(`  ${symbols.ok} PORT: Configured as ${port}`);
    passedCount++;
  } else {
    console.log(`  ${symbols.fail} PORT: Invalid value '${port}'`);
    hasCriticalErrors = true;
  }

  const nodeEnv = backendEnv.NODE_ENV || 'development';
  console.log(`  ${symbols.ok} NODE_ENV: Set to '${nodeEnv}'`);
  passedCount++;

  // B. Database (MongoDB)
  const mongoUri = backendEnv.MONGODB_URI;
  if (!mongoUri || mongoUri.trim() === '') {
    console.log(`  ${symbols.fail} MONGODB_URI: Not configured (Required for database connection)`);
    hasCriticalErrors = true;
  } else if (isPlaceholder(mongoUri)) {
    console.log(`  ${symbols.warn} MONGODB_URI: Contains placeholder credentials (Action required before production)`);
    warningsCount++;
  } else if (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://')) {
    const isAtlas = mongoUri.startsWith('mongodb+srv://');
    console.log(`  ${symbols.ok} MONGODB_URI: Valid format (${isAtlas ? 'MongoDB Atlas Cloud' : 'Local MongoDB Instance'})`);
    passedCount++;
  } else {
    console.log(`  ${symbols.fail} MONGODB_URI: Invalid protocol (must start with mongodb:// or mongodb+srv://)`);
    hasCriticalErrors = true;
  }

  // C. JWT Authentication
  const jwtSecret = backendEnv.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    console.log(`  ${symbols.fail} JWT_SECRET: Not configured (Authentication will fail)`);
    hasCriticalErrors = true;
  } else if (jwtSecret === 'shippnex_secret' || isPlaceholder(jwtSecret)) {
    console.log(`  ${symbols.warn} JWT_SECRET: Using default/placeholder development secret (Replace for production)`);
    warningsCount++;
  } else {
    console.log(`  ${symbols.ok} JWT_SECRET: Configured (${maskSecret(jwtSecret)})`);
    passedCount++;
  }

  // D. Razorpay Payment Gateway
  const rzpKey = backendEnv.RAZORPAY_KEY_ID;
  const rzpSecret = backendEnv.RAZORPAY_KEY_SECRET;
  const rzpWebhook = backendEnv.RAZORPAY_WEBHOOK_SECRET;

  if (isPlaceholder(rzpKey) || !rzpKey) {
    console.log(`  ${symbols.warn} RAZORPAY_KEY_ID: Placeholder set (${maskSecret(rzpKey) || 'not set'}) - Online orders will require manual keys`);
    warningsCount++;
  } else {
    const isLive = rzpKey.startsWith('rzp_live_');
    const isTest = rzpKey.startsWith('rzp_test_');
    console.log(`  ${symbols.ok} RAZORPAY_KEY_ID: Configured (${maskSecret(rzpKey)}) [Mode: ${isLive ? 'LIVE' : isTest ? 'TEST' : 'CUSTOM'}]`);
    passedCount++;
  }

  if (isPlaceholder(rzpSecret) || !rzpSecret) {
    console.log(`  ${symbols.warn} RAZORPAY_KEY_SECRET: Placeholder set - Signature verification will fail in live orders`);
    warningsCount++;
  } else {
    console.log(`  ${symbols.ok} RAZORPAY_KEY_SECRET: Configured (Protected)`);
    passedCount++;
  }

  if (isPlaceholder(rzpWebhook) || !rzpWebhook) {
    console.log(`  ${symbols.info} RAZORPAY_WEBHOOK_SECRET: Placeholder set (Required only if Razorpay Webhook is enabled)`);
  } else {
    console.log(`  ${symbols.ok} RAZORPAY_WEBHOOK_SECRET: Configured (Protected)`);
    passedCount++;
  }

  // E. SMS India Hub Gateway
  const smsMode = (backendEnv.SMS_PROVIDER_MODE || 'sandbox').toLowerCase();
  const smsKey = backendEnv.SMS_INDIA_HUB_API_KEY;
  if (smsMode === 'sandbox' || smsMode === 'test') {
    console.log(`  ${symbols.ok} SMS Gateway: Running in SANDBOX mode (OTPs safely logged to server console)`);
    passedCount++;
  } else if (smsMode === 'live') {
    if (isPlaceholder(smsKey) || !smsKey) {
      console.log(`  ${symbols.fail} SMS Gateway: Mode is 'live' but SMS_INDIA_HUB_API_KEY is missing or placeholder`);
      hasCriticalErrors = true;
    } else {
      console.log(`  ${symbols.ok} SMS Gateway: Configured for LIVE delivery (API Key: ${maskSecret(smsKey)})`);
      passedCount++;
    }
  }

  // F. Cloudinary Media Storage
  const cldName = backendEnv.CLOUDINARY_CLOUD_NAME;
  if (isPlaceholder(cldName) || !cldName) {
    console.log(`  ${symbols.info} Cloudinary: Not configured -> Backend will automatically store uploads locally in 'Backend/uploads/'`);
  } else {
    console.log(`  ${symbols.ok} Cloudinary: Configured (Cloud: ${cldName})`);
    passedCount++;
  }

  // G. Firebase Push Notifications
  const fbPath = backendEnv.FIREBASE_SERVICE_ACCOUNT_PATH;
  const fbResolvedPath = fbPath ? path.resolve(__dirname, 'Backend', fbPath) : null;
  const fbKeyExists = fbResolvedPath && fs.existsSync(fbResolvedPath);
  const fbEnvProject = backendEnv.FIREBASE_PROJECT_ID;

  if (fbKeyExists) {
    console.log(`  ${symbols.ok} Firebase Admin: Service account JSON file found at '${fbPath}'`);
    passedCount++;
  } else if (!isPlaceholder(fbEnvProject) && backendEnv.FIREBASE_PRIVATE_KEY) {
    console.log(`  ${symbols.ok} Firebase Admin: Configured via environment variables (Project: ${fbEnvProject})`);
    passedCount++;
  } else {
    console.log(`  ${symbols.info} Firebase Admin: Running in SIMULATION mode (Push notifications logged to console)`);
  }
}

// 3. FRONTEND AUDIT
console.log(`\n${colors.bold}[3/4] Frontend Configuration Audit:${colors.reset}`);

if (!hasFrontendEnv) {
  console.log(`  ${symbols.fail} Frontend .env does not exist. Skipping detailed checks.`);
} else {
  // A. Base API URL
  const apiUrl = frontendEnv.VITE_API_URL;
  if (!apiUrl || apiUrl.trim() === '') {
    console.log(`  ${symbols.warn} VITE_API_URL: Not set (Frontend will dynamically fallback to current host:5000)`);
    warningsCount++;
  } else {
    try {
      new URL(apiUrl);
      console.log(`  ${symbols.ok} VITE_API_URL: Valid URL format (${apiUrl})`);
      passedCount++;
    } catch {
      console.log(`  ${symbols.fail} VITE_API_URL: Invalid URL format ('${apiUrl}')`);
      hasCriticalErrors = true;
    }
  }

  // B. Razorpay Key ID
  const frontRzpKey = frontendEnv.VITE_RAZORPAY_KEY_ID;
  if (isPlaceholder(frontRzpKey) || !frontRzpKey) {
    console.log(`  ${symbols.warn} VITE_RAZORPAY_KEY_ID: Placeholder set`);
    warningsCount++;
  } else {
    console.log(`  ${symbols.ok} VITE_RAZORPAY_KEY_ID: Configured (${maskSecret(frontRzpKey)})`);
    passedCount++;
    if (backendEnv.RAZORPAY_KEY_ID && !isPlaceholder(backendEnv.RAZORPAY_KEY_ID) && backendEnv.RAZORPAY_KEY_ID !== frontRzpKey) {
      console.log(`  ${symbols.warn} Razorpay Mismatch: Frontend VITE_RAZORPAY_KEY_ID differs from Backend RAZORPAY_KEY_ID`);
      warningsCount++;
    }
  }

  // C. Google Maps API
  const mapsKey = frontendEnv.VITE_GOOGLE_MAPS_API_KEY;
  if (isPlaceholder(mapsKey) || !mapsKey) {
    console.log(`  ${symbols.warn} VITE_GOOGLE_MAPS_API_KEY: Placeholder set (Address autocomplete/maps will use fallback)`);
    warningsCount++;
  } else {
    console.log(`  ${symbols.ok} VITE_GOOGLE_MAPS_API_KEY: Configured (${maskSecret(mapsKey)})`);
    passedCount++;
  }

  // D. Firebase Web Client
  const fbApiKey = frontendEnv.VITE_FIREBASE_API_KEY;
  const fbVapidKey = frontendEnv.VITE_FIREBASE_VAPID_KEY;
  const fbFrontProject = frontendEnv.VITE_FIREBASE_PROJECT_ID;

  if (isPlaceholder(fbApiKey) || !fbApiKey) {
    console.log(`  ${symbols.info} VITE_FIREBASE_API_KEY: Placeholder set (Web push messaging disabled until live credentials provided)`);
  } else {
    console.log(`  ${symbols.ok} VITE_FIREBASE_API_KEY: Configured (${maskSecret(fbApiKey)})`);
    passedCount++;
  }

  if (fbVapidKey && !isPlaceholder(fbVapidKey)) {
    console.log(`  ${symbols.ok} VITE_FIREBASE_VAPID_KEY: Configured (${maskSecret(fbVapidKey)})`);
    passedCount++;
  }

  if (fbFrontProject && backendEnv.FIREBASE_PROJECT_ID && !isPlaceholder(fbFrontProject) && !isPlaceholder(backendEnv.FIREBASE_PROJECT_ID)) {
    if (fbFrontProject === backendEnv.FIREBASE_PROJECT_ID) {
      console.log(`  ${symbols.ok} Firebase Project Sync: Frontend & Backend match ('${fbFrontProject}')`);
      passedCount++;
    } else {
      console.log(`  ${symbols.warn} Firebase Project Mismatch: Frontend (${fbFrontProject}) vs Backend (${backendEnv.FIREBASE_PROJECT_ID})`);
      warningsCount++;
    }
  }

  // E. Secret Exposure Check
  const exposedKeys = Object.keys(frontendEnv).filter(
    (k) =>
      k.toLowerCase().includes('secret') ||
      k.toLowerCase().includes('private') ||
      k.toLowerCase().includes('mongodb')
  );
  if (exposedKeys.length > 0) {
    console.log(`  ${symbols.fail} SECURITY ALERT: Sensitive secrets detected in Frontend/.env: ${exposedKeys.join(', ')}`);
    hasCriticalErrors = true;
  } else {
    console.log(`  ${symbols.ok} Frontend Security: No backend secrets or private keys exposed in client variables`);
    passedCount++;
  }
}

// 4. SUMMARY & RECOMMENDATIONS
console.log(`\n${colors.bold}[4/4] Executive Summary:${colors.reset}`);
console.log(`  • Tests Passed: ${colors.green}${passedCount}${colors.reset}`);
console.log(`  • Warnings:     ${warningsCount > 0 ? colors.yellow : colors.green}${warningsCount}${colors.reset}`);
console.log(`  • Blockers:     ${hasCriticalErrors ? colors.red : colors.green}${hasCriticalErrors ? 'Yes' : 'None'}${colors.reset}`);

if (!hasCriticalErrors) {
  console.log(`\n${colors.bold}${colors.green}  ✔ PROJECT IS READY FOR LOCAL DEVELOPMENT${colors.reset}`);
  console.log(`  Safe development defaults are active:`);
  console.log(`    - SMS OTP is in SANDBOX mode (OTPs print in backend console).`);
  console.log(`    - Cloudinary defaults safely to local uploads folder.`);
  console.log(`    - Firebase defaults to simulation/mock mode.`);
  console.log(`    - Razorpay & Google Maps await your live/test keys.`);
} else {
  console.log(`\n${colors.bold}${colors.red}  ✖ ACTION REQUIRED: Fix critical errors above before running.${colors.reset}`);
}

console.log(`\n${colors.dim}===================================================================${colors.reset}\n`);

process.exit(hasCriticalErrors ? 1 : 0);

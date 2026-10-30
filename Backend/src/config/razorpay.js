import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure it loads the .env file from the Backend root directory (2 levels up)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

export const razorpayInstance = new Proxy({}, {
  get(target, prop) {
    const rzp = getRazorpayInstance();
    const val = rzp[prop];
    return typeof val === 'function' ? val.bind(rzp) : val;
  }
});


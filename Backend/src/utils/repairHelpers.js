import crypto from 'crypto';

// ── Status machine for Repair & Services ────────────────────────────────────────
// Customer → Booking → Rider Pickup → Repair Center → Diagnosis → Quotation approval
// → Repair → Rider Delivery → Customer OTP confirmation
export const REPAIR_STATUSES = [
  'REQUESTED',
  'PICKUP_ASSIGNED',
  'PICKUP_ACCEPTED',
  'PICKUP_STARTED',
  'REACHED_CUSTOMER',
  'PICKED_UP',
  'AT_REPAIR_CENTER',
  'DIAGNOSING',
  'QUOTATION_SENT',
  'QUOTATION_APPROVED',
  'QUOTATION_REJECTED',
  'IN_REPAIR',
  'REPAIR_COMPLETED',
  'DELIVERY_ASSIGNED',
  'DELIVERY_ACCEPTED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

export const REPAIR_STATUS_LABELS = {
  REQUESTED: 'Booking Requested',
  PICKUP_ASSIGNED: 'Pickup Rider Assigned',
  PICKUP_ACCEPTED: 'Pickup Accepted',
  PICKUP_STARTED: 'Rider On The Way',
  REACHED_CUSTOMER: 'Rider Reached You',
  PICKED_UP: 'Picked Up',
  AT_REPAIR_CENTER: 'At Repair Center',
  DIAGNOSING: 'Diagnosis In Progress',
  QUOTATION_SENT: 'Quotation Ready',
  QUOTATION_APPROVED: 'Quotation Approved',
  QUOTATION_REJECTED: 'Quotation Rejected',
  IN_REPAIR: 'Repair In Progress',
  REPAIR_COMPLETED: 'Repair Completed',
  DELIVERY_ASSIGNED: 'Delivery Rider Assigned',
  DELIVERY_ACCEPTED: 'Delivery Rider Accepted',
  OUT_FOR_DELIVERY: 'Out For Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Statuses in which a customer may still cancel (before the item leaves their hands)
export const CUSTOMER_CANCELLABLE = ['REQUESTED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED'];
export const ADMIN_CANCELLABLE = [
  'REQUESTED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED', 'REACHED_CUSTOMER', 'PICKED_UP', 'AT_REPAIR_CENTER',
  'DIAGNOSING', 'QUOTATION_SENT',
];
export const FINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

export const generateRepairBookingId = () => {
  const ts = Date.now().toString().slice(-6);
  const rnd = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `REP-${ts}-${rnd}`;
};

// Real random 4-digit OTP (does not use the global mock OTP)
export const generateRepairOtp = () => String(crypto.randomInt(1000, 10000));

export const pushHistory = (booking, status, { note = '', byRole = 'system', by = '' } = {}) => {
  booking.status = status;
  booking.statusHistory.push({ status, note, byRole, by: String(by || ''), at: new Date() });
};

// Strip fields that must never reach captains / technicians
export const sanitizeForStaff = (bookingDoc) => {
  const b = bookingDoc?.toObject ? bookingDoc.toObject() : { ...bookingDoc };
  delete b.pickupOtp;
  delete b.deliveryOtp;
  return b;
};

// Customers see their OTPs only when the rider needs them
export const sanitizeForCustomer = (bookingDoc) => {
  const b = bookingDoc?.toObject ? bookingDoc.toObject() : { ...bookingDoc };
  // The customer keeps both OTPs visible until they are used: pickup OTP from booking until pickup,
  // delivery OTP from repair completion until delivery (it is the customer's secret to share with the rider).
  const showPickupOtp = ['REQUESTED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED', 'REACHED_CUSTOMER'].includes(b.status);
  const showDeliveryOtp = ['REPAIR_COMPLETED', 'QUOTATION_REJECTED', 'DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'OUT_FOR_DELIVERY'].includes(b.status);
  if (!showPickupOtp) delete b.pickupOtp;
  if (!showDeliveryOtp) delete b.deliveryOtp;
  return b;
};

// ── Notifications (best effort, never block the request) ───────────────────────────
export const notifyCustomer = (booking, title, body) => {
  setImmediate(async () => {
    try {
      const { emitToUser } = await import('../socket/socket.js');
      emitToUser(String(booking.user), 'repair:update', {
        bookingId: booking.bookingId,
        status: booking.status,
        title,
        message: body,
      });
    } catch { /* socket not available */ }
    try {
      const { sendNotificationToUser } = await import('./pushNotificationHelper.js');
      await sendNotificationToUser(booking.user, {
        title,
        body,
        data: { type: 'repair_update', bookingId: booking.bookingId, link: `/repair/booking/${booking._id}` },
      });
    } catch { /* push not configured */ }
  });
};

export const notifyCaptain = (captainId, booking, title, message) => {
  setImmediate(async () => {
    try {
      const { default: CaptainNotification } = await import('../models/CaptainNotification.model.js');
      await CaptainNotification.create({
        captainId,
        type: 'JOB_ASSIGNED',
        title,
        message,
        orderId: booking.bookingId,
        icon: 'build',
      });
    } catch { /* ignore */ }
    try {
      const { sendNotificationToCaptain } = await import('./pushNotificationHelper.js');
      await sendNotificationToCaptain(captainId, {
        title,
        body: message,
        data: { type: 'repair_job', bookingId: booking.bookingId, link: '/captain/repair-jobs' },
      });
    } catch { /* push not configured */ }
  });
};

// ── Default catalog (seeded once; admin edits it afterwards) ────────────────────────────
export const DEFAULT_REPAIR_CATEGORIES = [
  {
    name: 'Mobile Phones', icon: 'Smartphone', diagnosisFee: 99, priority: 1,
    brands: [
      { name: 'Apple', models: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'] },
      { name: 'Samsung', models: ['Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy A54', 'Galaxy M34'] },
      { name: 'Xiaomi / Redmi', models: ['Redmi Note 11', 'Redmi Note 12', 'Redmi 12', 'Mi 11X'] },
      { name: 'Vivo', models: ['V25', 'V27', 'Y22', 'T2'] },
      { name: 'Oppo', models: ['Reno 8', 'Reno 10', 'A78', 'F21'] },
      { name: 'OnePlus', models: ['Nord CE 3', '10R', '11', '12'] },
    ],
    problems: [
      { name: 'Broken / cracked screen', estimateMin: 1500, estimateMax: 8000 },
      { name: 'Battery drains fast / not charging', estimateMin: 500, estimateMax: 2500 },
      { name: 'Charging port issue', estimateMin: 400, estimateMax: 1500 },
      { name: 'Water damage', estimateMin: 800, estimateMax: 5000 },
      { name: 'Speaker / mic problem', estimateMin: 300, estimateMax: 1200 },
      { name: 'Camera not working', estimateMin: 600, estimateMax: 4000 },
      { name: 'Software / hanging issue', estimateMin: 300, estimateMax: 1000 },
    ],
  },
  {
    name: 'Laptops', icon: 'Laptop', diagnosisFee: 199, priority: 2,
    brands: [
      { name: 'HP', models: ['Pavilion', 'Envy', 'ProBook', 'Victus'] },
      { name: 'Dell', models: ['Inspiron', 'Vostro', 'Latitude', 'XPS'] },
      { name: 'Lenovo', models: ['IdeaPad', 'ThinkPad', 'Legion', 'Yoga'] },
      { name: 'Apple', models: ['MacBook Air', 'MacBook Pro'] },
      { name: 'Asus', models: ['VivoBook', 'ZenBook', 'TUF', 'ROG'] },
      { name: 'Acer', models: ['Aspire', 'Swift', 'Nitro'] },
    ],
    problems: [
      { name: 'Not powering on', estimateMin: 800, estimateMax: 5000 },
      { name: 'Screen damaged / flickering', estimateMin: 2500, estimateMax: 9000 },
      { name: 'Battery / charger issue', estimateMin: 800, estimateMax: 3500 },
      { name: 'Keyboard / touchpad not working', estimateMin: 600, estimateMax: 3000 },
      { name: 'Overheating / fan noise', estimateMin: 500, estimateMax: 2000 },
      { name: 'Slow performance / OS reinstall', estimateMin: 400, estimateMax: 1500 },
      { name: 'Hard disk / SSD failure', estimateMin: 1500, estimateMax: 6000 },
    ],
  },
  {
    name: 'Computers', icon: 'Monitor', diagnosisFee: 199, priority: 3,
    brands: [
      { name: 'HP', models: ['Desktop', 'All-in-One'] },
      { name: 'Dell', models: ['OptiPlex', 'Inspiron Desktop'] },
      { name: 'Lenovo', models: ['ThinkCentre', 'IdeaCentre'] },
      { name: 'Custom Built', models: ['Custom PC'] },
    ],
    problems: [
      { name: 'Not powering on', estimateMin: 500, estimateMax: 4000 },
      { name: 'No display', estimateMin: 500, estimateMax: 3000 },
      { name: 'Slow / hanging', estimateMin: 400, estimateMax: 1500 },
      { name: 'Virus / OS issue', estimateMin: 400, estimateMax: 1200 },
      { name: 'RAM / storage upgrade', estimateMin: 800, estimateMax: 6000 },
    ],
  },
  {
    name: 'TVs', icon: 'Tv', diagnosisFee: 249, priority: 4,
    brands: [
      { name: 'Samsung', models: ['LED', 'QLED', 'Crystal 4K'] },
      { name: 'LG', models: ['LED', 'OLED', 'NanoCell'] },
      { name: 'Sony', models: ['Bravia LED', 'Bravia OLED'] },
      { name: 'Mi / Xiaomi', models: ['Smart TV 4A', 'Smart TV 5X'] },
      { name: 'TCL', models: ['P635', 'C645'] },
    ],
    problems: [
      { name: 'No display / black screen', estimateMin: 1500, estimateMax: 8000 },
      { name: 'Lines or spots on screen', estimateMin: 2500, estimateMax: 15000 },
      { name: 'No sound', estimateMin: 600, estimateMax: 2500 },
      { name: 'Not turning on', estimateMin: 800, estimateMax: 4000 },
      { name: 'HDMI / Wi-Fi / smart features issue', estimateMin: 500, estimateMax: 2500 },
    ],
  },
  {
    name: 'Washing Machines', icon: 'WashingMachine', diagnosisFee: 299, priority: 5,
    brands: [
      { name: 'LG', models: ['Top Load', 'Front Load'] },
      { name: 'Samsung', models: ['Top Load', 'Front Load'] },
      { name: 'Whirlpool', models: ['Top Load', 'Front Load', 'Semi-Automatic'] },
      { name: 'IFB', models: ['Front Load', 'Top Load'] },
      { name: 'Bosch', models: ['Front Load'] },
    ],
    problems: [
      { name: 'Not spinning / draining', estimateMin: 600, estimateMax: 2500 },
      { name: 'Water leakage', estimateMin: 500, estimateMax: 2500 },
      { name: 'Not turning on', estimateMin: 800, estimateMax: 4000 },
      { name: 'Loud noise / vibration', estimateMin: 500, estimateMax: 3000 },
      { name: 'Door / lock problem', estimateMin: 400, estimateMax: 1800 },
    ],
  },
  {
    name: 'Refrigerators', icon: 'Refrigerator', diagnosisFee: 299, priority: 6,
    brands: [
      { name: 'LG', models: ['Single Door', 'Double Door', 'Side by Side'] },
      { name: 'Samsung', models: ['Single Door', 'Double Door', 'Side by Side'] },
      { name: 'Whirlpool', models: ['Single Door', 'Double Door'] },
      { name: 'Godrej', models: ['Single Door', 'Double Door'] },
      { name: 'Haier', models: ['Double Door', 'Side by Side'] },
    ],
    problems: [
      { name: 'Not cooling', estimateMin: 800, estimateMax: 6000 },
      { name: 'Water leakage', estimateMin: 400, estimateMax: 1800 },
      { name: 'Compressor issue', estimateMin: 2500, estimateMax: 8000 },
      { name: 'Excess ice / frost', estimateMin: 500, estimateMax: 2500 },
      { name: 'Noise problem', estimateMin: 400, estimateMax: 2000 },
    ],
  },
  {
    name: 'Other Electronics', icon: 'Cpu', diagnosisFee: 149, priority: 7,
    brands: [{ name: 'Other', models: ['Other'] }],
    problems: [
      { name: 'Not turning on', estimateMin: 300, estimateMax: 3000 },
      { name: 'Physical damage', estimateMin: 300, estimateMax: 4000 },
      { name: 'Other issue (describe below)', estimateMin: 0, estimateMax: 0 },
    ],
  },
];

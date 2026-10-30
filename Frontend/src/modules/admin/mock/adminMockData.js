// Super Admin Mock Data Store for Sathi Seller

export const mockStats = {
  totalUsers: { value: '287', change: '+12.5%', isPositive: true },
  totalCategories: { value: '238', change: '+5.2%', isPositive: true },
  totalSubcategories: { value: '1', change: '0.0%', isPositive: true },
  totalProducts: { value: '299', change: '+14.1%', isPositive: true },
  totalOrders: { value: '784', change: '+18.4%', isPositive: true },
  completedOrders: { value: '190', change: '+24.0%', isPositive: true },
  pendingOrders: { value: '118', change: '-5.1%', isPositive: true },
  cancelledOrders: { value: '24', change: '-12.0%', isPositive: true },
  productSoldOut: { value: '52', change: '+3.1%', isPositive: false },
  lowStockProducts: { value: '40', change: '+2.0%', isPositive: false },
  totalSellers: { value: '1,240', change: '+8.2%', isPositive: true },
  totalCaptains: { value: '3,850', change: '+15.4%', isPositive: true },
  totalWarehouses: { value: '42', change: '+4.0%', isPositive: true },
  ordersToday: { value: '1,894', change: '+22.1%', isPositive: true },
  revenueToday: { value: '₹148,920', change: '+18.6%', isPositive: true },
  todayDeliveries: { value: '1,540', change: '+19.3%', isPositive: true },
  runningDeliveries: { value: '310', change: '+6.5%', isPositive: true },
  supportTickets: { value: '14', change: '-35.0%', isPositive: true },
  pendingSellerApprovals: { value: '9', change: 'Action Required', isAlert: true },
  pendingCaptainApprovals: { value: '15', change: 'Action Required', isAlert: true },
};

export const mockRevenueChartData = [
  { month: 'Jan', revenue: 420000, orders: 12400 },
  { month: 'Feb', revenue: 480000, orders: 14200 },
  { month: 'Mar', revenue: 510000, orders: 15800 },
  { month: 'Apr', revenue: 590000, orders: 18100 },
  { month: 'May', revenue: 680000, orders: 21000 },
  { month: 'Jun', revenue: 740000, orders: 23500 },
  { month: 'Jul', revenue: 890000, orders: 27800 },
];

export const mockUsers = [
  { id: 'USR-1001', name: 'Alexander Wright', email: 'alex.w@example.com', phone: '+1 555-0192', status: 'Active', verification: 'Verified', ordersCount: 42, walletBalance: '₹450.00', joinedDate: '2025-01-15', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: 'USR-1002', name: 'Sophia Chen', email: 'sophia.c@example.com', phone: '+1 555-0144', status: 'Active', verification: 'Verified', ordersCount: 19, walletBalance: '₹120.50', joinedDate: '2025-02-01', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
  { id: 'USR-1003', name: 'Marcus Vance', email: 'marcus.v@example.com', phone: '+1 555-0188', status: 'Suspended', verification: 'Unverified', ordersCount: 3, walletBalance: '₹0.00', joinedDate: '2025-03-10', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 'USR-1004', name: 'Emily Watson', email: 'emily.w@example.com', phone: '+1 555-0177', status: 'Active', verification: 'Verified', ordersCount: 88, walletBalance: '₹1,290.00', joinedDate: '2024-11-20', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: 'USR-1005', name: 'David Miller', email: 'david.m@example.com', phone: '+1 555-0123', status: 'Pending', verification: 'Pending', ordersCount: 0, walletBalance: '₹0.00', joinedDate: '2025-07-26', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
];

export const mockSellers = [
  { id: 'SLR-801', storeName: 'Apex Wholesale Grocery', ownerName: 'Robert Vance', email: 'contact@apexgrocery.com', phone: '+1 555-9011', status: 'Active', rating: 4.9, productsCount: 340, totalRevenue: '₹480,200', warehouse: 'Central Hub NYC', kycStatus: 'Approved' },
  { id: 'SLR-802', storeName: 'FreshHarvest Farms & Co.', ownerName: 'Elena Rostova', email: 'elena@freshharvest.com', phone: '+1 555-9022', status: 'Pending Approval', rating: 4.7, productsCount: 120, totalRevenue: '₹45,000', warehouse: 'West Coast Hub LA', kycStatus: 'Pending' },
  { id: 'SLR-803', storeName: 'Global ColdChain Logistics', ownerName: 'Michael Sterling', email: 'info@globalcoldchain.com', phone: '+1 555-9033', status: 'Active', rating: 4.8, productsCount: 510, totalRevenue: '₹920,000', warehouse: 'Midwest Metro Hub', kycStatus: 'Approved' },
  { id: 'SLR-804', storeName: 'BioFresh Organics', ownerName: 'Sarah Jenkins', email: 'sarah@biofresh.org', phone: '+1 555-9044', status: 'Suspended', rating: 3.8, productsCount: 65, totalRevenue: '₹18,400', warehouse: 'South Distribution Hub', kycStatus: 'Flagged' },
];

export const mockCaptains = [
  { id: 'DRV-401', name: 'Carlos Rodriguez', phone: '+1 555-4011', vehicle: 'Heavy Cargo Van - Ford Transit', license: 'DL-994821', status: 'On Delivery', currentOrder: 'ORD-99201', rating: 4.95, location: 'Downtown Hub Sector 4', kyc: 'Verified' },
  { id: 'DRV-402', name: 'James Wilson', phone: '+1 555-4022', vehicle: 'Refrigerated Truck 3T', license: 'DL-883109', status: 'Available', currentOrder: 'None', rating: 4.88, location: 'North Cargo Terminal', kyc: 'Verified' },
  { id: 'DRV-403', name: 'Amira Patel', phone: '+1 555-4033', vehicle: 'Electric Express Van', license: 'DL-772940', status: 'Pending Approval', currentOrder: 'None', rating: 5.0, location: 'Offline', kyc: 'Pending Review' },
  { id: 'DRV-404', name: 'Dmitri Volkov', phone: '+1 555-4044', vehicle: 'Flatbed Carrier 5T', license: 'DL-552911', status: 'Off Duty', currentOrder: 'None', rating: 4.75, location: 'South Depot Base', kyc: 'Verified' },
];

export const mockWarehouses = [
  { 
    id: 'WH-01', 
    name: 'Central East Coast Hub', 
    city: 'New York, NY', 
    address: '450 Industrial Pkwy, Sector 4, Queens, NY 11101, USA',
    lat: '40.7420° N',
    lng: '73.9350° W',
    phone: '+1 (212) 555-0192',
    capacity: '85,000 sq ft', 
    utilization: 82, 
    totalSellers: 140, 
    activeOrders: 310, 
    manager: 'Arthur Pendelton', 
    status: 'Operational',
    hours: '24/7 Operations'
  },
  { 
    id: 'WH-02', 
    name: 'West Coast Logistics Terminal', 
    city: 'Los Angeles, CA', 
    address: '1280 Harbor Blvd, Bay Area, Los Angeles, CA 90731, USA',
    lat: '33.7405° N',
    lng: '118.2721° W',
    phone: '+1 (310) 555-0144',
    capacity: '120,000 sq ft', 
    utilization: 91, 
    totalSellers: 210, 
    activeOrders: 480, 
    manager: 'Linda Zhao', 
    status: 'Operational',
    hours: '06:00 AM - 11:00 PM'
  },
  { 
    id: 'WH-03', 
    name: 'Midwest Metro Fulfillment', 
    city: 'Chicago, IL', 
    address: '890 Logistics Way, O\'Hare Cargo Zone, Chicago, IL 60666, USA',
    lat: '41.9742° N',
    lng: '87.9073° W',
    phone: '+1 (312) 555-0188',
    capacity: '65,000 sq ft', 
    utilization: 64, 
    totalSellers: 95, 
    activeOrders: 185, 
    manager: 'Brian O\'Connor', 
    status: 'Operational',
    hours: '24/7 Operations'
  },
  { 
    id: 'WH-04', 
    name: 'Southern Cold Storage & Distribution', 
    city: 'Dallas, TX', 
    address: '2300 Freezer Terminal Rd, Fort Worth, Dallas, TX 76106, USA',
    lat: '32.7555° N',
    lng: '97.3308° W',
    phone: '+1 (214) 555-0177',
    capacity: '90,000 sq ft', 
    utilization: 78, 
    totalSellers: 115, 
    activeOrders: 240, 
    manager: 'Samantha Ray', 
    status: 'Operational',
    hours: '07:00 AM - 10:00 PM'
  },
];

export const mockCategories = [
  { id: 'CAT-1', name: 'Fresh Produce & Fruits', subCategoriesCount: 14, totalProducts: 1420, status: 'Active', icon: 'Apple' },
  { id: 'CAT-2', name: 'Dairy & Refrigerated', subCategoriesCount: 8, totalProducts: 850, status: 'Active', icon: 'Milk' },
  { id: 'CAT-3', name: 'Beverages & Soft Drinks', subCategoriesCount: 12, totalProducts: 2100, status: 'Active', icon: 'Coffee' },
  { id: 'CAT-4', name: 'Dry Grains & Wholesale Staples', subCategoriesCount: 18, totalProducts: 3400, status: 'Active', icon: 'Wheat' },
  { id: 'CAT-5', name: 'Frozen Goods & Meat', subCategoriesCount: 10, totalProducts: 980, status: 'Active', icon: 'Drumstick' },
];

export const mockProducts = [
  { id: 'PRD-9001', name: 'Premium Organic Hass Avocados (Case of 48)', sku: 'AVO-HS-48', category: 'Fresh Produce', price: '₹44.50', stock: 450, minOrderQty: 5, seller: 'FreshHarvest Farms', status: 'In Stock', rating: 4.9, image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&auto=format&fit=crop&q=80' },
  { id: 'PRD-9002', name: 'Grade A Whole Pasteurized Milk 1G (Pack of 6)', sku: 'MLK-WHL-06', category: 'Dairy', price: '₹22.00', stock: 12, minOrderQty: 10, seller: 'Apex Wholesale Grocery', status: 'Low Stock', rating: 4.7, image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&auto=format&fit=crop&q=80' },
  { id: 'PRD-9003', name: 'Sparkling Natural Spring Water 500ml (24 Bottles)', sku: 'WTR-SPR-24', category: 'Beverages', price: '₹14.20', stock: 1800, minOrderQty: 20, seller: 'Global ColdChain Logistics', status: 'In Stock', rating: 4.85, image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=300&auto=format&fit=crop&q=80' },
  { id: 'PRD-9004', name: 'Extra Virgin Olive Oil 5L Commercial Container', sku: 'OIL-EV-5L', category: 'Wholesale Staples', price: '₹58.00', stock: 0, minOrderQty: 2, seller: 'BioFresh Organics', status: 'Out of Stock', rating: 4.6, image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&auto=format&fit=crop&q=80' },
];

export const mockOrders = [
  { id: 'ORD-99201', customer: 'Alexander Wright', seller: 'Apex Wholesale Grocery', captain: 'Carlos Rodriguez', itemsCount: 14, total: '₹1,480.00', status: 'In Transit', warehouse: 'Central East Coast Hub', date: '2026-07-27 14:30', paymentStatus: 'Paid (Escrow)' },
  { id: 'ORD-99202', customer: 'Sophia Chen', seller: 'FreshHarvest Farms & Co.', captain: 'James Wilson', itemsCount: 8, total: '₹640.50', status: 'Dispatched', warehouse: 'West Coast Logistics Terminal', date: '2026-07-27 15:10', paymentStatus: 'Paid' },
  { id: 'ORD-99203', customer: 'Metro Cafe Group', seller: 'Global ColdChain Logistics', captain: 'Unassigned', itemsCount: 45, total: '₹4,890.00', status: 'Processing', warehouse: 'Midwest Metro Fulfillment', date: '2026-07-27 16:05', paymentStatus: 'Pending Settlement' },
  { id: 'ORD-99204', customer: 'Emily Watson', seller: 'BioFresh Organics', captain: 'Dmitri Volkov', itemsCount: 6, total: '₹310.00', status: 'Delivered', warehouse: 'Southern Cold Storage', date: '2026-07-27 11:20', paymentStatus: 'Completed' },
  { id: 'ORD-99205', customer: 'Grand Bistro NYC', seller: 'Apex Wholesale Grocery', captain: 'Unassigned', itemsCount: 22, total: '₹2,150.00', status: 'Cancelled', warehouse: 'Central East Coast Hub', date: '2026-07-27 09:15', paymentStatus: 'Refunded' },
];

export const mockDeliveries = [
  { id: 'DEL-8801', orderId: 'ORD-99201', captain: 'Carlos Rodriguez', vehicle: 'Ford Transit Van', pickup: 'Central East Coast Hub', dropoff: 'Midtown Commercial Kitchen #4', status: 'On The Way', eta: '18 mins', otpVerified: true, progressPercent: 70 },
  { id: 'DEL-8802', orderId: 'ORD-99202', captain: 'James Wilson', vehicle: 'Refrigerated 3T Truck', pickup: 'West Coast Logistics', dropoff: 'Sunset Blvd Organic Market', status: 'Assigned', eta: '45 mins', otpVerified: false, progressPercent: 20 },
  { id: 'DEL-8803', orderId: 'ORD-99204', captain: 'Dmitri Volkov', vehicle: 'Flatbed Carrier', pickup: 'Southern Cold Storage', dropoff: 'Dallas Fresh Foods Outlet', status: 'Completed', eta: 'Delivered at 11:20 AM', otpVerified: true, progressPercent: 100 },
];

export const mockPayments = [
  { id: 'TXN-90901', orderId: 'ORD-99201', amount: '₹1,480.00', fee: '₹29.60', net: '₹1,450.40', method: 'Stripe Direct Credit Card', status: 'Success', date: '2026-07-27 14:31' },
  { id: 'TXN-90902', orderId: 'ORD-99202', amount: '₹640.50', fee: '₹12.81', net: '₹627.69', method: 'Sathi Seller Business Wallet', status: 'Success', date: '2026-07-27 15:11' },
  { id: 'TXN-90903', orderId: 'ORD-99205', amount: '₹2,150.00', fee: '₹0.00', net: '-₹2,150.00', method: 'Automatic Refund', status: 'Refunded', date: '2026-07-27 09:20' },
];

export const mockCoupons = [
  { id: 'CPN-SUMMER26', code: 'SUMMER26', discount: '15% OFF', type: 'Percentage', usageLimit: 500, usedCount: 312, validTill: '2026-08-31', status: 'Active' },
  { id: 'CPN-BULKFRESH', code: 'BULKFRESH100', discount: '₹100.00 OFF', type: 'Fixed Amount', usageLimit: 100, usedCount: 88, validTill: '2026-09-15', status: 'Active' },
  { id: 'CPN-WELCOME10', code: 'WELCOME10', discount: '10% OFF', type: 'Percentage', usageLimit: 2000, usedCount: 1950, validTill: '2026-12-31', status: 'Active' },
];

export const mockNotifications = [
  { id: 'NOTIF-1', title: 'New Seller Registration Pending', message: 'FreshHarvest Farms & Co. submitted KYC verification documents.', type: 'Alert', time: '10 minutes ago', isRead: false },
  { id: 'NOTIF-2', title: 'Warehouse High Capacity Warning', message: 'West Coast Logistics Terminal reached 91% total storage capacity.', type: 'Warning', time: '45 minutes ago', isRead: false },
  { id: 'NOTIF-3', title: 'Daily Settlement Processed', message: 'Automated escrow payout of ₹142,500 disbursed to 84 sellers.', type: 'Success', time: '3 hours ago', isRead: true },
];

export const mockRoles = [
  { id: 'ROLE-1', name: 'Super Administrator', members: 3, permissions: 'All Access (System Level)', badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { id: 'ROLE-2', name: 'Warehouse Supervisor', members: 12, permissions: 'Inventory, Orders, Deliveries, Stock', badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { id: 'ROLE-3', name: 'Finance & Compliance Officer', members: 5, permissions: 'Payments, Settlements, KYC, Refunds', badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { id: 'ROLE-4', name: 'Customer Operations Manager', members: 18, permissions: 'Users, Captains, Support, Reports', badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
];

export const mockFaqs = [
  { id: 1, category: 'General (Visible to all)', question: 'How do I place an order on Sathi Seller?', answer: 'To place an order, browse products, add them to your cart, select your delivery address, and complete payment.' },
  { id: 2, category: 'Customer', question: 'How can I track my shipment live?', answer: 'Go to your Orders section or enter your tracking ID on the Track Order page for real-time GPS tracking updates.' },
  { id: 3, category: 'Seller', question: 'What is the settlement payout cycle for sellers?', answer: 'Payouts are automatically generated every Monday directly into your registered bank account.' },
  { id: 4, category: 'Delivery Captain', question: 'How do I accept delivery requests?', answer: 'Toggle your status to Available in the Captain app to receive nearby instant delivery alerts.' },
  { id: 5, category: 'General (Visible to all)', question: 'What payment options are supported?', answer: 'Sathi Seller supports credit/debit cards, UPI, net banking, wallet balances, and Cash on Delivery.' }
];

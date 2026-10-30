// Promotion Module Initial Mock Data Store for Sathi Seller Admin CMS

export const initialPromotionStats = {
  activeCampaigns: 14,
  scheduledPromos: 6,
  totalImpressions: '1.4M',
  conversionRate: '4.8%',
  revenueGenerated: '₹348,900'
};

export const initialHomeSections = [
  { id: 'sec-1', name: 'Hero Promotional Banners (Big Savings)', type: 'Hero Banner', priority: 1, isVisible: true, itemsCount: 1, updatedAt: '2026-07-29', badge: 'Active' },
  { id: 'sec-2', name: 'Shop Categories Grid', type: 'Category Grid', priority: 2, isVisible: true, itemsCount: 8, updatedAt: '2026-07-29', badge: 'Active' },
  { id: 'sec-3', name: 'Flash Deals (Limited Time Offers)', type: 'Product Carousel', priority: 3, isVisible: true, itemsCount: 3, updatedAt: '2026-07-28', badge: 'Active' },
  { id: 'sec-4', name: 'Best Selling Products', type: 'Product Grid', priority: 4, isVisible: true, itemsCount: 4, updatedAt: '2026-07-28', badge: 'Active' }
];

export const initialCategoryProducts = [
  { id: 'CAT-PROD-01', title: 'Daily Essentials & Groceries', category: 'Grocery', productIds: ['P-101', 'P-102', 'P-103', 'P-104'], priority: 1, status: 'Active', badge: 'Popular' },
  { id: 'CAT-PROD-02', title: 'Farm Fresh Vegetables & Fruits', category: 'Fresh Produce', productIds: ['P-105', 'P-106'], priority: 2, status: 'Active', badge: 'Fresh Harvest' },
  { id: 'CAT-PROD-03', title: 'Beverages & Soft Drinks', category: 'Beverages', productIds: ['P-107', 'P-108'], priority: 3, status: 'Inactive', badge: 'Summer Chill' },
];

export const initialBestsellers = [
  { id: 'BS-01', name: 'Fresh Organic Whole Milk (1L)', originalPrice: '₹75.00', promoPrice: '₹62.00', badge: 'Top Seller', priority: 1, status: 'Active', salesCount: 1420 },
  { id: 'BS-02', name: 'Premium Basmati Rice (5kg)', originalPrice: '₹590.00', promoPrice: '₹499.00', badge: 'Hot Offer', priority: 2, status: 'Active', salesCount: 980 },
  { id: 'BS-03', name: 'Extra Virgin Olive Oil (500ml)', originalPrice: '₹850.00', promoPrice: '₹720.00', badge: 'Best Value', priority: 3, status: 'Active', salesCount: 650 },
  { id: 'BS-04', name: 'Farm Fresh Farm Eggs (Pack of 12)', originalPrice: '₹120.00', promoPrice: '₹95.00', badge: 'Customer Favorite', priority: 4, status: 'Inactive', salesCount: 2100 }
];

export const initialPromoStrips = [
  { id: 'STRIP-01', title: 'Flat 20% Cashback on First Express Booking', subtitle: 'Use Code: EXPRESSTODAY', bgGradient: 'from-orange-500 to-amber-500', ctaText: 'Claim Now', redirectUrl: '/category/express', priority: 1, status: 'Active', startDate: '2026-07-01', endDate: '2026-08-15' },
  { id: 'STRIP-02', title: 'Free Weekend Delivery on Orders Above ₹499', subtitle: 'No Promo Code Required', bgGradient: 'from-emerald-600 to-teal-700', ctaText: 'Shop Groceries', redirectUrl: '/category/grocery', priority: 2, status: 'Active', startDate: '2026-07-20', endDate: '2026-08-31' }
];

export const initialLowestPrices = [
  { id: 'LP-01', productName: 'Fresh Red Tomatoes (1kg)', mode: 'Automatic', marketPrice: '₹60.00', lowestPrice: '₹34.00', discountPercent: '43%', badge: 'Lowest Guaranteed', priority: 1, status: 'Active' },
  { id: 'LP-02', productName: 'Farm Fresh Potatoes (2kg)', mode: 'Manual', marketPrice: '₹80.00', lowestPrice: '₹48.00', discountPercent: '40%', badge: 'Super Saver', priority: 2, status: 'Active' },
  { id: 'LP-03', productName: 'Fresh Golden Bananas (1 Dozen)', mode: 'Automatic', marketPrice: '₹70.00', lowestPrice: '₹42.00', discountPercent: '40%', badge: 'Price Drop', priority: 3, status: 'Inactive' }
];

export const initialFeaturedStores = [
  { id: 'STR-01', storeName: 'Apex Wholesale Grocery', owner: 'Robert Vance', logo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=150&auto=format&fit=crop&q=80', banner: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&auto=format&fit=crop&q=80', tag: 'Superstore', priority: 1, status: 'Active' },
  { id: 'STR-02', storeName: 'FreshHarvest Farms & Co.', owner: 'Elena Rostova', logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&auto=format&fit=crop&q=80', banner: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&auto=format&fit=crop&q=80', tag: 'Organic Specialty', priority: 2, status: 'Active' }
];

export const initialBanners = [
  { id: 'BAN-01', title: 'Mega Grocery Monsoon Sale', position: 'Hero Banner', desktopImg: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80', mobileImg: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80', cta: 'Shop Deals', redirect: '/category/deals', priority: 1, status: 'Active' },
  { id: 'BAN-02', title: 'Fastest 15-Min Delivery Guarantee', position: 'Mid Banner', desktopImg: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&auto=format&fit=crop&q=80', mobileImg: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&auto=format&fit=crop&q=80', cta: 'Order Now', redirect: '/transport', priority: 2, status: 'Active' }
];

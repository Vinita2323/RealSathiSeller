import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { useLocationContext } from '../../../context/LocationContext';
import { applySavedAddressesAsDeliveryLocation, isDeliverableLocation, clearStoredUserLocation } from '../../../utils/userLocation';
import { addressService, bannerService, categoryService, productService, sellerService } from '../../../services/authService';
import { Wrench as RepairWrenchIcon } from 'lucide-react';
import { 
  Bell, 
  ShoppingCart, 
  ChevronDown, 
  Search, 
  ScanLine, 
  Wheat, 
  Droplet,
  Flame,
  Coffee,
  ShoppingBag,
  Utensils,
  Sparkles, 
  Home as HomeIcon, 
  Zap, 
  Plus,
  Minus,
  Check,
  Heart,
  MapPin,
  Mic,
  Gamepad2,
  Trash2,
  Store,
  Star,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import grainsImg from '../../../assets/user/categories/grains-removebg-preview.png';
import oilGheeImg from '../../../assets/user/categories/OilGhee-removebg-preview.png';
import masalaImg from '../../../assets/user/categories/masala-removebg-preview.png';
import sugarImg from '../../../assets/user/categories/Sugar-removebg-preview.png';
import groceryImg from '../../../assets/user/categories/Grocery-removebg-preview.png';
import readyCookImg from '../../../assets/user/categories/readyfoot-removebg-preview.png';
import homeCareImg from '../../../assets/user/categories/homecare-removebg-preview.png';
import personalCareImg from '../../../assets/user/categories/personalcare-removebg-preview.png';
import { getImageUrl, getCategoryFallbackImage, handleImageError } from '../../../utils/imageUtils';
import { getCachedData, setCachedData, isCacheStale } from '../../../utils/dataCache';

const HOME_CACHE_KEY = 'home_data';
const HOME_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const Home = () => {
  const navigate = useNavigate();
  const { addToCart, updateQuantity, getItemQuantity, isInCart, cartCount, removeFromCart } = useCart();
  const { wishlistCount } = useWishlist();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const locationContext = useLocationContext();
  const deliveryLocation = isDeliverableLocation(locationContext?.currentLocation)
    ? locationContext.currentLocation
    : null;
  const deliveryLabel = deliveryLocation?.addressLine1 || deliveryLocation?.address || deliveryLocation?.area || deliveryLocation?.city || 'Select Location';
  const deliveryType = (deliveryLocation?.addressType || deliveryLocation?.type || '').toUpperCase();
  const [toastMessage, setToastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [apiSearchResults, setApiSearchResults] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const bannerTouchRef = useRef({ startX: 0, startY: 0, swiping: false, didSwipe: false });
  const bannerTimerRef = useRef(null);

  const calcFlashTimeLeft = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const diff = Math.max(0, end.getTime() - now.getTime());
    return {
      hours: Math.floor(diff / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [flashTimeLeft, setFlashTimeLeft] = useState(calcFlashTimeLeft);

  const userLat = locationContext?.currentLocation?.lat || locationContext?.currentLocation?.latitude;
  const userLng = locationContext?.currentLocation?.lng || locationContext?.currentLocation?.longitude;

  const homeCacheKey = (userLat != null && userLng != null) 
    ? `home_data_${Number(userLat).toFixed(3)}_${Number(userLng).toFixed(3)}`
    : 'home_data_default';

  const cachedHome = getCachedData(homeCacheKey);
  const [banners, setBanners] = useState(cachedHome?.banners || []);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [categories, setCategories] = useState(cachedHome?.categories || []);
  const [sellers, setSellers] = useState(cachedHome?.sellers || []);
  const [flashDeals, setFlashDeals] = useState(cachedHome?.flashDeals || []);
  const [bestsellerProducts, setBestsellerProducts] = useState(cachedHome?.bestsellerProducts || []);

  useEffect(() => {
    let cancelled = false;
    if (!localStorage.getItem('sathiseller_user_token')) return undefined;
    (async () => {
      try {
        const res = await addressService.getAddresses();
        if (cancelled || !res?.success || !Array.isArray(res.addresses)) return;
        localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(res.addresses));
        if (res.addresses.length === 0) {
          const hasSelectedLocation = localStorage.getItem('userLocation') && localStorage.getItem('sathiseller_selected_checkout_address');
          if (!hasSelectedLocation) clearStoredUserLocation();
        } else {
          applySavedAddressesAsDeliveryLocation(res.addresses);
        }
      } catch (e) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const formatItem = (p) => {
      const salePrice = Number(p.salePrice || p.price || 0);
      const mrp = Number(p.mrp || p.originalPrice || salePrice);
      let discountStr = p.discount;
      if (!discountStr && mrp > salePrice) {
        const pct = Math.round(((mrp - salePrice) / mrp) * 100);
        discountStr = `${pct}% OFF`;
      }
        return {
          // Prefer Mongo _id so cart add/remove keys match (sku-only ids break REMOVE)
          id: p._id || p.id || p.sku || `p_${Math.random()}`,
          _id: p._id || p.id,
          name: p.name,
          seller: p.seller || 'Verified Seller',
          price: salePrice,
          originalPrice: mrp,
          discount: discountStr || '',
          image: p.image || p.mainImage || grainsImg,
          unit: p.unit || `${p.unitValue || 1} ${p.unitType || 'kg'}`
        };
      };

    const loadAllHomeData = async () => {
      try {
        const locationParams = (userLat != null && userLng != null) ? { lat: userLat, lng: userLng } : {};

        const [bannersRes, categoriesRes, sellersRes, flashRes, bestRes] = await Promise.allSettled([
          bannerService.getBanners(),
          categoryService.getCategories(),
          sellerService.getPublicSellers(locationParams),
          productService.getProducts({ section: 'flash_sale', ...locationParams }),
          productService.getProducts({ section: 'bestseller', ...locationParams })
        ]);

        if (!isMounted) return;

        let latestBanners = cachedHome?.banners || [];
        let latestCategories = cachedHome?.categories || [];
        let latestSellers = [];

        // Process Banners
        if (bannersRes.status === 'fulfilled' && bannersRes.value?.success && Array.isArray(bannersRes.value.banners)) {
          const active = bannersRes.value.banners.filter(b => b.status === 'Active');
          if (active.length > 0) {
            latestBanners = active;
            setBanners(active);
          }
        }

        // Process Categories
        if (categoriesRes.status === 'fulfilled' && categoriesRes.value?.success && Array.isArray(categoriesRes.value.categories)) {
          const active = categoriesRes.value.categories.filter(c => c.status === 'Active');
          const roots = active.filter(c => !c.parent);
          if (roots.length > 0) {
            latestCategories = roots;
            setCategories(roots);
          }
        }

        // Process Sellers
        if (sellersRes.status === 'fulfilled' && sellersRes.value?.success && Array.isArray(sellersRes.value.sellers)) {
          latestSellers = sellersRes.value.sellers;
          setSellers(sellersRes.value.sellers);
        } else {
          latestSellers = [];
          setSellers([]);
        }

        // Process Flash Deals
        let flashApi = [];
        if (flashRes.status === 'fulfilled' && flashRes.value?.products && Array.isArray(flashRes.value.products)) {
          flashApi = flashRes.value.products;
        }
        const combinedFlash = flashApi.map(p => formatItem(p));
        setFlashDeals(combinedFlash);

        // Process Bestsellers
        let bestApi = [];
        if (bestRes.status === 'fulfilled' && bestRes.value?.products && Array.isArray(bestRes.value.products)) {
          bestApi = bestRes.value.products;
        }
        const combinedBest = bestApi.map(p => formatItem(p));
        setBestsellerProducts(combinedBest);

        setCachedData(homeCacheKey, {
          banners: latestBanners,
          categories: latestCategories,
          sellers: latestSellers,
          flashDeals: combinedFlash,
          bestsellerProducts: combinedBest,
        });

      } catch (err) {
        console.error('[Home] Failed to load home screen data:', err);
      }
    };

    loadAllHomeData();

    const handleLocChange = () => {
      loadAllHomeData();
    };
    window.addEventListener('sathiseller_location_changed', handleLocChange);

    return () => {
      isMounted = false;
      window.removeEventListener('sathiseller_location_changed', handleLocChange);
    };
  }, [userLat, userLng]);

  // Live flash-deal countdown (end of local day — same as FlashSale page)
  useEffect(() => {
    const timer = setInterval(() => setFlashTimeLeft(calcFlashTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll banners every 3.5 seconds with fade transition
  useEffect(() => {
    if (banners.length <= 1) return;
    const start = () => {
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
      bannerTimerRef.current = setInterval(() => {
        setBannerVisible(false);
        setTimeout(() => {
          setCurrentBannerIndex(prev => (prev + 1) % banners.length);
          setBannerVisible(true);
        }, 300);
      }, 3500);
    };
    start();
    return () => {
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
    };
  }, [banners]);

  // Hide bottom nav while searching so the mobile keyboard does not cover footer actions
  useEffect(() => {
    const active = searchFocused || Boolean(String(searchQuery || '').trim());
    window.dispatchEvent(new CustomEvent('sathiseller_search_ui', { detail: { active } }));
    return () => {
      window.dispatchEvent(new CustomEvent('sathiseller_search_ui', { detail: { active: false } }));
    };
  }, [searchFocused, searchQuery]);

  const goBanner = (dir) => {
    if (banners.length <= 1) return;
    if (bannerTimerRef.current) {
      clearInterval(bannerTimerRef.current);
      bannerTimerRef.current = setInterval(() => {
        setBannerVisible(false);
        setTimeout(() => {
          setCurrentBannerIndex(prev => (prev + 1) % banners.length);
          setBannerVisible(true);
        }, 300);
      }, 3500);
    }
    setBannerVisible(false);
    setTimeout(() => {
      setCurrentBannerIndex((prev) => {
        const next = (prev + dir + banners.length) % banners.length;
        return next;
      });
      setBannerVisible(true);
    }, 200);
  };

  const onBannerTouchStart = (e) => {
    const t = e.changedTouches?.[0] || e.touches?.[0];
    if (!t) return;
    bannerTouchRef.current = { startX: t.clientX, startY: t.clientY, swiping: true, didSwipe: false };
  };

  const onBannerTouchEnd = (e) => {
    if (!bannerTouchRef.current.swiping) return;
    bannerTouchRef.current.swiping = false;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - bannerTouchRef.current.startX;
    const dy = t.clientY - bannerTouchRef.current.startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    bannerTouchRef.current.didSwipe = true;
    goBanner(dx < 0 ? 1 : -1);
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  const formatSearchProduct = (p) => {
    const salePrice = Number(p.salePrice || p.price || 0);
    const mrp = Number(p.mrp || p.originalPrice || salePrice);
    let discountStr = p.discount;
    if (!discountStr && mrp > salePrice) {
      const pct = Math.round(((mrp - salePrice) / mrp) * 100);
      discountStr = `${pct}% OFF`;
    }
    return {
      id: p._id || p.id || p.sku || `p_${Math.random()}`,
      _id: p._id || p.id,
      name: p.name,
      seller: p.seller || 'Verified Seller',
      price: salePrice,
      originalPrice: mrp,
      discount: discountStr || '',
      image: p.image || p.mainImage || grainsImg,
      unit: p.unit || `${p.unitValue || 1} ${p.unitType || 'kg'}`,
    };
  };

  const runCatalogSearch = async (query) => {
    const q = String(query || '').trim();
    if (!q) {
      setApiSearchResults([]);
      return;
    }
    try {
      const locationParams = (userLat != null && userLng != null) ? { lat: userLat, lng: userLng } : {};
      const res = await productService.getProducts({ search: q, limit: 40, ...locationParams });
      if (res?.success && Array.isArray(res.products)) {
        setApiSearchResults(res.products.map(formatSearchProduct));
      } else {
        setApiSearchResults([]);
      }
    } catch (err) {
      console.error('Catalog search failed:', err);
      setApiSearchResults([]);
    }
  };

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToastMessage('Voice search is not supported in this browser. Try Chrome.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setToastMessage('Microphone needs HTTPS (or localhost).');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch {
      // prior recognition may already be stopped
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setToastMessage('Listening… Speak now');
    };

    recognition.onresult = (e) => {
      const transcript = String(e.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) {
        setSearchQuery(transcript);
        setToastMessage(`Searching “${transcript}”…`);
        runCatalogSearch(transcript).finally(() => {
          setToastMessage('');
        });
      } else {
        setToastMessage('Could not catch that. Try again.');
        setTimeout(() => setToastMessage(''), 2500);
      }
    };

    recognition.onerror = (e) => {
      setIsListening(false);
      const code = e?.error || 'unknown';
      const messages = {
        'not-allowed': 'Microphone permission blocked. Allow mic in browser settings.',
        'no-speech': 'No speech detected. Tap mic and try again.',
        'audio-capture': 'No microphone found on this device.',
        'network': 'Speech service network error. Check internet.',
        'aborted': '',
      };
      const msg = messages[code] !== undefined ? messages[code] : `Mic error: ${code}`;
      if (msg) {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      setToastMessage((prev) => (prev === 'Listening… Speak now' ? '' : prev));
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
      setToastMessage('Could not start microphone. Try again.');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const allLoadedProducts = [...flashDeals, ...bestsellerProducts];
  const localSearchResults = searchQuery
    ? allLoadedProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];
  const searchResults = (() => {
    if (!searchQuery) return [];
    const byId = new Map();
    [...apiSearchResults, ...localSearchResults].forEach((p) => {
      byId.set(String(p.id), p);
    });
    return Array.from(byId.values());
  })();

  const handleAddToCart = async (product) => {
    const res = await addToCart(product, 1, { navigate, returnUrl: window.location.pathname });
    if (res && res.success) {
      setToastMessage(`${product.name} added to cart!`);
      setTimeout(() => {
        setToastMessage('');
      }, 3000);
    }
  };

  return (
    <div className="w-full h-[100dvh] md:h-auto md:min-h-screen bg-white font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none overflow-y-auto md:overflow-visible overflow-x-hidden hide-scrollbar [&::-webkit-scrollbar]:hidden px-0 md:px-0 md:py-6">
      {/* Top Header Section with Dark Orange Background (Mobile Only) */}
      <div className="md:hidden bg-gradient-to-r from-[#ea580c] to-[#f97316] rounded-b-[20px] pb-3 mb-4 shadow-sm sticky top-0 z-30 pt-1">
        {/* Header Section */}
        <header className="flex justify-between items-center px-4 pt-1.5 pb-2.5">
          <div className="flex items-center flex-1">
            <div className="bg-white rounded-xl p-1 shadow-sm flex items-center justify-center w-11 h-11 shrink-0">
              <img src="/Logo.png" alt="Sathi Seller Logo" className="w-full h-full object-contain" />
            </div>
            
            <div className="flex flex-col ml-3 text-white cursor-pointer overflow-hidden" onClick={() => navigate('/location')}>
               <div className="text-[10px] font-semibold opacity-90 flex items-center">
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                   Deliver to
               </div>
               <div className="text-[13px] font-bold leading-tight truncate max-w-[140px]">
                   {deliveryLabel}
               </div>
            </div>
          </div>
          <div className="flex gap-4 items-center pr-1 shrink-0">
            <div className="relative cursor-pointer" onClick={() => navigate('/notifications')}>
              <Bell size={22} color="white" strokeWidth={1.8} />
              {notificationUnreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-white text-[#ea580c] text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-sm border border-[#ea580c]/30">
                  {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                </span>
              )}
            </div>
            <div className="cursor-pointer relative" onClick={() => navigate('/wishlist')}>
              <Heart size={22} color="white" strokeWidth={1.8} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-white text-[#ea580c] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </div>
            <div className="cursor-pointer relative" onClick={() => navigate('/cart')}>
              <ShoppingCart size={22} color="white" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-white text-[#ea580c] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Address Section */}
        <div className="px-4 pb-2.5">
          <div 
            onClick={() => navigate('/location')}
            className="flex items-center justify-between bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl px-3 py-2 text-white cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <MapPin size={16} className="shrink-0 text-white" />
              <div className="text-[12px] flex items-center gap-1.5 truncate">
                {deliveryLocation && deliveryType ? (
                  <>
                    <span className="font-extrabold uppercase tracking-wider shrink-0">
                      {deliveryType}
                    </span>
                    <span className="text-white/60 font-light mx-0.5 shrink-0">|</span>
                  </>
                ) : null}
                <span className="font-medium text-[12px] truncate">
                  {deliveryLabel}
                </span>
              </div>
            </div>
            <ChevronDown size={16} className="text-white/90 shrink-0 ml-1" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-2.5 flex gap-2.5">
          <div className="flex-1 flex items-center bg-white rounded-[14px] px-3 py-2 shadow-sm">
            <Search size={18} className="text-slate-400 mr-2" strokeWidth={2.5} />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (!val.trim()) setApiSearchResults([]);
              }}
              className="flex-1 border-none outline-none text-[14px] bg-transparent text-slate-700 placeholder:text-slate-400 font-medium"
            />
            <Mic
              size={18}
              className={`cursor-pointer ml-1 shrink-0 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
              strokeWidth={2}
              onClick={handleMicClick}
              aria-label={isListening ? 'Listening' : 'Search by voice'}
            />
          </div>
        </div>
      </div>

      <div className="px-3.5 md:px-5">
        {searchQuery ? (
          <div className="pb-4">
            <h3 className="text-[16px] md:text-xl font-bold mb-4 text-[#ff5500]">Search Results for "{searchQuery}"</h3>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                {searchResults.map(product => (
                    <div key={product.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col">
                      <img 
                        onClick={() => navigate(`/product/${product.id}`)} 
                        src={getImageUrl(product.image, product.name)} 
                        alt={product.name} 
                        loading="lazy" 
                        decoding="async" 
                        className="w-full h-[110px] object-cover bg-slate-50 cursor-pointer"
                        onError={(e) => handleImageError(e, product.name)} 
                      />
                      <div className="flex flex-col p-3 pt-2">
                      <h4 className="text-[13px] font-bold m-0 mb-1 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{product.name}</h4>
                      <p className="text-[11px] text-slate-400 m-0 mb-0.5">{product.unit}</p>
                      <p className="text-[10px] font-medium text-slate-500 m-0 mb-2 truncate">by:- <span className="font-bold text-slate-700">{product.seller || 'Verified Seller'}</span></p>
                      <div className="flex justify-between items-end mt-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[14px] font-extrabold text-slate-900">₹{product.price.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 line-through">₹{product.originalPrice.toFixed(2)}</span>
                          {product.discount && <span className="text-[10px] font-extrabold text-[#ff5500]">{product.discount}</span>}
                        </div>
                        {!isInCart(product.id || product._id) ? (
                          <button 
                            onClick={() => handleAddToCart(product)} 
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-95 transition-all shrink-0"
                            aria-label="Add to cart"
                          >
                            <Plus size={13} strokeWidth={3} /> ADD
                          </button>
                        ) : (
                          <button 
                            onClick={() => removeFromCart(product.id || product._id)} 
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-95 transition-all shrink-0"
                            aria-label="Remove from cart"
                          >
                            <Trash2 size={12} strokeWidth={2.5} /> REMOVE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 font-medium">No products found matching "{searchQuery}".</div>
            )}
            <div className="h-[80px]"></div>
          </div>
        ) : (
          <>
        {/* Dynamic Promo Banner */}
        {banners.length > 0 ? (
          <div className="mb-5 md:mb-8">
            <div
              className="rounded-2xl md:rounded-3xl relative overflow-hidden shadow-md cursor-pointer w-full h-[140px] md:h-[300px] lg:h-[360px] bg-slate-100 touch-pan-y"
              style={{ transition: 'opacity 0.3s ease, transform 0.3s ease', opacity: bannerVisible ? 1 : 0, transform: bannerVisible ? 'translateY(0)' : 'translateY(6px)' }}
              onClick={() => {
                if (bannerTouchRef.current.didSwipe) {
                  bannerTouchRef.current.didSwipe = false;
                  return;
                }
                navigate(banners[currentBannerIndex]?.redirectUrl || '/categories');
              }}
              onTouchStart={onBannerTouchStart}
              onTouchEnd={onBannerTouchEnd}
            >
              <img
                src={getImageUrl(banners[currentBannerIndex]?.imageUrl, "/promo_banner_bg.png")}
                alt={banners[currentBannerIndex]?.title || "Promotional Banner"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/promo_banner_bg.png";
                }}
              />
            </div>
            {/* Dot Indicators */}
            {banners.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setBannerVisible(false); setTimeout(() => { setCurrentBannerIndex(i); setBannerVisible(true); }, 300); }}
                    className="border-none cursor-pointer p-0 rounded-full transition-all duration-300"
                    style={{ width: i === currentBannerIndex ? '20px' : '6px', height: '6px', background: i === currentBannerIndex ? '#ff5500' : '#cbd5e1' }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div 
            className="rounded-2xl md:rounded-3xl relative overflow-hidden mb-5 md:mb-8 shadow-md cursor-pointer w-full h-[140px] md:h-[300px] lg:h-[360px] bg-slate-100"
            onClick={() => navigate('/categories')}
          >
            <img 
              src="/promo_banner_bg.png" 
              alt="Promo Boxes" 
              className="w-full h-full object-cover" 
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/promo_banner_bg.png";
              }}
            />
          </div>
        )}

        {/* Dynamic Categories Grid */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[16px] md:text-xl font-bold m-0 text-[#ff5500]">Categories</h3>
          <button onClick={() => navigate('/categories')} className="bg-transparent border-none text-blue-600 text-[12px] md:text-sm font-semibold cursor-pointer hover:underline">See All</button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-y-4 gap-x-3 md:gap-6 mb-8 md:mb-10">
          {categories.length > 0 ? (
            categories.slice(0, 8).map((cat) => {
              const fallbackImg = getCategoryFallbackImage(cat.name);
              const imgSrc = getImageUrl(cat.image, fallbackImg);
              return (
                <div 
                  key={cat._id || cat.name} 
                  onClick={() => navigate(`/categories?category=${encodeURIComponent(cat.name)}`)}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div className="bg-white border border-slate-100 rounded-xl w-14 h-14 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] mb-2 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] overflow-hidden">
                    <img
                      src={imgSrc}
                      alt={cat.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={(e) => handleImageError(e, cat.name)}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
                    {cat.name}
                  </span>
                </div>
              );
            })
          ) : (
            <>
              <div className="flex flex-col items-center cursor-pointer group">
                <div className="bg-white border border-slate-100 rounded-xl w-14 h-14 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] mb-2 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]"><img src={grainsImg} alt="Grains & Flours" loading="lazy" decoding="async" className="w-10 h-10 object-contain" /></div>
                <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">Grains &<br/>Flours</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer group">
                <div className="bg-white border border-slate-100 rounded-xl w-14 h-14 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] mb-2 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]"><img src={oilGheeImg} alt="Oil & Ghee" loading="lazy" decoding="async" className="w-10 h-10 object-contain" /></div>
                <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">Oil & Ghee</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer group">
                <div className="bg-white border border-slate-100 rounded-xl w-14 h-14 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] mb-2 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]"><img src={masalaImg} alt="Spices & Masala" loading="lazy" decoding="async" className="w-10 h-10 object-contain" /></div>
                <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">Spices &<br/>Masala</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer group">
                <div className="bg-white border border-slate-100 rounded-xl w-14 h-14 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] mb-2 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]"><img src={sugarImg} alt="Sugar & Sweeteners" loading="lazy" decoding="async" className="w-10 h-10 object-contain" /></div>
                <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">Sugar &<br/>Sweeteners</span>
              </div>
            </>
          )}
        </div>

        {/* Repair & Services entry */}
        <button
          type="button"
          onClick={() => navigate('/repair')}
          className="w-full mb-8 md:mb-10 flex items-center justify-between gap-3 bg-gradient-to-r from-[#ff5500] to-[#ff8a3d] text-white rounded-2xl p-4 border-none cursor-pointer text-left shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <RepairWrenchIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] md:text-lg font-extrabold leading-tight">Repair &amp; Services</div>
              <div className="text-[11px] md:text-sm font-medium opacity-95">Phones, laptops, TVs &amp; appliances — free doorstep pickup</div>
            </div>
          </div>
          <span className="shrink-0 bg-white text-[#ff5500] text-[11px] font-extrabold px-3 py-1.5 rounded-full">Book Now</span>
        </button>

        {/* Flash Deals */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] md:text-xl font-bold m-0 text-[#ff5500]">Flash Deals</h3>
            <div className="flex items-center gap-1 font-bold text-blue-900" aria-label="Flash deal ends in">
              <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[12px]">{pad2(flashTimeLeft.hours)}</span>:
              <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[12px]">{pad2(flashTimeLeft.minutes)}</span>:
              <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[12px]">{pad2(flashTimeLeft.seconds)}</span>
            </div>
          </div>
          <button onClick={() => navigate('/flash-sale')} className="bg-transparent border-none text-blue-600 text-[12px] md:text-sm font-semibold cursor-pointer hover:underline">See All</button>
        </div>

        <div className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5 pb-4 hide-scrollbar [&::-webkit-scrollbar]:hidden mb-4">
          {flashDeals.length > 0 ? (
            flashDeals.map((prod) => (
              <div key={prod.id} className="min-w-[155px] max-w-[155px] md:min-w-0 md:max-w-none bg-white border border-slate-100 rounded-xl md:rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between">
                <div className="h-[125px] w-full overflow-hidden bg-slate-50 relative cursor-pointer" onClick={() => navigate(`/product/${prod.id}`)}>
                  <img 
                    src={getImageUrl(prod.image, prod.name)} 
                    alt={prod.name} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover" 
                    onError={(e) => handleImageError(e, prod.name)}
                  />
                </div>
                <div className="flex flex-col p-2.5 flex-1 justify-between gap-2">
                  <div>
                    <h4 className="text-[13px] font-bold m-0 mb-0.5 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{prod.name}</h4>
                    <p className="text-[11px] text-slate-400 m-0">{prod.unit}</p>
                    <p className="text-[10px] font-medium text-slate-500 m-0 mt-0.5 truncate">by:- <span className="font-bold text-slate-700">{prod.seller || 'Fashion Hub'}</span></p>
                  </div>
                  
                  <div className="flex items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[14px] font-extrabold text-slate-900">₹{prod.price.toFixed(2)}</span>
                      {prod.originalPrice > prod.price && (
                        <span className="text-[10px] text-slate-400 line-through">₹{prod.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                    {prod.discount && (
                      <span className="text-[9.5px] font-extrabold text-[#ff5500] whitespace-nowrap shrink-0">{prod.discount}</span>
                    )}
                  </div>

                  <div>
                    {!isInCart(prod.id || prod._id) ? (
                      <button 
                        onClick={() => handleAddToCart(prod)} 
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-98 transition-all"
                        aria-label="Add to cart"
                      >
                        <Plus size={14} strokeWidth={3} /> ADD
                      </button>
                    ) : (
                      <button 
                        onClick={() => removeFromCart(prod.id || prod._id)}
                        className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[12px] flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-98 transition-all"
                        aria-label="Remove from cart"
                      >
                        <Trash2 size={13} strokeWidth={2.5} /> REMOVE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full w-full py-6 px-4 bg-white rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-1.5">
              <ShoppingBag size={22} className="text-slate-300" />
              <p className="text-xs font-semibold text-slate-600 m-0">No flash deals available in your area</p>
            </div>
          )}
        </div>

        {/* Best Sellers (List of All Sellers / Top Stores) */}
        <div className="flex justify-between items-center mb-3 mt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] md:text-xl font-bold m-0 text-[#ff5500]">Best Sellers</h3>
            <span className="bg-amber-100 text-amber-900 text-[10.5px] md:text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
              <Sparkles size={11} className="text-amber-600 fill-amber-500" /> Top Stores
            </span>
          </div>
          <button onClick={() => navigate('/sellers')} className="bg-transparent border-none text-blue-600 text-[12px] md:text-sm font-semibold cursor-pointer hover:underline">See All</button>
        </div>

        <div className="flex overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-4 gap-3.5 md:gap-5 pb-4 hide-scrollbar [&::-webkit-scrollbar]:hidden mb-4">
          {sellers.length > 0 ? (
            sellers.map((seller) => (
              <div 
                key={seller._id || seller.businessName}
                onClick={() => navigate(`/store/${encodeURIComponent(seller._id || seller.businessName)}`)}
                className="min-w-[190px] max-w-[190px] md:min-w-0 md:max-w-none bg-white border border-slate-100/90 rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between cursor-pointer group hover:shadow-md transition-all shrink-0 md:shrink hover:-translate-y-0.5"
              >
                {/* Store Mini Banner & Logo */}
                <div className="h-20 w-full bg-slate-100 relative overflow-hidden">
                  <img 
                    src={seller.banner || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600&auto=format&fit=crop&q=80'} 
                    alt={seller.businessName} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
                  
                  {/* Rating Badge */}
                  <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-white/20">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    {seller.rating || 4.9}
                  </div>

                  {/* Store Avatar */}
                  <div className="absolute -bottom-2 left-2.5 w-10 h-10 rounded-xl bg-white p-0.5 shadow-md border border-white overflow-hidden">
                    <img 
                      src={seller.storeLogo || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=160&auto=format&fit=crop&q=80'} 
                      alt={seller.businessName} 
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                </div>

                {/* Store Details */}
                <div className="p-3 pt-3.5 flex flex-col justify-between flex-1 gap-2">
                  <div>
                    <h4 className="text-[13px] font-bold m-0 text-slate-800 truncate flex items-center gap-1">
                      {seller.businessName}
                      {seller.isVerified && (
                        <CheckCircle size={13} className="text-emerald-500 fill-emerald-100 shrink-0" />
                      )}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 m-0 mt-0.5 truncate">{seller.tagline || seller.businessType || 'Verified Merchant'}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-[10px] text-slate-400">
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      ⚡ {seller.deliveryTime || '15-25 min'}
                    </span>
                    <span className="font-bold text-[#ea580c] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Visit <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full w-full py-8 px-4 bg-white rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2">
              <Store size={26} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-700 m-0">No sellers available in your area</p>
              <p className="text-xs text-slate-400 m-0">Try selecting a different delivery location to discover stores nearby.</p>
              <button 
                onClick={() => navigate('/select-location')}
                className="mt-1 text-xs font-bold text-[#ea580c] hover:underline bg-transparent border-none cursor-pointer"
              >
                Change Location
              </button>
            </div>
          )}
        </div>
        
        {/* Best Selling Products */}
        <div className="flex justify-between items-center mb-4 mt-8">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] md:text-xl font-bold m-0 text-[#ff5500]">Best Selling Products</h3>
          </div>
          <button onClick={() => navigate('/bestseller')} className="bg-transparent border-none text-blue-600 text-[12px] md:text-sm font-semibold cursor-pointer hover:underline">See All</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 pb-4">
          {bestsellerProducts.length > 0 ? (
            bestsellerProducts.map((prod) => (
              <div key={prod.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div className="h-[125px] w-full overflow-hidden bg-slate-50 relative cursor-pointer" onClick={() => navigate(`/product/${prod.id}`)}>
                  <img 
                    src={getImageUrl(prod.image, prod.name)} 
                    alt={prod.name} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover" 
                    onError={(e) => handleImageError(e, prod.name)}
                  />
                </div>
                <div className="flex flex-col p-2.5 flex-1 justify-between gap-2">
                  <div>
                    <h4 className="text-[13px] font-bold m-0 mb-0.5 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{prod.name}</h4>
                    <p className="text-[11px] text-slate-400 m-0">{prod.unit}</p>
                    <p className="text-[10px] font-medium text-slate-500 m-0 mt-0.5 truncate">by:- <span className="font-bold text-slate-700">{prod.seller || 'Fashion Hub'}</span></p>
                  </div>
                  
                  <div className="flex items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[14px] font-extrabold text-slate-900">₹{prod.price.toFixed(2)}</span>
                      {prod.originalPrice > prod.price && (
                        <span className="text-[10px] text-slate-400 line-through">₹{prod.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                    {prod.discount && (
                      <span className="text-[9.5px] font-extrabold text-[#ff5500] whitespace-nowrap shrink-0">{prod.discount}</span>
                    )}
                  </div>

                  <div>
                    {!isInCart(prod.id || prod._id) ? (
                      <button 
                        onClick={() => handleAddToCart(prod)} 
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-98 transition-all"
                        aria-label="Add to cart"
                      >
                        <Plus size={14} strokeWidth={3} /> ADD
                      </button>
                    ) : (
                      <button 
                        onClick={() => removeFromCart(prod.id || prod._id)}
                        className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[12px] flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-98 transition-all"
                        aria-label="Remove from cart"
                      >
                        <Trash2 size={13} strokeWidth={2.5} /> REMOVE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full w-full py-8 px-4 bg-white rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-1.5">
              <ShoppingBag size={24} className="text-slate-300" />
              <p className="text-xs font-semibold text-slate-600 m-0">No products available for your selected location</p>
            </div>
          )}
        </div>
        
        <div className="h-[80px] md:hidden"></div> {/* Spacing for bottom nav (Mobile only) */}
          </>
        )}
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full text-[13px] font-medium shadow-xl z-50 max-w-[90%] text-center flex items-center gap-2 transition-all duration-300">
            {toastMessage.toLowerCase().includes('cart') ? <ShoppingCart size={14} className="shrink-0" /> : <Mic size={14} className="shrink-0" />}
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  ShoppingCart, 
  Heart, 
  Bell, 
  User, 
  ChevronDown, 
  Truck, 
  Package, 
  LayoutGrid, 
  Store, 
  Home as HomeIcon,
  LogOut,
  X,
  Mic
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { useLocationContext } from '../../../context/LocationContext';
import { isDeliverableLocation } from '../../../utils/userLocation';
import LocationSearchModal from '../../../components/LocationSearchModal';
import { authService } from '../../../services/authService';

const UserDesktopHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, cartTotal } = useCart();
  const { wishlistCount } = useWishlist();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const locationContext = useLocationContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechToast, setSpeechToast] = useState('');
  const recognitionRef = useRef(null);

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechToast('Voice search not supported in your browser.');
      setTimeout(() => setSpeechToast(''), 3000);
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setSpeechToast('');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechToast('Listening... Speak now');
      };

      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setSearchQuery(transcript);
          setSpeechToast('');
          setIsListening(false);
          navigate(`/?q=${encodeURIComponent(transcript.trim())}`);
        }
      };

      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e.error);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setSpeechToast('Microphone access denied.');
        } else if (e.error !== 'no-speech') {
          setSpeechToast(`Mic error: ${e.error}`);
        } else {
          setSpeechToast('');
        }
        setTimeout(() => setSpeechToast(''), 3000);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechToast(prev => prev.startsWith('Listening') ? '' : prev);
      };

      recognition.start();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      setIsListening(false);
    }
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('sathiseller_user_token') : null;
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('sathiseller_user_data') || '{}') : {};
  const isLoggedIn = Boolean(token);

  // Sync search query with URL if on search/home
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || params.get('search') || '';
    if (q) setSearchQuery(q);
  }, [location.search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleLocationSelect = (selected) => {
    if (locationContext?.setCurrentLocation) {
      locationContext.setCurrentLocation(selected);
    }
    setShowLocationModal(false);
  };

  const handleLogout = () => {
    authService.logout('user');
    setShowProfileDropdown(false);
    navigate('/login', { replace: true });
  };

  const deliveryLocation = isDeliverableLocation(locationContext?.currentLocation)
    ? locationContext.currentLocation
    : null;

  const currentAddress =
    deliveryLocation?.addressLine1 ||
    deliveryLocation?.area ||
    deliveryLocation?.city ||
    'Select Location';

  const addressType = (
    deliveryLocation?.addressType ||
    deliveryLocation?.type ||
    'DELIVER TO'
  ).toUpperCase();

  const navLinks = [
    { label: 'Home', path: '/', icon: HomeIcon },
    { label: 'Categories', path: '/categories', icon: LayoutGrid },
    { label: 'Stores', path: '/sellers', icon: Store },
    { label: 'Orders', path: '/orders', icon: Package },
  ];

  return (
    <>
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        {/* Row 1: Main Bar (Brand, Location, Search, Quick Actions) */}
        <div className="w-full px-4 md:px-6 py-3.5 flex items-center justify-between gap-6">
          
          {/* Brand & Location */}
          <div className="flex items-center gap-5 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-11 h-11 rounded-xl bg-orange-50 p-1.5 flex items-center justify-center border border-orange-100 group-hover:border-orange-300 transition-colors shadow-2xs">
                <img src="/Logo.png" alt="Sathi Seller" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-slate-900 leading-none">
                  Sathi <span className="text-[#ff5500]">Seller</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">Express Hyperlocal</span>
              </div>
            </Link>

            {/* Location Selector Pill */}
            <button
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-orange-50/60 border border-slate-200/80 hover:border-orange-300 transition-all cursor-pointer text-left group"
              title="Change Delivery Location"
            >
              <div className="w-7 h-7 rounded-lg bg-[#ff5500]/10 flex items-center justify-center text-[#ff5500] shrink-0">
                <MapPin size={15} />
              </div>
              <div className="min-w-0 max-w-[180px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {addressType}
                </div>
                <div className="text-xs font-bold text-slate-800 truncate leading-tight mt-0.5 group-hover:text-[#ff5500] transition-colors">
                  {currentAddress}
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
            </button>
          </div>

          {/* Desktop Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl relative">
            <div className={`relative flex items-center bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 ${
              isListening 
                ? 'ring-2 ring-red-500 border-red-500 bg-red-50/20' 
                : 'focus-within:ring-[#ff5500]/20 focus-within:border-[#ff5500] border-slate-200'
            } border rounded-2xl transition-all shadow-2xs`}>
              <Search size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isListening ? "Listening... Speak now" : "Search for fresh groceries, staples, snacks, stores..."}
                className="w-full bg-transparent py-2.5 pl-10 pr-18 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
              />
              
              <div className="absolute right-3 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer rounded-full hover:bg-slate-200/60 transition-colors"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`p-1.5 rounded-full border-none cursor-pointer transition-all flex items-center justify-center ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse shadow-sm shadow-red-500/50' 
                      : 'bg-transparent text-slate-400 hover:text-[#ff5500] hover:bg-orange-50'
                  }`}
                  title={isListening ? "Listening... Click to stop" : "Search with voice"}
                >
                  <Mic size={16} />
                </button>
              </div>
            </div>

            {/* Speech Recognition Feedback Bubble */}
            {speechToast && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3.5 py-1.5 bg-slate-900/90 text-white text-xs font-medium rounded-full shadow-lg z-50 flex items-center gap-2 whitespace-nowrap backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-400 animate-ping' : 'bg-orange-400'}`}></span>
                <span>{speechToast}</span>
              </div>
            )}
          </form>

          {/* Right Actions: Wishlist, Notifications, Cart, Auth */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Wishlist */}
            <button
              onClick={() => navigate('/wishlist')}
              className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all border-none bg-transparent cursor-pointer"
              title="Wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#ff5500] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all border-none bg-transparent cursor-pointer"
              title="Notifications"
            >
              <Bell size={20} />
              {notificationUnreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-[#ff5500] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer border-none active:scale-98"
              title="Shopping Cart"
            >
              <div className="relative">
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-yellow-400 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline font-extrabold text-sm">
                {cartTotal > 0 ? `₹${cartTotal.toFixed(0)}` : 'Cart'}
              </span>
            </button>

            {/* User Profile / Auth */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 p-1.5 pl-2 pr-3 rounded-xl hover:bg-slate-100 border border-slate-200/80 transition-colors bg-white cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#ff5500] font-bold text-xs flex items-center justify-center border border-orange-200">
                    {user.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
                  </div>
                  <span className="text-xs font-bold text-slate-700 max-w-[90px] truncate">{user.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {showProfileDropdown && (
                  <div 
                    className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95"
                    onMouseLeave={() => setShowProfileDropdown(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate m-0">{user.name || 'Valued Customer'}</p>
                      <p className="text-[10px] text-slate-400 truncate m-0">{user.phone || user.email || ''}</p>
                    </div>
                    <Link 
                      to="/profile" 
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 no-underline"
                    >
                      <User size={14} /> My Profile
                    </Link>
                    <Link 
                      to="/orders" 
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 no-underline"
                    >
                      <Package size={14} /> My Orders
                    </Link>
                    <Link 
                      to="/saved-addresses" 
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 no-underline"
                    >
                      <MapPin size={14} /> Saved Addresses
                    </Link>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 text-left border-none bg-transparent cursor-pointer"
                    >
                      <LogOut size={14} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer border-none shadow-2xs active:scale-98"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Menu Items in the Middle */}
        <div className="w-full px-4 md:px-6 py-2.5 border-t border-slate-200/70 bg-slate-50/70 flex items-center justify-center">
          <nav className="flex items-center gap-2 sm:gap-3 overflow-x-auto hide-scrollbar">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    isActive 
                      ? 'bg-white text-[#ff5500] shadow-2xs border border-orange-200/80' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Google Maps Location Search Modal */}
      {showLocationModal && (
        <LocationSearchModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onSelect={handleLocationSelect}
          initialLocation={locationContext?.currentLocation}
          accentColor="#ea580c"
          title="Select Delivery Address"
        />
      )}
    </>
  );
};

export default UserDesktopHeader;

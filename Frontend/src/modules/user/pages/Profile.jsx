import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Pencil, Camera, Package, Heart, Gift, Headphones, 
  ChevronRight, Wallet, User, MapPin, FileText, HelpCircle, 
  PhoneCall, LogOut, Trash2, Sparkles, Clock, ShoppingBag, Loader2, Star, ShieldCheck,
  Share2, Check, Copy, ExternalLink, X, Send
} from 'lucide-react';
import { authService, orderService, getCachedUserOrders } from '../../../services/authService';
import RatingBreakdownModal from '../../../components/RatingBreakdownModal';
import { Wrench as RepairWrenchIcon } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';

const formatRawOrders = (rawList = []) => {
  return rawList.map(o => ({
    id: o.orderId || o._id,
    _id: o._id,
    date: o.createdAt 
      ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Recent',
    status: o.orderStatus || o.status || 'Placed',
    rejectionReason: o.rejectionReason || '',
    items: o.items || [],
    total: o.grandTotal || o.total || 0,
    itemCount: (o.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0),
    rawOrder: o,
  }));
};

const Profile = () => {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { refreshWishlist } = useWishlist();

  const [profileImage, setProfileImage] = useState(null);
  
  // Instant Initial State from Cache (0ms latency)
  const [orders, setOrders] = useState(() => {
    const cached = getCachedUserOrders();
    if (cached && Array.isArray(cached.orders) && cached.orders.length > 0) {
      return formatRawOrders(cached.orders);
    }
    return [];
  });
  const [loadingOrders, setLoadingOrders] = useState(() => {
    const cached = getCachedUserOrders();
    return !(cached && Array.isArray(cached.orders) && cached.orders.length > 0);
  });
  
  const getUserDisplayName = () => {
    const storedName = localStorage.getItem('sathiseller_user_name');
    if (storedName) return storedName;
    const userDataRaw = localStorage.getItem('sathiseller_user_data');
    if (userDataRaw) {
      try {
        const u = JSON.parse(userDataRaw);
        if (u.name) return u.name;
        if (u.phone) return u.phone;
      } catch (e) {}
    }
    return 'User';
  };

  const [userName, setUserName] = useState(getUserDisplayName);
  const [userProfile, setUserProfile] = useState(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const fileInputRef = useRef(null);

  const APP_PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=com.sathiseller.user';

  const handleCopyAppUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(APP_PLAYSTORE_URL);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = APP_PLAYSTORE_URL;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedAppUrl(true);
      setTimeout(() => setCopiedAppUrl(false), 3000);
    } catch (e) {
      setCopiedAppUrl(true);
      setTimeout(() => setCopiedAppUrl(false), 3000);
    }
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'Sathi Seller - Shopping & Express Delivery',
      text: 'Download the Sathi Seller app for fast grocery & product delivery, shopping, and logistics on Google Play Store!',
      url: APP_PLAYSTORE_URL,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Open rich share modal if Web Share is not supported or declined
    setShowShareModal(true);
  };
  
  useEffect(() => {
    setUserName(getUserDisplayName());

    // Fetch user profile for rating stats
    const fetchProfile = async () => {
      try {
        const res = await authService.getProfile();
        if (res && res.user) {
          setUserProfile(res.user);
          if (res.user.name) setUserName(res.user.name);
        }
      } catch (err) {
        console.warn('Failed to fetch profile in Profile.jsx:', err);
      }
    };
    fetchProfile();

    // Fetch user order history
    const fetchUserOrders = async () => {
      try {
        const res = await orderService.getOrders();
        if (res && res.success && Array.isArray(res.orders)) {
          setOrders(formatRawOrders(res.orders));
        }
      } catch (err) {
        console.error('Failed to fetch user order history on profile:', err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchUserOrders();
  }, []);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
    }
  };

  const handleLogout = () => {
    authService.logout('user');
    clearCart();
    refreshWishlist();
    navigate('/login', { replace: true });
  };

  const statusColors = {
    Placed: 'bg-orange-50 text-orange-600 border-orange-200',
    Accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    Processing: 'bg-amber-50 text-amber-600 border-amber-200',
    'Out for Delivery': 'bg-blue-50 text-blue-600 border-blue-200',
    Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
    Rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  };

  return (
    <div className="w-full max-w-[480px] md:max-w-none md:w-full mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none overflow-y-auto md:overflow-visible [&::-webkit-scrollbar]:hidden pb-10 px-0 md:px-5 md:py-6">
      
      {/* Orange Background Header (Mobile only) */}
      <div className="md:hidden absolute top-0 left-0 w-full h-[180px] bg-[#ea580c] rounded-b-[40px] z-0"></div>

      {/* Top Nav (Mobile only) */}
      <header className="md:hidden flex justify-between items-center pt-5 px-5 relative z-10">
        <button 
          className="w-8 h-8 rounded-full bg-white flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 border-none shadow-sm"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft size={18} className="text-[#1e1b4b] pr-[1px]" />
        </button>
        <button 
          className="w-8 h-8 rounded-full bg-white flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 border-none shadow-sm"
          onClick={() => navigate('/account-information')}
        >
          <Pencil size={15} className="text-[#1e1b4b]" />
        </button>
      </header>

      {/* Desktop Header Banner */}
      <div className="hidden md:flex items-center justify-between mb-6 bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] text-white p-7 rounded-2xl shadow-sm">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-white bg-[#fff5f0] flex items-center justify-center shadow-lg overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-[#ea580c]" strokeWidth={1.5} />
              )}
            </div>
            <button 
              className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md border-none cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={13} className="text-[#ea580c]" />
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-black text-white m-0 tracking-tight">{userName}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <button 
                onClick={() => setShowBreakdownModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold border border-white/30 cursor-pointer transition-colors"
              >
                <Star size={13} className="fill-amber-300 text-amber-300" />
                <span>
                  {userProfile?.ratingCount > 0 
                    ? `${Number(userProfile.ratingAverage || 5).toFixed(1)} ★ (${userProfile.ratingCount} ${userProfile.ratingCount === 1 ? 'ride' : 'rides'})` 
                    : '★ New Rider'}
                </span>
                <ChevronRight size={12} className="opacity-80 ml-0.5" />
              </button>
              <span className="text-white/90 text-xs font-medium bg-black/15 px-2.5 py-0.5 rounded-full">Sathi Seller Member</span>
              {userProfile?.phone && (
                <span className="text-white/80 text-xs font-medium">• {userProfile.phone}</span>
              )}
              {userProfile?.email && (
                <span className="text-white/80 text-xs font-medium">• {userProfile.email}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/account-information')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#ea580c] font-bold text-sm rounded-xl border-none cursor-pointer hover:bg-orange-50 transition-colors shadow-xs"
          >
            <Pencil size={15} /> Edit Profile
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-black/20 hover:bg-black/30 text-white font-bold text-sm rounded-xl border border-white/20 cursor-pointer transition-colors"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </div>

      {/* Hidden File Input for Avatar */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Profile Info Container */}
      <div className="relative z-10 flex flex-col items-center mt-2 px-5 md:px-0 w-full">
        
        {/* Avatar Area (Mobile only) */}
        <div className="relative mb-2 md:hidden">
          <div className="w-[70px] h-[70px] rounded-full border-[4px] border-white bg-[#fff5f0] flex items-center justify-center shadow-md overflow-hidden relative">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={28} className="text-[#ea580c]" strokeWidth={1.5} />
            )}
          </div>
          {/* Camera Badge */}
          <button 
            className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border-none cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={14} className="text-[#ea580c]" />
          </button>
        </div>
        
        {/* User Info (Mobile only) */}
        <div className="flex flex-col items-center mb-6 md:hidden">
          <h2 className="text-[18px] font-extrabold text-white m-0 tracking-tight">{userName}</h2>
          {/* Rating Badge */}
          <button 
            onClick={() => setShowBreakdownModal(true)}
            className="mt-1.5 flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-full text-[12px] font-bold border border-white/30 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Star size={13} className="fill-amber-300 text-amber-300" />
            <span>
              {userProfile?.ratingCount > 0 
                ? `${Number(userProfile.ratingAverage || 5).toFixed(1)} ★ (${userProfile.ratingCount} ${userProfile.ratingCount === 1 ? 'ride' : 'rides'})` 
                : '★ New Rider'}
            </span>
            <ChevronRight size={12} className="opacity-80 ml-0.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 1. MOBILE VIEW LAYOUT (UNTOUCHED - RETAINS EXACT MOBILE DESIGN)            */}
        {/* ========================================================================= */}
        <div className="w-full flex flex-col md:hidden">
          
          {/* 1. Quick Actions Card */}
          <div className="w-full grid grid-cols-2 gap-2 mb-4">
            <button className="flex items-center justify-between bg-white border border-slate-100 rounded-[12px] p-3 shadow-sm cursor-pointer hover:border-orange-100 transition-colors" onClick={() => navigate('/orders')}>
              <div className="flex items-center gap-2">
                <Package size={18} className="text-[#ea580c]" />
                <span className="text-[13px] font-bold text-[#1e1b4b]">Orders</span>
              </div>
              {orders.length > 0 && (
                <span className="text-[10px] font-extrabold bg-[#ea580c] text-white px-2 py-0.5 rounded-full">
                  {orders.length}
                </span>
              )}
            </button>
            <button className="flex items-center gap-2 bg-white border border-slate-100 rounded-[12px] p-3 shadow-sm cursor-pointer hover:border-orange-100 transition-colors" onClick={() => navigate('/wishlist')}>
              <Heart size={18} className="text-[#ea580c]" />
              <span className="text-[13px] font-bold text-[#1e1b4b]">My Picks</span>
            </button>
            <button className="flex items-center gap-2 bg-white border border-slate-100 rounded-[12px] p-3 shadow-sm cursor-pointer hover:border-orange-100 transition-colors" onClick={() => navigate('/wallet')}>
              <Wallet size={18} className="text-[#ea580c]" />
              <span className="text-[13px] font-bold text-[#1e1b4b]">Wallet</span>
            </button>
            <button className="flex items-center gap-2 bg-white border border-slate-100 rounded-[12px] p-3 shadow-sm cursor-pointer hover:border-orange-100 transition-colors" onClick={() => navigate('/support')}>
              <Headphones size={18} className="text-[#ea580c]" />
              <span className="text-[13px] font-bold text-[#1e1b4b]">Help Center</span>
            </button>
          </div>

          {/* 2. Order History Preview Card */}
          <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-4 border border-slate-100/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock size={15} className="text-[#ea580c]" />
                </div>
                <div>
                  <h4 className="text-[13px] font-extrabold text-[#1e1b4b] tracking-tight m-0">Order History</h4>
                  <span className="text-[10px] font-medium text-slate-400">Previous purchases & deliveries</span>
                </div>
              </div>
              <button 
                onClick={() => navigate('/order-history')} 
                className="text-[12px] font-bold text-[#ea580c] hover:text-[#c2410c] flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
              >
                View All {orders.length > 0 && `(${orders.length})`} <ChevronRight size={14} />
              </button>
            </div>

            {loadingOrders ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={22} className="animate-spin text-[#ea580c]" />
                <span className="text-[12px] font-medium">Loading order history...</span>
              </div>
            ) : orders.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {orders.slice(0, 3).map((order, idx) => {
                  const firstItem = order.items?.[0];
                  const itemTitle = firstItem?.name || firstItem?.product?.name || `${order.itemCount} Items`;

                  return (
                    <div 
                      key={order.id || idx}
                      onClick={() => navigate('/track-order', { state: { order } })}
                      className="p-3 rounded-[14px] bg-[#f8fafc] border border-slate-100 hover:border-orange-200 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-[42px] h-[42px] rounded-[10px] bg-[#f0f3f6] border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          <img 
                            src={getImageUrl((firstItem?.image && !firstItem.image.includes('photo-1586201375761-83865001e31c') ? firstItem.image : null) || firstItem?.product?.mainImage || firstItem?.product?.image, itemTitle)} 
                            alt={itemTitle} 
                            className="w-full h-full object-cover" 
                            onError={(e) => handleImageError(e, itemTitle)}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-slate-900 truncate tracking-tight">{order.id}</span>
                          <span className="text-[11px] font-medium text-slate-500 truncate">{itemTitle}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{order.date}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span className="text-[13px] font-extrabold text-slate-900">₹{order.total}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${statusColors[order.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {orders.length > 3 && (
                  <button 
                    onClick={() => navigate('/order-history')}
                    className="w-full py-2 bg-orange-50/60 hover:bg-orange-100/60 text-[#ea580c] text-[12px] font-bold rounded-xl border border-orange-200/50 cursor-pointer transition-colors text-center"
                  >
                    View All {orders.length} Orders
                  </button>
                )}
              </div>
            ) : (
              <div className="py-5 px-3 bg-[#f8fafc] rounded-xl border border-dashed border-slate-200 flex flex-col items-center text-center">
                <Package size={28} className="text-slate-300 mb-1.5" />
                <p className="text-[12px] font-bold text-slate-700 m-0">No Order History Found</p>
                <p className="text-[11px] text-slate-400 m-0 mt-0.5">You haven't placed any orders yet.</p>
                <button 
                  onClick={() => navigate('/')}
                  className="mt-2.5 px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white text-[11px] font-bold rounded-lg border-none cursor-pointer transition-colors shadow-xs"
                >
                  Start Shopping
                </button>
              </div>
            )}
          </div>

          {/* 3. Account Settings Section */}
          <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-4 border border-slate-100/80">
            <h4 className="text-[12px] font-extrabold text-[#1e1b4b] uppercase tracking-wider mb-4">Account Settings</h4>
            
            <div className="flex flex-col gap-3">
              {/* Order History */}
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => navigate('/order-history')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-[12px] bg-[#ffedd5] flex items-center justify-center shrink-0">
                    <ShoppingBag size={16} className="text-[#ea580c]" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[#1e1b4b]">Order History</span>
                      {orders.length > 0 && (
                        <span className="text-[10px] font-bold bg-[#ea580c]/10 text-[#ea580c] px-2 py-0.2 rounded-full">
                          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">View past orders & purchase history</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>

              {/* Wallet */}
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => navigate('/wallet')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-[12px] bg-emerald-50 flex items-center justify-center shrink-0">
                    <Wallet size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-bold text-[#1e1b4b]">My Wallet</span>
                    <span className="text-[11px] font-medium text-slate-400">Balance, refunds & wallet payments</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>

              {/* Repair & Services */}
              <div
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => navigate('/repair')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-[12px] bg-[#ffedd5] flex items-center justify-center shrink-0">
                    <RepairWrenchIcon size={16} className="text-[#ea580c]" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-bold text-[#1e1b4b]">Repair & Services</span>
                    <span className="text-[11px] font-medium text-slate-400">Book repairs & track your repairs</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>

              {/* Account Info */}
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => navigate('/account-information')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-[12px] bg-[#ffedd5] flex items-center justify-center shrink-0">
                    <User size={16} className="text-[#ea580c]" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-bold text-[#1e1b4b]">Account Information</span>
                    <span className="text-[11px] font-medium text-slate-400">Manage your email, phone, and name</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>

              {/* Saved Addresses */}
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => navigate('/saved-addresses')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-[12px] bg-[#ffe4e6] flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-[#e11d48]" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-bold text-[#1e1b4b]">Saved Addresses</span>
                    <span className="text-[11px] font-medium text-slate-400">Manage your delivery addresses</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* 4. Feedback & Information */}
          <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-4 border border-slate-100/80">
            <h4 className="text-[12px] font-extrabold text-[#1e1b4b] uppercase tracking-wider mb-2">Support & App</h4>
            
            <div className="flex flex-col">
              {/* Share App Option */}
              <div 
                className="flex items-center justify-between py-3 border-b border-slate-50 cursor-pointer group"
                onClick={handleShareApp}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-[12px] bg-indigo-50 flex items-center justify-center shrink-0">
                    <Share2 size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[#1e1b4b]">Share App</span>
                      <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-600 px-2 py-0.2 rounded-full border border-indigo-100">Play Store</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">Invite friends & share download link</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {copiedAppUrl && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Copied!</span>
                  )}
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </div>

              <div 
                className="flex items-center justify-between py-3 border-b border-slate-50 cursor-pointer group"
                onClick={() => navigate('/privacy')}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-slate-600" />
                  <span className="text-[14px] font-bold text-[#1e1b4b]">Privacy Policy</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
              
              <div 
                className="flex items-center justify-between py-3 border-b border-slate-50 cursor-pointer group"
                onClick={() => navigate('/faqs')}
              >
                <div className="flex items-center gap-3">
                  <HelpCircle size={16} className="text-slate-600" />
                  <span className="text-[14px] font-bold text-[#1e1b4b]">Browse FAQs</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
              
              <div 
                className="flex items-center justify-between py-3 cursor-pointer group"
                onClick={() => navigate('/support')}
              >
                <div className="flex items-center gap-3">
                  <PhoneCall size={16} className="text-slate-600" />
                  <span className="text-[14px] font-bold text-[#1e1b4b]">24/7 Help & Support</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* 5. Danger Section */}
          <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col gap-3 border border-slate-100/80">
            <div className="flex items-center justify-between cursor-pointer group" onClick={handleLogout}>
              <div className="flex items-center gap-3">
                <div className="w-[36px] h-[36px] rounded-[12px] bg-[#fee2e2] flex items-center justify-center shrink-0">
                  <LogOut size={16} className="text-[#e11d48]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-[#e11d48]">Log Out</span>
                  <span className="text-[11px] font-medium text-slate-400">Safely terminate session</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-200 group-hover:text-slate-300 transition-colors" />
            </div>

            <div className="flex items-center justify-between cursor-pointer group" onClick={handleLogout}>
              <div className="flex items-center gap-3">
                <div className="w-[36px] h-[36px] rounded-[12px] bg-[#fee2e2] flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-[#e11d48]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-[#e11d48]">Delete Account</span>
                  <span className="text-[11px] font-medium text-slate-400">Permanently remove your account</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-200 group-hover:text-slate-300 transition-colors" />
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 2. DESKTOP WEB VIEW LAYOUT (TAILORED FOR WIDE SCREENS & WEBVIEW)           */}
        {/* ========================================================================= */}
        <div className="hidden md:grid md:grid-cols-12 md:gap-6 w-full items-start">
          
          {/* LEFT COLUMN: Account Navigation, Support & Danger (4 of 12 columns) */}
          <div className="md:col-span-4 flex flex-col gap-5">
            
            {/* Card 1: Account Settings Menu */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">Account Settings</span>
                <span className="text-[11px] font-bold text-[#ea580c] bg-orange-50 px-2 py-0.5 rounded-full">Personal</span>
              </div>

              <div className="flex flex-col gap-1">
                {/* Account Info */}
                <div 
                  onClick={() => navigate('/account-information')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                      <User size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-[#ea580c] transition-colors">Account Information</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Name, email & phone</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Saved Addresses */}
                <div 
                  onClick={() => navigate('/saved-addresses')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#e11d48] flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-[#e11d48] transition-colors">Saved Addresses</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Manage delivery locations</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Wishlist Link */}
                <div 
                  onClick={() => navigate('/wishlist')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-50 text-[#ec4899] flex items-center justify-center shrink-0 group-hover:bg-pink-100 transition-colors">
                      <Heart size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-[#ec4899] transition-colors">My Wishlist</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">View saved items</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Repair & Services Link */}
                <div
                  onClick={() => navigate('/repair')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                      <RepairWrenchIcon size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-[#ea580c] transition-colors">Repair & Services</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Book & track repairs</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>

            {/* Card 2: Help & Legal Menu */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">Support & Legal</span>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Help</span>
              </div>

              <div className="flex flex-col gap-1">
                {/* Share App Option */}
                <div 
                  onClick={handleShareApp}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                      <Share2 size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-indigo-600 transition-colors">Share Sathi Seller App</h4>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.2 rounded-full border border-indigo-100">Play Store</span>
                      </div>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Invite friends to download user app</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {copiedAppUrl && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">Copied!</span>
                    )}
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* 24/7 Support */}
                <div 
                  onClick={() => navigate('/support')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <PhoneCall size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-blue-600 transition-colors">24/7 Customer Care</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Live support & tickets</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* FAQs */}
                <div 
                  onClick={() => navigate('/faqs')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                      <HelpCircle size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-purple-600 transition-colors">Browse FAQs</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Quick answers & help topics</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Privacy Policy */}
                <div 
                  onClick={() => navigate('/privacy')}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e1b4b] m-0 group-hover:text-emerald-600 transition-colors">Privacy & Terms</h4>
                      <p className="text-[11px] text-slate-400 m-0 font-medium">Data privacy guidelines</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>

            {/* Card 3: Session & Danger Zone */}
            <div className="bg-white rounded-2xl p-4 border border-rose-100/80 shadow-sm flex flex-col gap-2">
              <div 
                onClick={handleLogout}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#e11d48] flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                    <LogOut size={15} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#e11d48] m-0">Log Out</h5>
                    <span className="text-[10px] text-slate-400">Safely exit your session</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-rose-300 group-hover:text-rose-500 transition-colors" />
              </div>

              <div 
                onClick={handleLogout}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#e11d48] flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                    <Trash2 size={15} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#e11d48] m-0">Delete Account</h5>
                    <span className="text-[10px] text-slate-400">Permanently close account</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-rose-300 group-hover:text-rose-500 transition-colors" />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Action Cards, Order History & Activity (8 of 12 columns) */}
          <div className="md:col-span-8 flex flex-col gap-6">
            
            {/* Quick Action Tiles */}
            <div className="grid grid-cols-3 gap-4">
              {/* Orders Tile */}
              <div 
                onClick={() => navigate('/orders')}
                className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-[115px]"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all shadow-xs">
                    <Package size={20} />
                  </div>
                  <span className="text-xs font-extrabold bg-orange-50 text-[#ea580c] px-2.5 py-1 rounded-full border border-orange-200/60">
                    {orders.length > 0 ? `${orders.length} Orders` : '0 Orders'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 m-0 group-hover:text-[#ea580c] transition-colors">My Orders</h3>
                  <p className="text-[11px] text-slate-400 font-medium m-0 truncate">Track, reorder & review</p>
                </div>
              </div>

              {/* Wishlist Tile */}
              <div 
                onClick={() => navigate('/wishlist')}
                className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-[115px]"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#e11d48] flex items-center justify-center group-hover:bg-[#e11d48] group-hover:text-white transition-all shadow-xs">
                    <Heart size={20} />
                  </div>
                  <span className="text-xs font-extrabold bg-rose-50 text-[#e11d48] px-2.5 py-1 rounded-full border border-rose-200/60">
                    Favorites
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 m-0 group-hover:text-[#e11d48] transition-colors">My Picks</h3>
                  <p className="text-[11px] text-slate-400 font-medium m-0 truncate">Saved products for later</p>
                </div>
              </div>

              {/* Support Tile */}
              <div 
                onClick={() => navigate('/support')}
                className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-[115px]"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                    <Headphones size={20} />
                  </div>
                  <span className="text-xs font-extrabold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-200/60">
                    24/7 Live
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 m-0 group-hover:text-blue-600 transition-colors">Help Center</h3>
                  <p className="text-[11px] text-slate-400 font-medium m-0 truncate">Instant care & questions</p>
                </div>
              </div>
            </div>

            {/* Order History Showcase Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#1e1b4b] m-0">Recent Order History</h3>
                    <p className="text-xs text-slate-400 font-medium m-0">Previous purchases and live delivery tracking</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/order-history')} 
                  className="text-xs font-bold text-[#ea580c] hover:text-[#c2410c] flex items-center gap-1 bg-transparent border-none cursor-pointer transition-colors p-0"
                >
                  View All Orders {orders.length > 0 && `(${orders.length})`} <ChevronRight size={14} />
                </button>
              </div>

              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 size={26} className="animate-spin text-[#ea580c]" />
                  <span className="text-xs font-medium">Loading recent order history...</span>
                </div>
              ) : orders.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {orders.slice(0, 4).map((order, idx) => {
                    const firstItem = order.items?.[0];
                    const itemTitle = firstItem?.name || firstItem?.product?.name || `${order.itemCount} Items`;

                    return (
                      <div 
                        key={order.id || idx}
                        onClick={() => navigate('/track-order', { state: { order } })}
                        className="p-4 rounded-xl bg-[#f8fafc] hover:bg-orange-50/40 border border-slate-100 hover:border-orange-200 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-[#f0f3f6] border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            <img 
                              src={getImageUrl((firstItem?.image && !firstItem.image.includes('photo-1586201375761-83865001e31c') ? firstItem.image : null) || firstItem?.product?.mainImage || firstItem?.product?.image, itemTitle)} 
                              alt={itemTitle} 
                              className="w-full h-full object-cover" 
                              onError={(e) => handleImageError(e, itemTitle)}
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 group-hover:text-[#ea580c] transition-colors">{order.id}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[order.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                {order.status}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-slate-500 truncate max-w-[340px] mt-0.5">{itemTitle}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{order.date}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 pl-3">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-slate-900">₹{order.total}</span>
                            <span className="text-[11px] text-slate-400 font-medium">{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-orange-300 group-hover:bg-orange-500 group-hover:text-white flex items-center justify-center text-slate-400 transition-all shadow-2xs">
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {orders.length > 4 && (
                    <button 
                      onClick={() => navigate('/order-history')}
                      className="w-full py-2.5 mt-2 bg-orange-50/60 hover:bg-orange-100/70 text-[#ea580c] text-xs font-bold rounded-xl border border-orange-200/50 cursor-pointer transition-colors text-center"
                    >
                      View All {orders.length} Orders
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-10 px-4 bg-[#f8fafc] rounded-2xl border border-dashed border-slate-200 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
                    <Package size={30} className="text-[#ea580c]" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800 m-0">No Order History Found</h4>
                  <p className="text-xs text-slate-400 max-w-sm m-0 mt-1">You haven't placed any orders yet. Start exploring sellers and favorite products!</p>
                  <button 
                    onClick={() => navigate('/')}
                    className="mt-4 px-5 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors shadow-sm"
                  >
                    Start Shopping
                  </button>
                </div>
              )}
            </div>

            {/* Quick Management Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div 
                onClick={() => navigate('/saved-addresses')}
                className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-orange-200 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1e1b4b] m-0 group-hover:text-[#ea580c] transition-colors">Manage Delivery Addresses</h4>
                    <p className="text-[11px] text-slate-400 m-0">Add or edit home & office pins</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>

          </div>

        </div>
        
        {/* Rating Breakdown Modal */}
        <RatingBreakdownModal
          isOpen={showBreakdownModal}
          onClose={() => setShowBreakdownModal(false)}
          targetId={userProfile?._id}
          targetType="user"
          targetName={userName}
        />

        {/* Share App Interactive Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 space-y-5 animate-scaleIn">
              {/* Close Button */}
              <button 
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-none bg-transparent cursor-pointer transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>

              {/* Header with App Logo & Title */}
              <div className="flex items-center gap-4 pr-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-md shrink-0">
                  <Package size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 m-0">Share Sathi Seller App</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">Express Shopping, Grocery & Logistics</p>
                </div>
              </div>

              {/* Link Box with Copy Button */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
                <div className="truncate text-xs font-mono text-slate-600 select-all min-w-0">
                  {APP_PLAYSTORE_URL}
                </div>
                <button
                  onClick={handleCopyAppUrl}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shrink-0 transition-all ${
                    copiedAppUrl 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-[#ea580c] hover:bg-[#c2410c] text-white shadow-xs'
                  }`}
                >
                  {copiedAppUrl ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedAppUrl ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Quick Social Share Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* WhatsApp Share */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hey! Download the Sathi Seller App for the fastest grocery delivery, shopping & logistics on Google Play Store:\n${APP_PLAYSTORE_URL}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-xs no-underline transition-colors border border-[#25D366]/20"
                >
                  <Send size={15} />
                  <span>WhatsApp</span>
                </a>

                {/* Telegram Share */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(APP_PLAYSTORE_URL)}&text=${encodeURIComponent('Download Sathi Seller User App on Google Play Store!')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] font-bold text-xs no-underline transition-colors border border-[#0088cc]/20"
                >
                  <Send size={15} />
                  <span>Telegram</span>
                </a>
              </div>

              {/* Open in Google Play Store Action */}
              <button
                onClick={() => window.open(APP_PLAYSTORE_URL, '_blank')}
                className="w-full py-3 bg-[#002625] hover:bg-[#003836] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} className="text-[#ff5500]" />
                <span>Open in Google Play Store</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;

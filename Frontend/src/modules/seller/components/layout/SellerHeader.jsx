import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, Menu, Settings, MapPin, LogOut, Loader2, Store, AlertCircle } from 'lucide-react';
import { authService } from '../../../../services/authService';

const SellerHeader = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(() => {
    try {
      const cached = localStorage.getItem('sathiseller_seller_data');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [isOnline, setIsOnline] = useState(() => {
    try {
      const cached = localStorage.getItem('sathiseller_seller_data');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.isOnline !== undefined ? Boolean(parsed.isOnline) : true;
      }
      return true;
    } catch (e) {
      return true;
    }
  });

  const [togglingStatus, setTogglingStatus] = useState(false);
  const [toastText, setToastText] = useState('');

  const showToast = (txt) => {
    setToastText(txt);
    setTimeout(() => setToastText(''), 3500);
  };

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const res = await authService.getSellerProfile();
        if (res?.seller) {
          setSeller(res.seller);
          setIsOnline(res.seller.isOnline !== undefined ? Boolean(res.seller.isOnline) : true);
        }
      } catch (err) {}
    };
    fetchSeller();

    const handleStatusEvent = (e) => {
      if (e.detail?.isOnline !== undefined) {
        setIsOnline(Boolean(e.detail.isOnline));
      }
    };
    window.addEventListener('seller_status_changed', handleStatusEvent);
    return () => window.removeEventListener('seller_status_changed', handleStatusEvent);
  }, []);

  const handleToggleOnlineStatus = async () => {
    if (togglingStatus) return;
    const targetStatus = !isOnline;
    
    try {
      setTogglingStatus(true);
      setIsOnline(targetStatus); // Optimistic UI update

      const res = await authService.updateSellerOnlineStatus(targetStatus);
      if (res && res.success) {
        if (res.seller) setSeller(res.seller);
        showToast(targetStatus 
          ? '✓ Store is now ONLINE. Products are visible to customers.' 
          : '⚠️ Store is now OFFLINE. Products and store are hidden from customers.'
        );
      } else {
        // Revert on failure
        setIsOnline(!targetStatus);
        alert(res?.message || 'Failed to update store status');
      }
    } catch (err) {
      console.error('Error toggling online status:', err);
      setIsOnline(!targetStatus);
      alert(err.response?.data?.message || err.message || 'Error updating store status');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleLogout = () => {
    authService.logout('seller');
    navigate('/seller/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLocationClick = () => {
    const loc = seller?.warehouseLocation?.storeAddress || seller?.city || 'Main City Logistics Hub';
    alert(`Warehouse Location: ${loc}`);
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs font-sans relative">
      {/* Left Section: Toggle Button & Store Name */}
      <div className="flex items-center gap-3 sm:gap-5">
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          title="Toggle Sidebar"
        >
          {isSidebarOpen ? <X size={22} className="text-slate-700" /> : <Menu size={22} className="text-slate-700" />}
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 tracking-tight truncate max-w-[160px] md:max-w-[200px]">
            {seller?.businessName || 'Seller Store'}
          </span>
        </div>
      </div>

      {/* Middle Section: Orders, Return Order, Wallet Links */}
      <div className="hidden lg:flex items-center gap-8">
        <Link 
          to="/seller/orders" 
          className={`text-[14px] font-semibold transition-colors ${
            isActive('/seller/orders') ? 'text-[#ff5500] font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Orders
        </Link>
        <Link 
          to="/seller/return" 
          className={`text-[14px] font-semibold transition-colors ${
            isActive('/seller/return') || isActive('/seller/returns') ? 'text-[#ff5500] font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Return Order
        </Link>
        <Link 
          to="/seller/wallet" 
          className={`text-[14px] font-semibold transition-colors ${
            isActive('/seller/wallet') ? 'text-[#ff5500] font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Wallet
        </Link>
      </div>

      {/* Right Section: Online/Offline Toggle Tab & Quick Actions */}
      <div className="flex items-center gap-3 sm:gap-4 text-slate-700">
        {/* ── ONLINE / OFFLINE TOGGLE TAB ── */}
        <div className="flex items-center">
          <button
            onClick={handleToggleOnlineStatus}
            disabled={togglingStatus}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs ${
              isOnline 
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
            }`}
            title={isOnline ? 'Store is Online (Receiving orders). Click to go Offline.' : 'Store is Offline (Hidden from customers). Click to go Online.'}
          >
            {togglingStatus ? (
              <Loader2 size={13} className="animate-spin text-slate-500" />
            ) : isOnline ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
            )}

            <span className="text-xs font-extrabold uppercase tracking-wide select-none">
              {isOnline ? 'Online' : 'Offline'}
            </span>

            {/* Micro Toggle Switch */}
            <div className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
              isOnline ? 'bg-emerald-500' : 'bg-slate-300'
            }`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                isOnline ? 'translate-x-3' : 'translate-x-0'
              }`}></div>
            </div>
          </button>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 hidden sm:block"></div>

        {/* Settings Icon */}
        <button 
          onClick={() => navigate('/seller/settings')}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          title="Store Settings"
        >
          <Settings size={20} />
        </button>

        {/* Location Icon */}
        <button 
          onClick={handleLocationClick}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          title="Store Location"
        >
          <MapPin size={20} />
        </button>

        {/* Logout Icon */}
        <button 
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors border-none bg-transparent cursor-pointer"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Floating Status Notification Toast */}
      {toastText && (
        <div className="fixed top-24 right-6 z-50 bg-slate-900 text-white text-xs font-medium py-2.5 px-4 rounded-xl shadow-xl flex items-center gap-2 animate-slideDown border border-slate-800">
          <span>{toastText}</span>
        </div>
      )}
    </header>
  );
};

export default SellerHeader;

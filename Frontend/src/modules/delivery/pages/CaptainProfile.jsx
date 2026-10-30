import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Wallet,
  HelpCircle,
  LogOut,
  ChevronRight,
  X,
  ShieldCheck,
  MapPin,
  FileText,
  Star,
  Trash2,
  Crown,
  Gift,
} from 'lucide-react';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService, authService } from '../../../services/authService';
import RatingBreakdownModal from '../../../components/RatingBreakdownModal';

const CaptainProfile = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('sathiseller_captain_online');
    return saved !== null ? saved === 'true' : true;
  });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleError, setToggleError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await captainService.getProfile();
      if (res.captain) {
        setProfile(res.captain);
        const onlineState = res.captain.isOnline !== undefined ? res.captain.isOnline : true;
        setIsOnline(onlineState);
        localStorage.setItem('sathiseller_captain_online', String(onlineState));
        localStorage.setItem('sathiseller_captain_name', res.captain.name || '');
        localStorage.setItem('sathiseller_captain_phone', res.captain.phone || '');
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOnlineToggle = async (e) => {
    e?.stopPropagation?.();
    if (toggleLoading) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    localStorage.setItem('sathiseller_captain_online', String(newStatus));
    setToggleLoading(true);
    setToggleError('');
    try {
      const res = await captainService.updateOnlineStatus(newStatus);
      if (res && res.isOnline !== undefined) {
        setIsOnline(Boolean(res.isOnline));
        localStorage.setItem('sathiseller_captain_online', String(res.isOnline));
      }
    } catch (err) {
      console.error('Failed to update online status:', err);
      setIsOnline(!newStatus);
      localStorage.setItem('sathiseller_captain_online', String(!newStatus));
      const msg = err?.response?.data?.message || err?.message || 'Failed to update online status';
      setToggleError(msg);
      setTimeout(() => setToggleError(''), 5000);
    } finally {
      setToggleLoading(false);
    }
  };

  const handleLogoutConfirm = () => {
    authService.logout('captain');
    navigate('/captain/login');
  };

  const handleItemClick = (id) => {
    /* Temporarily commented out: Captain Membership
    if (id === 'membership') {
      navigate('/captain/membership');
    } else
    */
    if (id === 'personal-info') {
      navigate('/captain/personal-details');
    } else if (id === 'wallet') {
      navigate('/captain/wallet');
    } else if (id === 'refer-earn') {
      navigate('/captain/refer-earn');
    /* Temporarily commented out:
    } else if (id === 'ratings') {
      setShowBreakdownModal(true);
    */
    } else if (id === 'service-areas') {
      navigate('/captain/service-areas');
    } else if (id === 'privacy') {
      navigate('/captain/privacy');
    } else if (id === 'help') {
      navigate('/captain/support');
    } else if (id === 'delete-account') {
      navigate('/captain/delete-account');
    } else {
      setActiveModal(id);
    }
  };

  const menuItems = [
    {
      id: 'personal-info',
      label: 'Personal Information',
      sub: 'All registration details & uploaded docs',
      icon: User,
      badge: 'Verified',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    /* Temporarily commented out: Captain Membership
    {
      id: 'membership',
      label: 'Captain Membership',
      sub: profile?.membershipStatus === 'active'
        ? 'Active Plan • View details & benefits'
        : 'Choose a plan to activate captain perks',
      icon: Crown,
      badge: profile?.membershipStatus === 'active' ? 'Active' : 'Plans',
      badgeColor: profile?.membershipStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200',
    },
    */
    /* Temporarily commented out: Captain Rating & Reviews
    {
      id: 'ratings',
      label: 'Captain Rating & Reviews',
      sub: profile?.ratingCount > 0
        ? `⭐ ${profile.ratingAverage.toFixed(1)} based on ${profile.ratingCount} ratings`
        : 'No customer ratings yet',
      icon: Star,
      badge: profile?.ratingCount > 0 ? `⭐ ${profile.ratingAverage.toFixed(1)}` : 'New',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    */
    {
      id: 'wallet',
      label: 'Wallet & Payouts',
      sub: `Balance: ₹${(profile?.walletBalance || 0).toFixed(2)}`,
      icon: Wallet,
    },
    {
      id: 'refer-earn',
      label: 'Refer & Earn',
      sub: 'Invite captains & earn cash rewards',
      icon: Gift,
      badge: 'Rewards',
      badgeColor: 'bg-orange-50 text-[#ff5500] border-orange-200',
    },
    {
      id: 'service-areas',
      label: 'Active Service Areas',
      sub: 'View sellers in your delivery range',
      icon: MapPin,
    },
    {
      id: 'help',
      label: 'Help & 24/7 Support',
      sub: 'Toll-free dispatch helpline',
      icon: HelpCircle,
    },
    {
      id: 'privacy',
      label: 'Privacy Policy',
      sub: 'Driver data & platform privacy terms',
      icon: ShieldCheck,
    },
    {
      id: 'logout',
      label: 'Logout Account',
      sub: 'Sign out of partner session',
      icon: LogOut,
      isDanger: true,
    },
    {
      id: 'delete-account',
      label: 'Delete Account',
      sub: 'Permanently remove captain profile & data',
      icon: Trash2,
      isDanger: true,
    },
  ];

  const captainName = profile?.name || localStorage.getItem('sathiseller_captain_name') || 'Captain Partner';
  const captainPhone = profile?.phone || localStorage.getItem('sathiseller_captain_phone') || '';

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-28 text-slate-800 flex flex-col justify-between">
      <div className="max-w-md mx-auto px-4 py-3.5 w-full space-y-3.5">
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl shadow-2xs border border-slate-200/80 p-4 flex items-center justify-between">
          <div
            onClick={() => navigate('/captain/personal-details')}
            className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#002625] to-[#15803d] flex items-center justify-center text-white text-lg font-black shadow-xs shrink-0">
              {captainName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Partner Account</span>
                {/* Temporarily commented out: Captain rating badge
                {profile?.ratingCount > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBreakdownModal(true);
                    }}
                    className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.2 rounded-full text-[10px] font-black cursor-pointer hover:bg-amber-100"
                  >
                    <span>⭐</span> {profile.ratingAverage.toFixed(1)} ({profile.ratingCount})
                  </span>
                )}
                */}
              </div>
              <span className="text-sm font-black text-slate-900 block truncate leading-tight mt-0.5">{captainName}</span>
              <span className="text-[11px] text-slate-500 font-medium block">{captainPhone}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={handleOnlineToggle}
              disabled={toggleLoading}
              className={`rounded-full p-0.5 transition-all duration-300 flex items-center cursor-pointer border-none outline-none ${
                isOnline ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
              } ${toggleLoading ? 'opacity-60 cursor-wait' : ''}`}
              style={{ width: '48px', height: '26px' }}
              title={isOnline ? 'Status: Online (Tap to go Offline)' : 'Status: Offline (Tap to go Online)'}
            >
              <div 
                className="rounded-full bg-white shadow-md transition-all flex items-center justify-center"
                style={{ width: '22px', height: '22px' }}
              >
                {toggleLoading && (
                  <span className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                )}
              </div>
            </button>
            <span className={`text-[10px] font-black tracking-wider uppercase ${isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
              {toggleLoading ? 'Updating…' : (isOnline ? 'Online' : 'Offline')}
            </span>
          </div>
        </div>

        {/* Toggle Error Alert */}
        {toggleError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
            <span className="text-sm shrink-0">⚠️</span>
            <p className="flex-1">{toggleError}</p>
          </div>
        )}

        {/* Verification Status Card */}
        {!loading && profile?.status === 'approved' && (
          <div
            onClick={() => navigate('/captain/personal-details')}
            className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 px-4 cursor-pointer hover:bg-emerald-100/50 transition-colors shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-emerald-700" />
              <div>
                <span className="text-xs font-black text-emerald-800 block leading-tight">Verified Captain Partner</span>
                <span className="text-[10px] text-emerald-600 font-medium">All KYC documents verified & active</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-700" />
          </div>
        )}

        {/* Menu Items List */}
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 px-1">Account & Settings</h2>
          <div className="space-y-2">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className="bg-white rounded-2xl p-3 px-4 shadow-2xs border border-slate-200/70 flex items-center justify-between cursor-pointer hover:bg-slate-50 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      item.isDanger ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <IconComponent size={18} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${item.isDanger ? 'text-red-500' : 'text-slate-900'} leading-tight truncate`}>
                        {item.label}
                      </p>
                      {item.sub && (
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{item.sub}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={16} className={item.isDanger ? 'text-red-400' : 'text-slate-400'} strokeWidth={2} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals for Help, Logout */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                {activeModal === 'logout' ? 'Confirm Logout' : activeModal}
              </h3>
              <button onClick={() => setActiveModal(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer border-none">
                <X size={16} />
              </button>
            </div>

            {activeModal === 'help' && (
              <div className="space-y-2.5 py-1 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Need assistance with your deliveries?</p>
                <p>Contact Sathi Seller Captain Dispatch Support anytime 24/7:</p>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-emerald-800 font-bold text-center">
                  📞 Toll Free: 1800-SATHI SELLER
                </div>
              </div>
            )}

            {activeModal === 'logout' && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 text-center font-medium">Are you sure you want to log out of your Captain account?</p>
                <div className="flex gap-2.5">
                  <button onClick={() => setActiveModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer hover:bg-slate-200">
                    Cancel
                  </button>
                  <button onClick={handleLogoutConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs border-none cursor-pointer shadow-md">
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rating Breakdown Modal */}
      <RatingBreakdownModal
        isOpen={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        targetId={profile?._id}
        targetType="captain"
        targetName={captainName}
      />

      {/* Bottom Navigation */}
      {!activeModal && <CaptainBottomNav />}
    </div>
  );
};

export default CaptainProfile;

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const CaptainBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/captain/dashboard', icon: 'home', label: 'Home' },
    { path: '/captain/jobs', icon: 'local_shipping', label: 'Jobs' },
    { path: '/captain/active-delivery', icon: 'explore', label: 'Active Orders' },
    { path: '/captain/wallet', icon: 'account_balance_wallet', label: 'Wallet' },
    { path: '/captain/profile', icon: 'person', label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-1.5 pb-safe bg-white/95 backdrop-blur-xl shadow-[0_-4px_25px_rgba(0,0,0,0.04)] border-t border-slate-100/90">
      <div className="max-w-md w-full mx-auto flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-emerald-50 text-[#15803d] font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px] transition-transform active:scale-90"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-semibold leading-tight mt-0.5 tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default CaptainBottomNav;

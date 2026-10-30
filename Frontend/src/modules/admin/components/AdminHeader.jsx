import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/useAdmin';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import { X, Menu, Settings, Bell, User, LogOut } from 'lucide-react';

export const AdminHeader = () => {
  const navigate = useNavigate();
  const { sidebarOpen, toggleSidebar, activeTab, setActiveTab, notificationsCount } = useAdmin();
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const confirmLogout = () => {
    authService.logout('admin');
    logout('admin');
    setShowLogoutModal(false);
    navigate('/admin/login', { replace: true });
  };


  const navLinks = [
    { id: 'orders', label: 'Orders' },
    { id: 'users', label: 'Manage Customer' },
    { id: 'cash_collection', label: 'Collect Cash' },
  ];

  return (
    <header className="h-16 sm:h-20 bg-white border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs font-sans relative">
      {/* Left Section: Toggle Button */}
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          title="Toggle Sidebar"
        >
          {sidebarOpen ? <X size={20} className="text-slate-700" /> : <Menu size={20} className="text-slate-700" />}
        </button>
      </div>

      {/* Middle Section: Navigation Links */}
      <div className="hidden md:flex items-center gap-12">
        {navLinks.map((link) => (
          <button
            key={link.id}
            onClick={() => setActiveTab(link.id)}
            className={`text-sm font-semibold transition-colors cursor-pointer bg-transparent border-none ${
              activeTab === link.id ? 'text-[#002625] font-bold border-b-2 border-[#ff5500] pb-0.5' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Right Section: User, Logout Icons */}
      <div className="flex items-center gap-2 sm:gap-6 text-slate-700">
        <button 
          onClick={() => setActiveTab('profile')}
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          title="Admin Profile"
        >
          <User size={20} className="text-slate-700" />
        </button>

        <button 
          onClick={() => setShowLogoutModal(true)}
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          title="Logout"
        >
          <LogOut size={20} className="text-slate-700" />
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#001a19] border border-[#0d4a48] rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-fadeIn">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
              <LogOut size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Confirm Logout</h3>
              <p className="text-xs text-slate-300">Are you sure you want to log out of the Admin Panel?</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-lg transition-colors"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

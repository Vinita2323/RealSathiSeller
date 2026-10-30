import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/useAdmin';
import { 
  LayoutDashboard, 
  FolderTree, 
  Tag, 
  Package, 
  UserCheck, 
  Store, 
  MapPin, 
  Ticket, 
  Truck, 
  CreditCard, 
  BarChart3, 
  Users, 
  User,
  Bell, 
  ShieldCheck, 
  ShieldAlert,
  Settings, 
  LogOut, 
  ChevronDown, 
  ChevronRight,
  Search,
  Boxes,
  Wallet,
  TrendingUp,
  Banknote,
  HelpCircle,
  ShoppingCart,
  LayoutGrid,
  Home,
  Star,
  Layout,
  Layers,
  Image,
  MessageSquare,
  FileText,
  FileCheck,
  DollarSign,
  CheckCircle,
  Flag,
  XCircle,
  RefreshCw,
  Clock,
  Zap,
  Crown,
  Percent,
  Gift,
  Navigation,
  Car
} from 'lucide-react';
import { authService } from '../../../services/authService';

export const AdminSidebar = () => {
  const navigate = useNavigate();
  const { sidebarOpen, isCompact, activeTab, setActiveTab } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const stored = localStorage.getItem('sathiseller_admin_data') || localStorage.getItem('admin_user') || localStorage.getItem('adminUser') || localStorage.getItem('adminData');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('sathiseller_admin_data') || localStorage.getItem('admin_user') || localStorage.getItem('adminUser') || localStorage.getItem('adminData');
        if (stored) setAdminUser(JSON.parse(stored));
      } catch (e) {}
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('admin_profile_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('admin_profile_updated', handleStorageChange);
    };
  }, []);

  const adminName = adminUser?.name || adminUser?.fullName || 'Administrator';
  const adminRole = adminUser?.role === 'super_admin' ? 'Super Administrator' : (adminUser?.role === 'admin' ? 'Root Administrator' : (adminUser?.role || 'Administrator'));

  const confirmLogout = async () => {
    try {
      await authService.adminLogout();
    } catch (e) {}
    localStorage.removeItem('sathiseller_admin_token');
    localStorage.removeItem('sathiseller_admin_data');
    localStorage.removeItem('sathiseller_admin_session');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    setShowLogoutModal(false);
    navigate('/admin/login', { replace: true });
  };
  const [expandedMenus, setExpandedMenus] = useState({ 
    categories: false, 
    products: false, 
    manage_sellers: false, 
    manage_location: false, 
    delivery_boy: false,
    orders: false,
    pricing_charges: false,
    payout_requests: false,
  });
  const searchInputRef = useRef(null);

  // Keyboard shortcut Ctrl + F to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSubmenu = (menuKey) => {
    setExpandedMenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const sections = [
    {
      title: 'PRODUCT SECTION',
      items: [
        {
          id: 'categories',
          label: 'Category',
          icon: FolderTree,
          submenu: [
            { id: 'categories', label: 'All Categories' },
            { id: 'subcategories', label: 'Sub Categories' }
          ]
        },
        { id: 'brands', label: 'Brand', icon: Tag },
        {
          id: 'products',
          label: 'Product',
          icon: Package,
          submenu: [
            { id: 'products', label: 'All Products & Stock' },
            { id: 'add_product', label: '+ Add Product' },
            { id: 'taxes', label: 'Taxes' },
            { id: 'sku_audit', label: 'SKU Audit' }
          ]
        },
        {
          id: 'manage_sellers',
          label: 'Manage Seller',
          icon: UserCheck,
          submenu: [
            { id: 'manage_sellers', label: 'Manage Seller List' },
            { id: 'seller_registration_fee', label: 'Seller Registration Fee' }
          ]
        },
      ]
    },
    {
      title: 'DELIVERY SECTION',
      items: [
        {
          id: 'delivery_boy',
          label: 'Captain',
          icon: Truck,
          badge: '15',
          submenu: [
            { id: 'captains', label: 'Manage Captain' },
            { id: 'captain_registration_fee', label: 'Captain Registration Fee' }
          ]
        },
      ]
    },
    { 
      title: 'Users & Staff',
      items: [
        { id: 'profile_edit_requests', label: 'Profile Edit Requests', icon: ShieldCheck },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'captains', label: 'Delivery Captains', icon: Truck },
        { id: 'sellers', label: 'Sellers', icon: Store },
        { id: 'staff', label: 'Staff Roles', icon: ShieldAlert },
      ]
    },
    {
      title: 'SELLER MEMBERSHIP',
      items: [
        { id: 'seller_membership_plans', label: 'Seller Plans', icon: Crown },
        { id: 'seller_memberships', label: 'Seller Subscriptions', icon: CreditCard },
      ]
    },
    {
      title: 'CAPTAIN MEMBERSHIP',
      items: [
        { id: 'captain_membership_plans', label: 'Captain Plans', icon: Crown },
        { id: 'captain_memberships', label: 'Captain Subscriptions', icon: CreditCard },
      ]
    },
    {
      title: 'MISCELLANEOUS',
      items: [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'faqs', label: 'FAQ', icon: HelpCircle },
      ]
    },
    {
      title: 'ORDER SECTION',
      items: [
        {
          id: 'orders',
          label: 'Order List',
          icon: ShoppingCart,
          submenu: [
            { id: 'orders_all', label: 'All Order', icon: ShoppingCart },
            { id: 'orders_pending', label: 'Pending Order', icon: Clock },
            { id: 'orders_received', label: 'Received Order', icon: CheckCircle },
            { id: 'orders_processed', label: 'Processed Order', icon: FileText },
            { id: 'orders_shipped', label: 'Shippped Order', icon: Flag },
            { id: 'orders_out_for_delivery', label: 'Out for Delivery', icon: Truck },
            { id: 'orders_delivered', label: 'Delivered Order', icon: CheckCircle },
            { id: 'orders_cancelled', label: 'Cancelled Order', icon: XCircle },
            { id: 'orders_return', label: 'Return', icon: RefreshCw },
          ]
        },
      ]
    },
    {
      title: 'PROMOTION',
      items: [
        { id: 'promo_dashboard', label: 'Promotion Dashboard', icon: LayoutDashboard },
        { id: 'promo_category_products', label: 'Category Products', icon: LayoutGrid },
        { id: 'promo_home_section', label: 'Home Section', icon: Home },
        { id: 'promo_bestseller', label: 'Bestseller Cards', icon: Star },
        { id: 'promo_home_banners', label: 'Home Banners', icon: Image },
        { id: 'promo_flash_sale', label: 'Flash Sale Section', icon: Zap },
      ]
    },
    {
      title: 'REFER & EARN',
      items: [
        { id: 'referral_dashboard', label: 'Referral Dashboard', icon: Gift },
        { id: 'referral_settings', label: 'Referral Settings', icon: Settings },
        { id: 'referral_list', label: 'All Referrals', icon: Users },
      ]
    },
    {
      title: 'COMMISSION MANAGEMENT',
      items: [
        { id: 'commission_management', label: 'Commission Management', icon: Percent },
      ]
    },
    {
      title: 'PRICING & CHARGES',
      items: [
        { id: 'pricing_delivery', label: 'Delivery Charges', icon: DollarSign },
      ]
    },
    {
      title: 'PAYOUT REQUEST',
      items: [
        { id: 'financial_dashboard', label: 'Financial Dashboard', icon: TrendingUp },
        {
          id: 'payout_requests',
          label: 'Payout Requests',
          icon: Banknote,
          submenu: [
            { id: 'payout_seller', label: 'Seller Payout' },
            { id: 'payout_captain', label: 'Captain Payout' },
            { id: 'payout_captain_settlement', label: 'Captain Cash Settlement' },
            { id: 'payout_refund_return', label: 'Refund & Return' },
          ]
        }
      ]
    },
    {
      title: 'SETTING',
      items: [
        { id: 'system_user', label: 'System User', icon: Users },
        { id: 'policies', label: 'Terms & Policies Manager', icon: FileCheck },
        { id: 'billing_charges', label: 'Billing & Charges', icon: DollarSign },
      ]
    }
  ];

  // Filter sections by searchQuery
  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const matchLabel = item.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSub = item.submenu && item.submenu.some(sub => sub.label.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchLabel || matchSub;
    })
  })).filter(section => section.items.length > 0);

  return (
    <aside 
      className={`${
        isCompact
          ? `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `sticky top-0 z-40 shrink-0 ${sidebarOpen ? 'w-72' : 'w-20'}`
      } bg-[#002625] text-slate-200 border-r border-[#0b3d3b] transition-all duration-300 flex flex-col h-screen select-none shadow-2xl font-sans`}
    >
      {/* Brand Header with white background */}
      <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-center px-3 shrink-0">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center justify-center w-full bg-transparent border-none cursor-pointer"
        >
          <img 
            src="/Logo.png" 
            alt="Sathi Seller Logo" 
            className={`${sidebarOpen ? 'h-16' : 'h-10'} max-w-full object-contain transition-all`} 
          />
        </button>
      </div>

      {/* Main Sidebar Scroll Area */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3 scrollbar-thin scrollbar-thumb-[#0b3d3b]">
        {/* Search Menu Input */}
        {sidebarOpen ? (
          <div className="relative mb-2">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-300/80 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Menu Ctrl + F"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#001a19] border border-[#0d4a48] focus:border-[#ff5500] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-teal-300/60 outline-none transition-all font-medium"
            />
          </div>
        ) : (
          <button
            onClick={() => searchInputRef.current?.focus()}
            className="w-full py-2.5 flex items-center justify-center bg-[#001a19] border border-[#0d4a48] rounded-xl text-teal-300 cursor-pointer mb-2"
            title="Search Menu (Ctrl + F)"
          >
            <Search size={18} />
          </button>
        )}

        {/* Top Dashboard Button */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-semibold text-sm border-none cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'bg-[#004d49] text-white shadow-md border-l-4 border-[#ff5500]' 
              : 'bg-[#003836] text-slate-200 hover:bg-[#004d49]'
          }`}
          title={!sidebarOpen ? 'Dashboard' : undefined}
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard size={19} className={activeTab === 'dashboard' ? 'text-[#ff5500]' : 'text-slate-300'} />
            {sidebarOpen && <span>Dashboard</span>}
          </div>
        </button>

        {/* Grouped Sections */}
        {filteredSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-1 pt-2">
            {sidebarOpen && (
              <h4 className="text-[11.5px] font-bold text-[#ff9966] tracking-wider uppercase px-2 mb-1.5 font-mono">
                {sec.title}
              </h4>
            )}

            <div className="space-y-1">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isItemActive = activeTab === item.id || (item.submenu && item.submenu.some(sub => sub.id === activeTab));

                if (item.submenu) {
                  const isExpanded = expandedMenus[item.id] || searchQuery.length > 0;
                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        onClick={() => {
                          if (sidebarOpen) {
                            toggleSubmenu(item.id);
                          }
                          setActiveTab(item.submenu[0].id);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm border-none cursor-pointer ${
                          isItemActive 
                            ? 'bg-[#0b3d3b] text-white font-semibold shadow-sm border-l-4 border-[#ff5500]' 
                            : 'text-slate-200 hover:bg-[#0b3d3b]/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={19} className={isItemActive ? 'text-[#ff5500]' : 'text-slate-300'} />
                          {sidebarOpen && <span>{item.label}</span>}
                        </div>
                        {sidebarOpen && (
                          isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />
                        )}
                      </button>

                      {/* Submenu Children */}
                      {sidebarOpen && isExpanded && (
                        <div className="pl-6 space-y-1 border-l-2 border-[#ff5500]/50 ml-4 my-1">
                          {item.submenu.map((sub, sIdx) => {
                            const isSubActive = activeTab === sub.id && (item.id !== 'products' || sIdx === 0 || sub.id !== 'products');
                            return (
                              <button
                                key={sIdx}
                                onClick={() => setActiveTab(sub.id)}
                                className={`w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs transition-all border-none cursor-pointer ${
                                  isSubActive 
                                    ? 'bg-[#004d49] text-white font-bold shadow-xs border-l-2 border-[#ff5500]' 
                                    : 'text-slate-300 font-medium hover:text-white hover:bg-[#0b3d3b]/40'
                                }`}
                              >
                                <span>{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm border-none cursor-pointer ${
                      isItemActive 
                        ? 'bg-[#0b3d3b] text-white font-semibold border-l-4 border-[#ff5500] shadow-sm' 
                        : 'text-slate-200 hover:bg-[#0b3d3b]/60'
                    }`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={19} className={isItemActive ? 'text-[#ff5500]' : 'text-slate-300'} />
                      {sidebarOpen && <span>{item.label}</span>}
                    </div>
                    {sidebarOpen && item.badge && (
                      <span className="bg-[#ff5500]/20 text-[#ff5500] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#ff5500]/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Admin User Footer Profile */}
      <div className="p-3 border-t border-[#0b3d3b] bg-[#00201f] shrink-0">
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} gap-2`}>
          {sidebarOpen ? (
            <div 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 overflow-hidden cursor-pointer group flex-1 min-w-0"
              title="View Profile Settings"
            >
              <div className="w-9 h-9 rounded-xl bg-[#003836] border border-[#0d4a48] group-hover:border-[#ff5500] flex items-center justify-center text-[#ff5500] shrink-0 shadow-xs transition-colors">
                <User size={18} />
              </div>
              <div className="truncate min-w-0">
                <p className="text-sm font-semibold text-white truncate m-0 leading-tight group-hover:text-[#ff5500] transition-colors">{adminName}</p>
                <p className="text-xs text-[#ff9966] truncate font-mono font-medium m-0 mt-0.5">{adminRole}</p>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setActiveTab('profile')}
              className="w-9 h-9 rounded-xl bg-[#003836] border border-[#0d4a48] hover:border-[#ff5500] flex items-center justify-center text-[#ff5500] shadow-xs cursor-pointer transition-colors" 
              title={`${adminName} (${adminRole})`}
            >
              <User size={18} />
            </div>
          )}

          {sidebarOpen && (
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border-none bg-transparent cursor-pointer shrink-0"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
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
    </aside>
  );
};


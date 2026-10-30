import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSuperAdmin } from '../context/SuperAdminContext';
import {
  LayoutDashboard,
  BookOpen,
  Receipt,
  Store,
  Truck,
  ArrowUpRight,
  RotateCcw,
  Percent,
  SlidersHorizontal,
  BarChart3,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Building2,
  Lock,
} from 'lucide-react';

export const SuperAdminSidebar = () => {
  const { sidebarOpen, setSidebarOpen, logout, superAdmin } = useSuperAdmin();
  const location = useLocation();

  const navigationItems = [
    {
      group: 'TREASURY & LEDGER',
      items: [
        {
          to: '/super-admin/dashboard',
          label: 'Financial Dashboard',
          icon: LayoutDashboard,
        },
        {
          to: '/super-admin/transactions',
          label: 'Central Ledger',
          icon: BookOpen,
        },
        {
          to: '/super-admin/payments',
          label: 'Customer Payments',
          icon: Receipt,
        },
      ],
    },
    {
      group: 'SETTLEMENTS & PAYOUTS',
      items: [
        {
          to: '/super-admin/payouts',
          label: 'Payout Requests',
          icon: ArrowUpRight,
        },
        {
          to: '/super-admin/seller-settlements',
          label: 'Seller Settlements',
          icon: Store,
        },
        {
          to: '/super-admin/captain-settlements',
          label: 'Captain Settlements',
          icon: Truck,
        },
      ],
    },
    {
      group: 'GOVERNANCE & ADJUSTMENTS',
      items: [
        {
          to: '/super-admin/refunds',
          label: 'Refunds & Returns',
          icon: RotateCcw,
        },
        {
          to: '/super-admin/commissions',
          label: 'Commissions',
          icon: Percent,
        },
        {
          to: '/super-admin/financial-adjustments',
          label: 'Financial Adjustments',
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      group: 'COMPLIANCE & AUDIT',
      items: [
        {
          to: '/super-admin/reports',
          label: 'Financial Reports',
          icon: BarChart3,
        },
        {
          to: '/super-admin/audit-logs',
          label: 'Audit Trail',
          icon: ShieldAlert,
        },
      ],
    },
  ];

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-72' : 'w-20'
      } bg-[#002625] text-slate-100 border-r border-[#003837] transition-all duration-300 flex flex-col h-screen sticky top-0 z-40 shrink-0 select-none shadow-2xl font-sans`}
    >
      {/* Brand Header */}
      <div className="h-20 bg-[#001c1b] border-b border-[#003837] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-[#ff5500] flex items-center justify-center text-white shadow-lg shadow-orange-950/40 shrink-0">
            <Building2 size={22} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-wider text-white">SATHI SELLER</span>
                <span className="text-[10px] bg-[#ff5500] text-white font-bold px-1.5 py-0.5 rounded shadow-xs">
                  TREASURY
                </span>
              </div>
              <p className="text-[11px] font-semibold text-teal-300/90 tracking-wide font-mono">
                Super Admin Financial
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 text-teal-300/80 hover:text-white hover:bg-[#003837] rounded-lg transition-colors border-none bg-transparent cursor-pointer"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin scrollbar-thumb-[#003837]">
        {navigationItems.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            {sidebarOpen && (
              <h4 className="text-[10.5px] font-black text-teal-300/60 tracking-widest uppercase px-3 mb-2 font-mono">
                {sec.group}
              </h4>
            )}
            <div className="space-y-1">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== '/super-admin/dashboard' && location.pathname.startsWith(item.to));

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm border-none cursor-pointer no-underline ${
                      isActive
                        ? 'bg-[#ff5500] text-white font-bold shadow-md shadow-[#001c1b]/60'
                        : 'text-teal-100/80 hover:text-white hover:bg-[#003837]'
                    }`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <Icon
                      size={19}
                      className={isActive ? 'text-white shrink-0' : 'text-teal-300/70 shrink-0'}
                    />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-[#003837] bg-[#001c1b] shrink-0">
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} gap-2`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-[#003837] border border-[#ff5500]/40 flex items-center justify-center text-[#ff5500] shrink-0 font-black text-xs">
                CFO
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">
                  {superAdmin?.name || 'Chief Financial Officer'}
                </p>
                <p className="text-[11px] text-teal-300 truncate font-mono font-medium flex items-center gap-1">
                  <Lock size={10} /> Super Admin
                </p>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#003837] border border-[#ff5500]/40 flex items-center justify-center text-[#ff5500] font-black text-xs">
              SA
            </div>
          )}

          {sidebarOpen && (
            <button
              onClick={logout}
              className="p-2 text-teal-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border-none bg-transparent cursor-pointer"
              title="Logout from Super Admin Treasury"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

import React from 'react';
import { useSuperAdmin } from '../context/SuperAdminContext';
import { ShieldCheck, Bell, RefreshCw, Lock } from 'lucide-react';

export const SuperAdminHeader = ({ title, subtitle, onRefresh, refreshing }) => {
  const { superAdmin, logout } = useSuperAdmin();

  return (
    <header className="h-18 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs font-sans">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-black text-[#002625] tracking-tight m-0">{title || 'Treasury & Ledger'}</h1>
          <span className="flex items-center gap-1 text-[10.5px] font-extrabold bg-orange-50 text-[#ff5500] border border-orange-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
            <ShieldCheck size={12} /> SECURE TREASURY
          </span>
        </div>
        {subtitle && <p className="text-xs text-slate-500 m-0 mt-0.5 font-medium">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer transition-all shadow-2xs active:scale-95"
            title="Refresh financial data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#ff5500]' : 'text-slate-600'} />
            <span>{refreshing ? 'Syncing...' : 'Live Sync'}</span>
          </button>
        )}

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-900 m-0 leading-tight">{superAdmin?.name || 'Chief Financial Officer'}</p>
            <p className="text-[10px] text-[#ff5500] font-mono font-bold m-0 flex items-center justify-end gap-1">
              <Lock size={10} /> Super Admin
            </p>
          </div>
          <button
            onClick={logout}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

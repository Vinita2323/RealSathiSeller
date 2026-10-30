import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  ArrowUpRight 
} from 'lucide-react';

export const StatWidget = ({ title, value, change, isPositive, isAlert, icon: Icon, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col justify-between"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500">{title}</p>
          <h3 className="text-xl font-bold text-slate-800 mt-1 tracking-tight group-hover:text-[#ff5500] transition-colors">
            {value}
          </h3>
        </div>
        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[#ff5500] group-hover:scale-105 group-hover:bg-[#ff5500] group-hover:text-white transition-all shrink-0">
          <Icon size={16} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
        {isAlert ? (
          <span className="flex items-center text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <AlertCircle size={11} className="mr-1" /> {change}
          </span>
        ) : isPositive ? (
          <span className="flex items-center text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <TrendingUp size={11} className="mr-1" /> {change}
          </span>
        ) : (
          <span className="flex items-center text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            <TrendingDown size={11} className="mr-1" /> {change}
          </span>
        )}
        <span className="text-slate-400 group-hover:text-slate-600 text-[11px] font-normal flex items-center gap-0.5">
          Details <ArrowUpRight size={11} />
        </span>
      </div>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'Active':
      case 'Verified':
      case 'Completed':
      case 'Operational':
      case 'Success':
      case 'In Stock':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pending':
      case 'Pending Approval':
      case 'Processing':
      case 'Assigned':
      case 'Low Stock':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'In Transit':
      case 'Dispatched':
      case 'On The Way':
      case 'On Delivery':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Suspended':
      case 'Blocked':
      case 'Cancelled':
      case 'Out of Stock':
      case 'Flagged':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle()}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {status}
    </span>
  );
};

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 text-slate-800 w-full max-w-lg rounded-2xl shadow-xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h3 className="text-lg font-bold text-[#002625]">{title}</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export const Drawer = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="bg-white border-l border-slate-200 text-slate-800 w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto relative animate-slideLeft">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export const Skeleton = ({ className = "h-6 w-full" }) => {
  return (
    <div className={`bg-slate-200 animate-pulse rounded-lg ${className}`} />
  );
};

export const EmptyState = ({ title = "No Data Available", message = "There are no records found for this view." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
      <div className="w-16 h-16 rounded-full bg-slate-100 text-[#ff5500] flex items-center justify-center mb-4">
        <AlertCircle size={32} />
      </div>
      <h4 className="text-lg font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 max-w-sm">{message}</p>
    </div>
  );
};

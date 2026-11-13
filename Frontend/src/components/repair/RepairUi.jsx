import React from 'react';
import {
  ArrowLeft, Smartphone, Tablet, Laptop, Monitor, Tv, WashingMachine, Refrigerator, Cpu, Wrench,
  Camera, Printer, Headphones, Watch, Speaker, Gamepad2, Fan, AirVent, Microwave, Router, Lightbulb,
  Keyboard, Mouse, HardDrive, Projector, Radio, Plug, Battery, Cable, Heater, CookingPot,
} from 'lucide-react';
import { REPAIR_STATUS_LABELS, repairStatusTone } from '../../services/repairService';

// Icons admins can pick for a repair category (name is what gets stored)
const ICONS = {
  Smartphone, Tablet, Laptop, Monitor, Tv, WashingMachine, Refrigerator, Cpu, Wrench,
  Camera, Printer, Headphones, Watch, Speaker, Gamepad2, Fan, AirVent, Microwave, Router, Lightbulb,
  Keyboard, Mouse, HardDrive, Projector, Radio, Plug, Battery, Cable, Heater, CookingPot,
};
export const REPAIR_ICON_NAMES = Object.keys(ICONS);

// Shows the category's custom image when set, otherwise its icon
export const RepairCategoryIcon = ({ name, image, size = 22, className = '' }) => {
  if (image) {
    return <img src={image} alt="" className={`w-full h-full object-cover ${className}`} />;
  }
  const Icon = ICONS[name] || Wrench;
  return <Icon size={size} className={className} />;
};

export const RepairStatusChip = ({ status }) => (
  <span className={`inline-block text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${repairStatusTone(status)}`}>
    {REPAIR_STATUS_LABELS[status] || status}
  </span>
);

export const RepairPageHeader = ({ title, subtitle, onBack, right }) => (
  <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-[16px] font-extrabold text-[#1e1b4b] m-0 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider m-0 truncate">{subtitle}</p>}
      </div>
    </div>
    {right}
  </header>
);

export const formatRupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

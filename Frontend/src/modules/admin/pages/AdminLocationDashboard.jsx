import React from 'react';
import { MapPin, Truck, Store, Users, Map } from 'lucide-react';

export const AdminLocationDashboard = () => {
  return (
    <div className="p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Global Location Dashboard</h1>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 shadow-sm">
            Filter by State
          </button>
          <button className="px-4 py-2 bg-[#ff5500] text-white rounded-lg text-sm font-semibold shadow-sm">
            Refresh Map
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-[#ff5500]">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Active Captains</p>
            <h3 className="text-xl font-bold text-slate-800">142</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <Store size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Sellers</p>
            <h3 className="text-xl font-bold text-slate-800">89</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Online Users</p>
            <h3 className="text-xl font-bold text-slate-800">1,204</h3>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-[500px] flex items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 bg-slate-100 opacity-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\\"20\\" height=\\"20\\" viewBox=\\"0 0 20 20\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"%23cbd5e1\\" fill-opacity=\\"0.4\\" fill-rule=\\"evenodd\\"%3E%3Ccircle cx=\\"3\\" cy=\\"3\\" r=\\"3\\"/%3E%3C/g%3E%3C/svg%3E")' }}></div>
        <div className="text-center relative z-10 p-6 bg-white/90 backdrop-blur rounded-2xl shadow-lg">
           <Map size={48} className="text-slate-300 mx-auto mb-3" />
           <h3 className="text-lg font-bold text-slate-800">Map Interface Ready</h3>
           <p className="text-sm text-slate-500 mt-1 max-w-sm">Google Maps API will be rendered here to plot all users, sellers, and active captains dynamically based on backend geo-queries.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLocationDashboard;

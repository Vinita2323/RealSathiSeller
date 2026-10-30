import React, { useState } from 'react';
import { Truck, UserCheck, MapPin, CheckCircle, Package, Clock, ShieldAlert } from 'lucide-react';

const mockDispatches = [
  { id: 'DISP-801', orderId: '#ORD-9020', captain: 'Rajesh Kumar', vehicle: 'Mahindra Bolero Pickup (DL-01-AB-1234)', destination: 'Karol Bagh, Delhi', status: 'Ready for Pickup', eta: '45 mins' },
  { id: 'DISP-802', orderId: '#ORD-9019', captain: 'Vikram Singh', vehicle: 'Tata Ace Gold (UP-14-XY-9876)', destination: 'Noida Sector 62', status: 'In Transit', eta: '15 mins' },
  { id: 'DISP-803', orderId: '#ORD-9018', captain: 'Suresh Verma', vehicle: 'Eicher Pro 2049 (DL-10-CD-4567)', destination: 'Connaught Place, Delhi', status: 'Completed', eta: 'Delivered' },
];

const Dispatch = () => {
  const [dispatches, setDispatches] = useState(mockDispatches);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Logistics & Dispatch Control</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Assign captains, track warehouse pickups, and print gate pass labels.</p>
        </div>
        <button className="bg-[#ff5500] hover:bg-[#e64d00] text-white font-bold py-2.5 px-4 rounded-md shadow-sm transition-colors cursor-pointer border-none flex items-center gap-2 text-sm">
          <Truck size={18} strokeWidth={2.5} />
          Create New Dispatch Manifest
        </button>
      </div>

      {/* Grid of Dispatch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dispatches.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-100 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="font-extrabold text-slate-900 text-base">{item.id}</span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : item.status === 'In Transit' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                  {item.status}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Order ID</span>
                <p className="font-bold text-slate-900 text-sm">{item.orderId}</p>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-600 font-semibold">
                <UserCheck size={16} className="text-[#ff5500] shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-900 font-bold text-xs">{item.captain}</p>
                  <p className="text-slate-400 font-normal">{item.vehicle}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-600 font-semibold">
                <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <span>{item.destination}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">ETA: <strong className="text-slate-900">{item.eta}</strong></span>
              <button className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-md border-none cursor-pointer hover:bg-slate-800">
                Print Gate Pass
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dispatch;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Truck, Bike, Clock, IndianRupee, Check, AlertCircle } from 'lucide-react';
import { useTransport } from '../../context/TransportContext';
import { transportService } from '../../../../services/transportService';

// Map backend icon string → Lucide component
const VehicleIcon = ({ iconName, size = 32 }) => {
  if (iconName === 'bike') return <Bike size={size} />;
  return <Truck size={size} />;
};

// Skeleton loader card shown while fetching
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-4 border-2 border-transparent animate-pulse flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="w-[60px] h-[60px] bg-slate-100 rounded-xl" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-28 bg-slate-100 rounded" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
        <div className="h-3 w-16 bg-slate-100 rounded" />
      </div>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="w-5 h-5 rounded-full bg-slate-100" />
      <div className="h-5 w-14 bg-slate-100 rounded" />
    </div>
  </div>
);

const VehicleSelection = () => {
  const navigate = useNavigate();
  const { updateActiveBooking, activeBooking } = useTransport();

  const [selectedVehicleId, setSelectedVehicleId] = useState(activeBooking.vehicle?._id || null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch vehicle types from backend on mount
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await transportService.getVehicles();
        setVehicles(data.vehicles || []);
      } catch (err) {
        console.error('Failed to fetch vehicles:', err);
        setError('Could not load vehicles. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  const handleNext = () => {
    if (!selectedVehicleId) return;
    const vehicle = vehicles.find(v => v._id === selectedVehicleId);
    updateActiveBooking('vehicle', vehicle);
    navigate('/transport/summary');
  };

  return (
    <div className="h-[100dvh] bg-[#f8fafc] font-sans text-slate-800 relative max-w-[480px] mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center py-4 px-4 bg-white z-10 sticky top-0 border-b border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} className="text-slate-700" />
        </button>
        <h2 className="text-[16px] font-bold tracking-tight m-0 text-slate-800 ml-3">Select Vehicle</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-[100px] [&::-webkit-scrollbar]:hidden flex flex-col gap-4">

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            <AlertCircle size={20} className="shrink-0" />
            <span className="text-[14px] font-medium">{error}</span>
            <button
              onClick={() => { setError(null); setLoading(true); transportService.getVehicles().then(d => setVehicles(d.vehicles || [])).catch(() => setError('Could not load vehicles.')).finally(() => setLoading(false)); }}
              className="ml-auto text-[12px] font-bold underline cursor-pointer bg-transparent border-none text-red-600"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

        {/* Vehicle List from API */}
        {!loading && !error && vehicles.map(vehicle => (
          <div
            key={vehicle._id}
            className={`bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border-2 cursor-pointer transition-all duration-200 flex items-center justify-between ${selectedVehicleId === vehicle._id ? 'border-[#ff5500] bg-orange-50/20' : 'border-transparent hover:border-slate-200'}`}
            onClick={() => setSelectedVehicleId(vehicle._id)}
          >
            <div className="flex items-center gap-4">
              <div className="w-[60px] h-[60px] bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-700">
                <VehicleIcon iconName={vehicle.icon} size={32} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-bold text-slate-800 m-0">{vehicle.name}</h3>
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">Up to {vehicle.capacityKg} kg</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-green-600 mt-0.5">
                  <Clock size={12} /> ₹{vehicle.perKmFare}/km
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between h-full gap-4">
              {selectedVehicleId === vehicle._id ? (
                <div className="w-5 h-5 rounded-full bg-[#ff5500] flex items-center justify-center">
                  <Check size={14} className="text-white" strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-200"></div>
              )}
              <div className="flex flex-col items-end">
                <div className="flex items-center text-[18px] font-extrabold text-slate-900">
                  <IndianRupee size={16} strokeWidth={2.5} /> {vehicle.minimumFare}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">min. fare</span>
              </div>
            </div>
          </div>
        ))}

      </div>

      {/* Next Button */}
      <div className="absolute bottom-0 left-0 w-full py-4 px-5 pb-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-[90]">
        <button
          className={`w-full rounded-xl py-3.5 px-8 text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${selectedVehicleId ? 'bg-[#ff5500] text-white shadow-[0_4px_12px_rgba(255,85,0,0.2)] active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          onClick={handleNext}
          disabled={!selectedVehicleId || loading}
        >
          Review Fare Summary
        </button>
      </div>

    </div>
  );
};

export default VehicleSelection;

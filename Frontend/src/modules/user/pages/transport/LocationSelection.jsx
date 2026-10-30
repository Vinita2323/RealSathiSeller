import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Search, Crosshair, Navigation, Plus, X, Edit3, Check, Loader2, AlertCircle } from 'lucide-react';
import { useTransport } from '../../context/TransportContext';
import { MapService } from '../../../../services/MapService';
import LocationSearchModal from '../../../../components/LocationSearchModal';

const LocationSelection = () => {
  const navigate = useNavigate();
  const { updateActiveBooking, activeBooking } = useTransport();

  // Helper to normalize location to structured object
  const normalizeLoc = (loc) => {
    if (!loc) return null;
    if (typeof loc === 'string') {
      return {
        address: loc,
        formattedAddress: loc,
        lat: null,
        lng: null,
        latitude: null,
        longitude: null,
      };
    }
    return loc;
  };

  const [pickup, setPickup] = useState(normalizeLoc(activeBooking.pickup) || null);
  const [stops, setStops] = useState((activeBooking.stops || []).map(normalizeLoc).filter(Boolean));
  const [drop, setDrop] = useState(normalizeLoc(activeBooking.drop) || null);

  // Modal State
  const [modalTarget, setModalTarget] = useState(null); // 'pickup', 'drop', or 'stop_0', 'stop_1', 'stop_2'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Open search modal for a specific field
  const handleOpenSearchModal = (target) => {
    setModalTarget(target);
    setIsModalOpen(true);
  };

  // Callback when a location is selected from Google Maps modal
  const handleLocationConfirmed = (locationObj) => {
    if (!locationObj) return;

    if (modalTarget === 'pickup') {
      setPickup(locationObj);
    } else if (modalTarget === 'drop') {
      setDrop(locationObj);
    } else if (modalTarget && modalTarget.startsWith('stop_')) {
      const idx = parseInt(modalTarget.split('_')[1], 10);
      setStops((prev) => {
        const updated = [...prev];
        updated[idx] = locationObj;
        return updated;
      });
    }
  };

  // Add intermediate stop
  const handleAddStop = () => {
    if (stops.length >= 3) return;
    const newIdx = stops.length;
    setStops((prev) => [...prev, null]);
    handleOpenSearchModal(`stop_${newIdx}`);
  };

  // Remove intermediate stop
  const handleRemoveStop = (index, e) => {
    e.stopPropagation();
    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  // GPS Current Location quick handler
  const handleQuickCurrentLocation = async (targetField = 'pickup') => {
    setGpsLoading(true);
    setGpsError('');
    try {
      const coords = await MapService.getCurrentCoordinates();
      const detailed = await MapService.reverseGeocode(coords.lat, coords.lng);
      if (targetField === 'pickup') {
        setPickup(detailed);
      } else if (targetField === 'drop') {
        setDrop(detailed);
      }
    } catch (err) {
      console.error('Quick GPS detection failed:', err);
      setGpsError(err.message || 'Could not detect GPS location. Please select on map.');
      setTimeout(() => setGpsError(''), 4000);
    } finally {
      setGpsLoading(false);
    }
  };

  // Proceed to goods details
  const handleNext = () => {
    if (!pickup || !drop) return;
    
    // Save structured objects to context
    updateActiveBooking('pickup', pickup);
    updateActiveBooking('stops', stops.filter(Boolean));
    updateActiveBooking('drop', drop);
    navigate('/transport/goods');
  };

  // Format display text
  const getDisplayText = (loc) => {
    if (!loc) return '';
    return loc.formattedAddress || loc.address || '';
  };

  const getSubText = (loc) => {
    if (!loc) return '';
    const parts = [loc.area, loc.city, loc.postalCode || loc.pincode].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div className="w-full max-w-[480px] h-[100dvh] min-h-[100dvh] bg-slate-50 font-sans text-slate-800 relative mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden box-border">
      
      {/* Header */}
      <header className="flex items-center justify-between py-3.5 px-4 bg-white z-10 sticky top-0 border-b border-slate-100 shadow-2xs w-full min-w-0 box-border shrink-0">
        <div className="flex items-center min-w-0 flex-1 pr-2">
          <button className="bg-transparent border-none cursor-pointer p-1 -ml-1 flex items-center shrink-0 text-slate-700 hover:text-slate-900" onClick={() => navigate(-1)}>
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[15px] font-bold tracking-tight m-0 text-slate-800 ml-1.5 truncate">Select Route</h2>
        </div>

        {/* Add Stop Header Action */}
        {stops.length < 3 && (
          <button
            type="button"
            onClick={handleAddStop}
            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] border border-emerald-200 px-2.5 py-1 rounded-lg text-[11.5px] font-bold cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Add Stop</span>
          </button>
        )}
      </header>

      {/* GPS Error Alert */}
      {gpsError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs box-border">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <span className="font-medium flex-1 truncate">{gpsError}</span>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden pb-[110px] [&::-webkit-scrollbar]:hidden box-border">
        
        {/* Route Timeline Card */}
        <div className="bg-white p-4 rounded-b-[24px] shadow-sm mb-4 relative z-10 border-b border-slate-100 w-full box-border overflow-hidden">
          <div className="flex gap-3 w-full min-w-0 items-start box-border">
            
            {/* Dynamic vertical route line */}
            <div className="flex flex-col items-center mt-3 shrink-0 self-stretch">
              {/* Pickup dot */}
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0"></div>
              
              {/* Intermediate stops dots */}
              {stops.map((_, idx) => (
                <React.Fragment key={`dot_${idx}`}>
                  <div className="w-0.5 flex-1 min-h-[36px] bg-slate-200 my-1"></div>
                  <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100 shrink-0"></div>
                </React.Fragment>
              ))}

              <div className="w-0.5 flex-1 min-h-[36px] bg-slate-200 my-1"></div>
              {/* Drop dot */}
              <div className="w-3.5 h-3.5 rounded-sm bg-orange-500 ring-4 ring-orange-100 shrink-0"></div>
            </div>
            
            {/* Inputs Container */}
            <div className="flex-1 min-w-0 flex flex-col gap-2.5 overflow-hidden">
              
              {/* Pickup Location Button/Card */}
              <div 
                onClick={() => handleOpenSearchModal('pickup')}
                className={`bg-slate-50 border-2 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 cursor-pointer transition-all w-full min-w-0 box-border ${
                  pickup ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex-1 min-w-0 overflow-hidden">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block truncate">Pickup Point</span>
                  {pickup ? (
                    <>
                      <span className="text-[12.5px] font-bold text-slate-800 block truncate mt-0.5">{getDisplayText(pickup)}</span>
                      {getSubText(pickup) && <span className="text-[10.5px] text-slate-500 font-medium block truncate mt-0.5">{getSubText(pickup)}</span>}
                    </>
                  ) : (
                    <span className="text-[12.5px] font-normal text-slate-400 block truncate mt-0.5">Search pickup address, building...</span>
                  )}
                </div>
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 shadow-2xs">
                  <Search size={15} />
                </div>
              </div>

              {/* Dynamic Stops */}
              {stops.map((stopVal, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleOpenSearchModal(`stop_${idx}`)}
                  className={`bg-slate-50 border-2 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 cursor-pointer transition-all w-full min-w-0 box-border ${
                    stopVal ? 'border-blue-500 bg-blue-50/20' : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block truncate">Stop {idx + 1} Point</span>
                    {stopVal ? (
                      <>
                        <span className="text-[12.5px] font-bold text-slate-800 block truncate mt-0.5">{getDisplayText(stopVal)}</span>
                        {getSubText(stopVal) && <span className="text-[10.5px] text-slate-500 font-medium block truncate mt-0.5">{getSubText(stopVal)}</span>}
                      </>
                    ) : (
                      <span className="text-[12.5px] font-normal text-slate-400 block truncate mt-0.5">Search stop {idx + 1} address...</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveStop(idx, e)}
                    className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 text-slate-500 flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
                    title="Remove Stop"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              {/* Drop Location Button/Card */}
              <div 
                onClick={() => handleOpenSearchModal('drop')}
                className={`bg-slate-50 border-2 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 cursor-pointer transition-all w-full min-w-0 box-border ${
                  drop ? 'border-orange-500 bg-orange-50/20' : 'border-slate-200 hover:border-orange-300'
                }`}
              >
                <div className="flex-1 min-w-0 overflow-hidden">
                  <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wider block truncate">Drop Destination</span>
                  {drop ? (
                    <>
                      <span className="text-[12.5px] font-bold text-slate-800 block truncate mt-0.5">{getDisplayText(drop)}</span>
                      {getSubText(drop) && <span className="text-[10.5px] text-slate-500 font-medium block truncate mt-0.5">{getSubText(drop)}</span>}
                    </>
                  ) : (
                    <span className="text-[12.5px] font-normal text-slate-400 block truncate mt-0.5">Search drop address, warehouse...</span>
                  )}
                </div>
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 shadow-2xs">
                  <Search size={15} />
                </div>
              </div>

              {/* In-Card Add Stop Button */}
              {stops.length < 3 && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="flex items-center gap-1.5 text-[#047857] hover:text-[#065f46] font-bold text-[12px] bg-transparent border-none cursor-pointer py-1 px-1 transition-colors"
                  >
                    <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center text-[#047857]">
                      <Plus size={12} strokeWidth={3} />
                    </div>
                    <span>+ Add Stop {stops.length > 0 ? `(${stops.length}/3)` : ''}</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="px-4 mb-4 grid grid-cols-2 gap-2.5 w-full min-w-0 box-border">
          <button 
            type="button"
            disabled={gpsLoading}
            onClick={() => handleQuickCurrentLocation('pickup')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl shadow-2xs cursor-pointer transition-all active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-[#047857] shrink-0">
              {gpsLoading ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
            </div>
            <span className="text-[11.5px] font-bold text-[#047857] truncate">
              {gpsLoading ? 'Detecting...' : 'Current GPS Pickup'}
            </span>
          </button>
          
          <button 
            type="button"
            onClick={() => handleOpenSearchModal('drop')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs cursor-pointer transition-all active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Navigation size={13} />
            </div>
            <span className="text-[11.5px] font-bold text-slate-700 truncate">Search Drop Map</span>
          </button>
        </div>

        {/* Selected Route Summary Banner */}
        {pickup && drop && (
          <div className="mx-4 p-3.5 bg-gradient-to-r from-[#047857] to-teal-800 text-white rounded-2xl shadow-md space-y-1.5 box-border overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-200">
                Verified Route Ready
              </span>
              <span className="text-[10.5px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                {stops.length > 0 ? `${stops.length + 2} Total Points` : 'Direct Haulage'}
              </span>
            </div>
            <p className="text-[11.5px] text-emerald-100 m-0 leading-relaxed font-medium truncate">
              From <strong className="text-white">{pickup.city || 'Pickup'}</strong> to <strong className="text-white">{drop.city || 'Destination'}</strong>
            </p>
          </div>
        )}

      </div>

      {/* Next Button */}
      <div className="fixed sm:absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto py-3.5 px-4 pb-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-[90] box-border">
        <button 
          className={`w-full rounded-xl py-3.5 px-6 text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
            pickup && drop 
              ? 'bg-[#047857] text-white shadow-[0_4px_12px_rgba(4,120,87,0.25)] active:scale-[0.98]' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border-none'
          }`}
          onClick={handleNext}
          disabled={!pickup || !drop}
        >
          Confirm Route {stops.length > 0 ? `(${stops.length + 2} points)` : ''}
        </button>
      </div>

      {/* Reusable Google Places Autocomplete Search Modal */}
      <LocationSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleLocationConfirmed}
        title={
          modalTarget === 'pickup'
            ? 'Set Pickup Location'
            : modalTarget === 'drop'
            ? 'Set Drop Destination'
            : modalTarget
            ? `Set Stop ${parseInt(modalTarget.split('_')[1], 10) + 1} Point`
            : 'Select Location'
        }
        placeholder="Type building, street, area, landmark, or city..."
        initialLocation={
          modalTarget === 'pickup'
            ? pickup
            : modalTarget === 'drop'
            ? drop
            : modalTarget && modalTarget.startsWith('stop_')
            ? stops[parseInt(modalTarget.split('_')[1], 10)]
            : null
        }
        accentColor={modalTarget === 'drop' ? '#ea580c' : modalTarget?.startsWith('stop_') ? '#2563eb' : '#047857'}
      />

    </div>
  );
};

export default LocationSelection;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Navigation, X, Check, Loader2, AlertCircle, Building2, ChevronRight } from 'lucide-react';
import { MapService } from '../services/MapService';

/**
 * Reusable Mobile-First Google Places Location Autocomplete & Search Modal.
 *
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Modal close handler
 * @param {function} onSelect - Callback when complete structured address is confirmed
 * @param {string} [title="Select Location"] - Modal title
 * @param {string} [placeholder="Search address, building, area, landmark..."] - Search input placeholder
 * @param {Object} [initialLocation=null] - Currently selected location object
 * @param {string} [accentColor="#047857"] - Theme color accent
 */
const LocationSearchModal = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Select Location / स्थान चुनें',
  placeholder = 'Search street, building, area, landmark... / सड़क, भवन, क्षेत्र, लैंडमार्क खोजें...',
  initialLocation = null,
  accentColor = '#047857',
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [resolvingDetails, setResolvingDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Initialize selected location when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setQuery('');
      setPredictions([]);
      if (initialLocation && (initialLocation.address || initialLocation.formattedAddress)) {
        setSelectedLocation(initialLocation);
      } else {
        setSelectedLocation(null);
      }
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, initialLocation]);

  // Handle live typing with debounced Places autocomplete
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setErrorMsg('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setPredictions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await MapService.getPlacePredictions(val);
        setPredictions(results);
      } catch (err) {
        console.error('Places search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 280);
  };

  // Handle selecting a prediction from Google Places
  const handleSelectPrediction = async (prediction) => {
    setResolvingDetails(true);
    setErrorMsg('');
    try {
      const fullDetails = await MapService.getPlaceDetails(prediction.placeId);
      setSelectedLocation(fullDetails);
      setPredictions([]);
      setQuery(fullDetails.formattedAddress);
    } catch (err) {
      console.error('Failed to resolve place details:', err);
      setErrorMsg('Could not fetch complete details for this place. Please try another. / इस स्थान का पूरा विवरण प्राप्त नहीं हो सका। कृपया दूसरा स्थान चुनें।');
    } finally {
      setResolvingDetails(false);
    }
  };

  // Handle detecting GPS location
  const handleDetectGps = async () => {
    setDetectingGps(true);
    setErrorMsg('');
    try {
      const coords = await MapService.getCurrentCoordinates();
      const detailed = await MapService.reverseGeocode(coords.lat, coords.lng);
      setSelectedLocation(detailed);
      setQuery(detailed.formattedAddress);
      setPredictions([]);
    } catch (err) {
      console.error('GPS detect error:', err);
      setErrorMsg(err.message || 'Unable to detect GPS location. Please enter location manually. / जीपीएस स्थान का पता लगाने में असमर्थ। कृपया मैन्युअल रूप से स्थान दर्ज करें।');
    } finally {
      setDetectingGps(false);
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    if (!selectedLocation) return;
    onSelect(selectedLocation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="bg-white w-full sm:max-w-lg rounded-t-[28px] sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] relative z-10 overflow-hidden animate-slide-up-modal"
      >
        {/* Top Drag Handle (Mobile) */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: accentColor }}>
              <MapPin size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-slate-900 m-0 leading-tight">{title}</h2>
              <span className="text-[11px] font-semibold text-slate-400">Powered by Google Maps / गूगल मैप्स द्वारा संचालित</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center border-none cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0 space-y-2.5">
          <div className="relative flex items-center bg-white border-2 rounded-2xl shadow-2xs transition-all focus-within:ring-2" style={{ borderColor: accentColor }}>
            <Search size={18} className="absolute left-3.5 text-slate-400 shrink-0 pointer-events-none" />
            <input 
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder={placeholder}
              className="w-full bg-transparent border-none py-3.5 pl-10 pr-10 text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
            />
            {query && (
              <button 
                type="button"
                onClick={() => { setQuery(''); setPredictions([]); setSelectedLocation(null); inputRef.current?.focus(); }}
                className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Use Current GPS Location Button */}
          <button 
            type="button"
            onClick={handleDetectGps}
            disabled={detectingGps}
            className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-xl flex items-center justify-between text-left cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                {detectingGps ? <Loader2 size={15} className="animate-spin text-emerald-700" /> : <Navigation size={15} className="text-emerald-700" />}
              </div>
              <div>
                <span className="text-[12.5px] font-bold text-slate-800 block">Use current GPS location / वर्तमान जीपीएस स्थान का उपयोग करें</span>
                <span className="text-[10.5px] text-slate-500 font-medium">Detect exact coordinates automatically / सटीक निर्देशांक स्वचालित रूप से खोजें</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <span className="font-medium flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:hidden min-h-[160px] max-h-[360px]">
          {/* Searching Loader */}
          {(searching || resolvingDetails) && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin" style={{ color: accentColor }} />
              <span className="text-[12px] font-medium">
                {resolvingDetails ? 'Fetching complete address details... / पूरे पते का विवरण प्राप्त किया जा रहा है...' : 'Searching places in India... / भारत में स्थान खोजे जा रहे हैं...'}
              </span>
            </div>
          )}

          {/* Predictions Dropdown */}
          {!searching && !resolvingDetails && predictions.length > 0 && (
            <div className="flex flex-col divide-y divide-slate-100 rounded-2xl bg-white border border-slate-100 shadow-2xs overflow-hidden">
              {predictions.map((p) => (
                <div 
                  key={p.placeId}
                  onClick={() => handleSelectPrediction(p)}
                  className="p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors active:bg-slate-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                    <Building2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-slate-900 block truncate">{p.mainText}</span>
                    <span className="text-[11px] text-slate-500 font-medium block truncate mt-0.5">{p.secondaryText || p.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Address Breakdown Card */}
          {selectedLocation && !searching && !resolvingDetails && predictions.length === 0 && (
            <div className="bg-emerald-50/60 border-2 border-emerald-500/30 rounded-2xl p-4 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-700" strokeWidth={3} />
                  Selected Location Verified / चयनित स्थान सत्यापित
                </span>
                {selectedLocation.latitude && selectedLocation.longitude && (
                  <span className="text-[10px] font-mono bg-white text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                    {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                  </span>
                )}
              </div>

              <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs">
                <p className="text-[13px] font-bold text-slate-900 leading-snug m-0">
                  {selectedLocation.formattedAddress || selectedLocation.address}
                </p>

                {/* Breakdown tags */}
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                  {selectedLocation.area && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Locality / इलाका: {selectedLocation.area}
                    </span>
                  )}
                  {selectedLocation.city && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      City / शहर: {selectedLocation.city}
                    </span>
                  )}
                  {selectedLocation.state && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      State / राज्य: {selectedLocation.state}
                    </span>
                  )}
                  {selectedLocation.postalCode && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      PIN / पिन: {selectedLocation.postalCode}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty Search Prompt */}
          {!searching && !resolvingDetails && predictions.length === 0 && !selectedLocation && (
            <div className="py-6 text-center text-slate-400 space-y-1">
              <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[13px] font-bold text-slate-600 m-0">Search any location in India / भारत में कोई भी स्थान खोजें</p>
              <p className="text-[11px] text-slate-400 m-0">Type building, street, area or tap GPS button above / भवन, सड़क, क्षेत्र लिखें या ऊपर जीपीएस बटन दबाएं</p>
            </div>
          )}
        </div>

        {/* Footer / Confirm Action */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button 
            type="button"
            onClick={handleConfirm}
            disabled={!selectedLocation || resolvingDetails}
            className="w-full py-3.5 rounded-xl text-[14px] font-bold text-white shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border-none"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={18} />
            Confirm This Location / इस स्थान की पुष्टि करें
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationSearchModal;

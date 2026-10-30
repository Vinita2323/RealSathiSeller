import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Search, Navigation, Check, Home as HomeIcon, Briefcase, Loader2, Building2, Plus } from 'lucide-react';
import { useLocationContext } from '../../../context/LocationContext';
import { addressService } from '../../../services/authService';
import { MapService } from '../../../services/MapService';
import LocationSearchModal from '../../../components/LocationSearchModal';
import AddAddressForm from '../components/AddAddressForm';
import { locationMatchesSavedAddress, syncSavedAddressesAfterChange } from '../../../utils/userLocation';

const LocationSelectionPage = () => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { setLocation, currentLocation } = useLocationContext();

  const leaveLocationPage = () => {
    const from = routeLocation.state?.from || routeLocation.state?.returnUrl;
    if (
      from &&
      typeof from === 'string' &&
      !from.includes('verify-otp') &&
      from !== '/login' &&
      !from.startsWith('/login?')
    ) {
      navigate(from, { replace: true });
      return;
    }
    // Always leave auth screens out of the back stack after address/location selection
    navigate('/', { replace: true });
  };

  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const searchDebounceRef = useRef(null);

  const loadSavedAddresses = async ({ syncSelection = false } = {}) => {
    try {
      const res = await addressService.getAddresses();
      if (res && res.success && Array.isArray(res.addresses)) {
        setSavedAddresses(res.addresses);
        localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(res.addresses));
        if (syncSelection) syncSavedAddressesAfterChange(res.addresses);
        return res.addresses;
      }
    } catch (err) {}

    const saved = localStorage.getItem('sathiseller_saved_addresses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedAddresses(parsed);
          if (syncSelection) syncSavedAddressesAfterChange(parsed);
          return parsed;
        }
      } catch (e) {}
    }
    return [];
  };

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const handleAddressSaved = async (addresses) => {
    if (Array.isArray(addresses)) {
      setSavedAddresses(addresses);
      syncSavedAddressesAfterChange(addresses);
    }
    await loadSavedAddresses({ syncSelection: true });
  };

  // GPS Auto-Detection with Google Maps Reverse Geocode
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setError('');

    try {
      const coords = await MapService.getCurrentCoordinates();
      let detailed = null;
      try {
        detailed = await MapService.reverseGeocode(coords.lat, coords.lng);
      } catch (geoErr) {
        console.error('Reverse geocode failed, saving GPS coordinates:', geoErr);
      }

      const lat = Number(detailed?.latitude || detailed?.lat || coords.lat);
      const lng = Number(detailed?.longitude || detailed?.lng || coords.lng);
      const city = [detailed?.city, detailed?.district, detailed?.area].find((part) => part && part !== 'City') || '';
      const state = detailed?.state || '';
      const pincode = detailed?.postalCode || detailed?.pincode || '';
      const addressLine1 = detailed?.formattedAddress || detailed?.address || `Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

      let fullName = localStorage.getItem('sathiseller_user_name') || '';
      let phone = localStorage.getItem('sathiseller_user_phone') || '';
      try {
        const userData = JSON.parse(localStorage.getItem('sathiseller_user_data') || '{}');
        if (!fullName && userData.name) fullName = userData.name;
        if (!phone && userData.phone) phone = userData.phone;
      } catch (e) {}
      if (!fullName || fullName === 'User') fullName = 'Customer';

      const point = { type: 'Point', coordinates: [lng, lat] };
      let saved = savedAddresses.find((addr) => locationMatchesSavedAddress({ addressLine1, pincode }, addr)) || null;
      let addressList = savedAddresses;

      if (!saved && localStorage.getItem('sathiseller_user_token') && phone && city && state && pincode) {
        try {
          const res = await addressService.addAddress({
            fullName,
            phone,
            addressLine1,
            city,
            state,
            pincode,
            country: detailed?.country || 'India',
            addressType: savedAddresses.length === 0 ? 'Home' : 'Other',
            isDefault: savedAddresses.length === 0,
            location: point,
          });
          if (res?.success && Array.isArray(res.addresses) && res.addresses.length > 0) {
            addressList = res.addresses;
            setSavedAddresses(res.addresses);
            saved = res.addresses.find((addr) => locationMatchesSavedAddress({ addressLine1, pincode }, addr))
              || res.addresses[res.addresses.length - 1];
          }
        } catch (saveErr) {
          console.error('Could not store GPS address:', saveErr);
        }
      }

      const selected = {
        ...(saved || {}),
        fullName: saved?.fullName || fullName,
        phone: saved?.phone || phone,
        addressLine1: saved?.addressLine1 || addressLine1,
        address: saved?.addressLine1 || addressLine1,
        city: saved?.city || city,
        state: saved?.state || state,
        pincode: saved?.pincode || pincode,
        addressType: saved?.addressType || (savedAddresses.length === 0 ? 'Home' : 'Other'),
        location: saved?.location?.coordinates ? saved.location : point,
      };

      localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(selected));
      if (saved && addressList.length > 0) syncSavedAddressesAfterChange(addressList);

      setLocation({
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        city: selected.city,
        state: selected.state,
        pincode: selected.pincode,
        area: detailed?.area || selected.city || 'Current Location',
        addressLine1: selected.addressLine1,
        address: selected.addressLine1,
        formattedAddress: addressLine1,
        addressType: selected.addressType,
        fullName: selected.fullName,
        phone: selected.phone,
        _id: saved?._id || saved?.id || '',
        id: saved?._id || saved?.id || '',
        fromSavedAddress: true,
      });
      leaveLocationPage();
    } catch (err) {
      console.error('Google Maps location detection error:', err);
      setError(err.message || 'Failed to detect GPS location. Please try again.');
    } finally {
      setIsLocating(false);
    }
  };

  // Live Typing in Search Box with Google Places Autocomplete
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setError('');

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!val.trim()) {
      setPredictions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await MapService.getPlacePredictions(val);
        setPredictions(results);
      } catch (err) {
        console.error('Google Places predictions error:', err);
      } finally {
        setSearching(false);
      }
    }, 280);
  };

  // Select Prediction from dropdown
  const handleSelectPrediction = async (p) => {
    setSearching(true);
    try {
      const fullDetails = await MapService.getPlaceDetails(p.placeId);
      const locObj = {
        lat: fullDetails.latitude || fullDetails.lat,
        lng: fullDetails.longitude || fullDetails.lng,
        latitude: fullDetails.latitude || fullDetails.lat,
        longitude: fullDetails.longitude || fullDetails.lng,
        city: fullDetails.city || 'City',
        state: fullDetails.state || '',
        pincode: fullDetails.postalCode || fullDetails.pincode || '',
        area: fullDetails.area || fullDetails.city,
        addressLine1: fullDetails.formattedAddress || fullDetails.address,
        formattedAddress: fullDetails.formattedAddress,
        addressType: 'LOCATION',
      };
      setLocation(locObj);
      leaveLocationPage();
    } catch (err) {
      console.error('Place selection failed:', err);
      setError('Could not resolve selected location.');
    } finally {
      setSearching(false);
    }
  };

  // Google Maps Modal Callback
  const handleModalLocationSelect = (loc) => {
    if (!loc) return;
    const locObj = {
      lat: loc.latitude || loc.lat,
      lng: loc.longitude || loc.lng,
      latitude: loc.latitude || loc.lat,
      longitude: loc.longitude || loc.lng,
      city: loc.city || 'City',
      state: loc.state || '',
      pincode: loc.postalCode || loc.pincode || '',
      area: loc.area || loc.city,
      addressLine1: loc.formattedAddress || loc.address,
      formattedAddress: loc.formattedAddress,
      addressType: 'LOCATION',
    };
    setLocation(locObj);
    leaveLocationPage();
  };

  const handleSelectSavedAddress = async (addr) => {
    const savedName = localStorage.getItem('sathiseller_user_name');
    const cleanFullName = (!addr.fullName || addr.fullName === 'User' || addr.fullName === 'Customer')
      ? (savedName && savedName !== 'User' && savedName !== 'Customer' ? savedName : 'Customer')
      : addr.fullName;

    const coords = addr.location?.coordinates;
    let resolvedLat = (coords && Array.isArray(coords) && coords.length >= 2 && coords[1] !== 0) 
      ? coords[1] 
      : (addr.lat || addr.latitude || null);
    let resolvedLng = (coords && Array.isArray(coords) && coords.length >= 2 && coords[0] !== 0) 
      ? coords[0] 
      : (addr.lng || addr.longitude || null);

    if (resolvedLat == null || resolvedLng == null) {
      try {
        const fullAddrStr = `${addr.addressLine1 || addr.address || ''}, ${addr.city || 'Indore'}, ${addr.state || 'Madhya Pradesh'} ${addr.pincode || addr.zip || ''}`.trim();
        const geoRes = await MapService.geocodeAddress(fullAddrStr).catch(async () => {
          return await MapService.geocodeAddress(`${addr.city || 'Indore'}, ${addr.state || 'Madhya Pradesh'}`).catch(() => null);
        });
        if (geoRes && (geoRes.latitude || geoRes.lat)) {
          resolvedLat = geoRes.latitude || geoRes.lat;
          resolvedLng = geoRes.longitude || geoRes.lng;
        }
      } catch (e) {}
    }

    const locObj = {
      addressType: addr.addressType || addr.type || 'HOME',
      addressLine1: addr.addressLine1 || addr.address,
      city: addr.city || 'Indore',
      state: addr.state || 'Madhya Pradesh',
      pincode: addr.pincode || addr.zip || '452001',
      fullName: cleanFullName,
      phone: addr.phone || localStorage.getItem('sathiseller_user_phone') || '',
      ...(resolvedLat != null && resolvedLng != null ? {
        lat: Number(resolvedLat),
        lng: Number(resolvedLng),
        latitude: Number(resolvedLat),
        longitude: Number(resolvedLng),
      } : {})
    };
    setLocation(locObj);
    localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify({ ...addr, fullName: cleanFullName }));
    leaveLocationPage();
  };

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans max-w-[480px] md:max-w-3xl mx-auto relative flex flex-col md:py-8 md:px-6 overflow-hidden md:overflow-visible">
      {/* Mobile Header */}
      <div className="flex md:hidden bg-white px-4 py-4 items-center shadow-xs z-10 shrink-0 border-b border-slate-100">
        <button onClick={leaveLocationPage} className="mr-3 p-1 rounded-full hover:bg-slate-100 transition-colors border-none cursor-pointer">
          <ArrowLeft size={22} className="text-slate-800" />
        </button>
        <div>
          <h1 className="text-[17px] font-extrabold text-slate-900 m-0">Select Delivery Location</h1>
          <span className="text-[11px] font-semibold text-slate-400">Powered by Google Maps</span>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={leaveLocationPage} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Back
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Location</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Select Delivery Location</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs">
          <MapPin size={16} className="text-[#ea580c]" />
          Powered by Google Maps
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-0 space-y-4 [&::-webkit-scrollbar]:hidden pb-10 md:pb-12 md:overflow-visible">
        {/* GPS Location Button */}
        <button 
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 shadow-xs border border-slate-100 hover:border-[#ea580c] cursor-pointer transition-all active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100">
            {isLocating ? (
              <Loader2 size={20} className="text-[#ea580c] animate-spin" />
            ) : (
              <Navigation size={20} className="text-[#ea580c]" />
            )}
          </div>
          <div className="text-left flex-1">
            <h3 className="text-[14px] font-bold text-slate-900 m-0">Use current GPS location</h3>
            <p className="text-[12px] font-medium text-slate-500 m-0 mt-0.5">Auto-detect complete address</p>
          </div>
        </button>

        {error && <p className="text-red-500 text-xs font-semibold text-center m-0 bg-red-50 py-2 px-3 rounded-xl border border-red-200">{error}</p>}

        {/* Quick Search Location with Google Places Autocomplete */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider m-0">Search Location</h3>
            <button
              type="button"
              onClick={() => setIsMapModalOpen(true)}
              className="text-[11px] font-bold text-[#ea580c] hover:underline bg-transparent border-none cursor-pointer"
            >
              Open Full Map Search
            </button>
          </div>

          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search area, landmark, street or city..." 
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-all"
            />
            {searching && (
              <Loader2 size={16} className="absolute right-3 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Autocomplete Predictions Dropdown */}
          {predictions.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-sm mt-1">
              {predictions.map((p) => (
                <div
                  key={p.placeId}
                  onClick={() => handleSelectPrediction(p)}
                  className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-2.5 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Building2 size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-bold text-slate-900 block truncate">{p.mainText}</span>
                    <span className="text-[10.5px] text-slate-500 block truncate">{p.secondaryText}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsAddAddressOpen(true)}
          className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 shadow-xs border border-slate-100 hover:border-[#ea580c] cursor-pointer transition-all active:scale-[0.99] text-left"
        >
          <div className="w-9 h-9 rounded-full bg-orange-100/60 text-[#ea580c] flex items-center justify-center shrink-0">
            <Plus size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-extrabold text-slate-900 m-0">Add New Address</h3>
            <p className="text-[11px] text-slate-500 font-medium m-0">Save a name, street, city, ZIP code and phone</p>
          </div>
        </button>

        {/* Saved Addresses List */}
        {savedAddresses.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 flex flex-col gap-3">
            <h3 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider m-0">Saved Addresses</h3>
            <div className="flex flex-col gap-2">
              {savedAddresses.map((addr, idx) => {
                const tag = addr.addressType || addr.type || 'HOME';
                const isSelected = currentLocation && (currentLocation.addressLine1 === (addr.addressLine1 || addr.address));
                return (
                  <div
                    key={addr._id || addr.id || idx}
                    onClick={() => handleSelectSavedAddress(addr)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected ? 'border-[#ea580c] bg-orange-50/40 ring-1 ring-[#ea580c]' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 text-slate-600">
                      {tag.toUpperCase() === 'HOME' ? <HomeIcon size={16} /> : <Briefcase size={16} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-slate-900">
                          {(!addr.fullName || addr.fullName === 'User' || addr.fullName === 'Customer')
                            ? (localStorage.getItem('sathiseller_user_name') && localStorage.getItem('sathiseller_user_name') !== 'User' && localStorage.getItem('sathiseller_user_name') !== 'Customer' ? localStorage.getItem('sathiseller_user_name') : tag)
                            : addr.fullName}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {tag}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 leading-snug m-0 mt-0.5">
                        {addr.addressLine1 || addr.address}, {addr.city}
                      </p>
                    </div>
                    {isSelected && <Check size={16} className="text-[#ea580c] shrink-0 mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Full Google Maps Location Search Modal */}
      <AddAddressForm
        open={isAddAddressOpen}
        onClose={() => setIsAddAddressOpen(false)}
        isDefault={savedAddresses.length === 0}
        onSaved={handleAddressSaved}
      />

      <LocationSearchModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelect={handleModalLocationSelect}
        title="Search Delivery Location"
        placeholder="Search house/flat, street, area, city..."
        accentColor="#ea580c"
      />
    </div>
  );
};

export default LocationSelectionPage;

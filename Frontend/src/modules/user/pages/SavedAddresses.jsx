import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { addressService } from '../../../services/authService';
import { clearStoredUserLocation, syncSavedAddressesAfterChange } from '../../../utils/userLocation';
import AddAddressForm from '../components/AddAddressForm';

const SavedAddresses = () => {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [makeDefault, setMakeDefault] = useState(false);

  const formatAddresses = (rawList) => {
    return rawList.map(a => ({
      ...a,
      id: a._id || a.id,
      name: a.fullName || a.name || userName,
      fullName: a.fullName || a.name || userName,
      address: a.addressLine1 || a.address,
      addressLine1: a.addressLine1 || a.address,
      zip: a.pincode || a.zip,
      pincode: a.pincode || a.zip,
      type: a.addressType || a.type || 'Home',
      addressType: a.addressType || a.type || 'Home',
    }));
  };

  const fetchUserAddresses = async () => {
    try {
      setLoading(true);
      const res = await addressService.getAddresses();
      if (res && res.success && Array.isArray(res.addresses)) {
        const formatted = formatAddresses(res.addresses);
        setAddresses(formatted);
        localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(formatted));
        if (formatted.length === 0) {
          localStorage.removeItem('sathiseller_selected_checkout_address');
        }
        return formatted;
      }
    } catch (err) {
      console.error('Failed to fetch backend addresses:', err);
    } finally {
      setLoading(false);
    }

    // Fallback to local storage only when the server request fails
    const saved = localStorage.getItem('sathiseller_saved_addresses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const formatted = formatAddresses(parsed);
          setAddresses(formatted);
          return formatted;
        }
      } catch (err) {
        console.error('Failed to parse saved addresses:', err);
      }
    }
    setAddresses([]);
    return [];
  };

  useEffect(() => {
    const name = localStorage.getItem('sathiseller_user_name') || '';
    const phone = localStorage.getItem('sathiseller_user_phone') || '';
    setUserName(name);
    setUserPhone(phone);
    fetchUserAddresses();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      if (id && !String(id).startsWith('addr_')) {
        await addressService.deleteAddress(id);
      }
    } catch (err) {
      console.error('Failed to delete backend address:', err);
    }
    const updated = addresses.filter(addr => (addr.id || addr._id) !== id);
    if (updated.length > 0 && !updated.some(a => a.isDefault)) {
      updated[0].isDefault = true;
    }
    setAddresses(updated);
    localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(updated));
    if (updated.length === 0) {
      localStorage.removeItem('sathiseller_selected_checkout_address');
      clearStoredUserLocation();
    }
  };

  const handleSetDefault = async (id) => {
    try {
      if (id && !String(id).startsWith('addr_')) {
        await addressService.setDefaultAddress(id);
      }
    } catch (err) {
      console.error('Failed to set default address on server:', err);
    }
    const updated = addresses.map(addr => ({
      ...addr,
      isDefault: (addr.id || addr._id) === id
    }));
    setAddresses(updated);
    localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(updated));
    const def = updated.find(a => a.isDefault);
    if (def) {
      localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(def));
    }
  };

  const handleEdit = (addr, e) => {
    e.stopPropagation();
    setEditingAddress(addr);
    setMakeDefault(!!addr.isDefault);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setMakeDefault(addresses.length === 0);
    setIsModalOpen(true);
  };

  const handleAddressSaved = async (savedAddresses) => {
    if (Array.isArray(savedAddresses)) {
      syncSavedAddressesAfterChange(savedAddresses);
    }
    const list = await fetchUserAddresses();
    if (Array.isArray(list)) {
      syncSavedAddressesAfterChange(list);
    }
  };

  return (
    <div className="w-full max-w-[480px] md:max-w-5xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-8">
      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center py-5 px-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] z-10 sticky top-0">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} className="text-slate-900" />
        </button>
        <h2 className="text-[17px] font-extrabold m-0 text-slate-900 tracking-tight">Saved Addresses</h2>
        <div className="w-6"></div>
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate('/profile')} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Profile
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Saved Addresses</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Delivery Addresses</h1>
        </div>
        <button 
          onClick={handleAddNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-sm rounded-xl border-none cursor-pointer transition-colors shadow-sm"
        >
          <Plus size={18} /> Add New Address
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-0 py-6 md:py-0 pb-28 md:pb-12 [&::-webkit-scrollbar]:hidden md:overflow-visible">
        {addresses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-[#ff5500] flex items-center justify-center">
              <MapPin size={28} />
            </div>
            <h3 className="text-[16px] font-bold text-slate-800 m-0">No saved addresses yet</h3>
            <p className="text-[13px] text-slate-500 max-w-[240px] m-0">Add a new address for seamless checkout and delivery.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div 
                key={addr.id} 
                onClick={() => handleSetDefault(addr.id)}
                className={`bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border flex gap-4 cursor-pointer transition-all ${
                  addr.isDefault ? 'border-[#ea580c] ring-2 ring-orange-500/10' : 'border-slate-100 hover:border-orange-100'
                }`}
              >
                <div className="pt-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    addr.type === 'Home' ? 'bg-[#ffedd5] text-[#ea580c]' : addr.type === 'Work' ? 'bg-[#e0e7ff] text-[#4338ca]' : 'bg-[#d1fae5] text-[#059669]'
                  }`}>
                    <MapPin size={20} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-extrabold text-[#1e1b4b] m-0">{addr.type}</h3>
                      {addr.isDefault && (
                        <span className="bg-orange-100 text-[#ea580c] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Check size={10} strokeWidth={3} /> Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        className="text-slate-400 hover:text-[#ea580c] transition-colors p-1 border-none bg-transparent cursor-pointer"
                        onClick={(e) => handleEdit(addr, e)}
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 border-none bg-transparent cursor-pointer"
                        onClick={(e) => handleDelete(addr.id, e)}
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[13px] font-bold text-slate-700 m-0 mb-1">{addr.name || userName}</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed m-0 mb-2">
                    {addr.address}, {addr.city}, {addr.state} - {addr.zip}
                  </p>
                  <p className="text-[12px] font-medium text-slate-600 m-0">
                    Phone: {addr.phone || userPhone}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Sticky Action (Mobile only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-5 bg-white/95 backdrop-blur-md border-t border-slate-100 max-w-[480px] mx-auto z-20">
        <button 
          onClick={handleAddNew}
          className="w-full bg-[#ea580c] text-white rounded-2xl py-4 font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(234,88,12,0.25)] border-none cursor-pointer active:scale-[0.98] transition-transform"
        >
          <Plus size={20} />
          Add New Address
        </button>
      </div>

      <AddAddressForm
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={editingAddress}
        isDefault={makeDefault}
        onSaved={handleAddressSaved}
      />

    </div>
  );
};

export default SavedAddresses;

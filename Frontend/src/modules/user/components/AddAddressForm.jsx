import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { addressService } from '../../../services/authService';

const EMPTY_FORM = {
  addressType: 'Home',
  fullName: '',
  addressLine1: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
};

const TAGS = ['Home', 'Office', 'Other'];

function normalizeTag(tag) {
  if (tag === 'Work') return 'Office';
  return TAGS.includes(tag) ? tag : 'Home';
}

function validateForm(form) {
  if (!form.fullName.trim()) return 'Please enter the full name';
  if (!form.addressLine1.trim()) return 'Please enter the street address';
  if (!form.city.trim()) return 'Please enter the city';
  if (!form.state.trim()) return 'Please enter the state';
  if (!/^\d{6}$/.test(form.pincode.trim())) return 'Please enter a valid 6-digit ZIP code';
  const phoneDigits = form.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Please enter a valid phone number';
  return '';
}

const AddAddressForm = ({
  open,
  onClose,
  address = null,
  isDefault = false,
  onSaved,
}) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addressId = address?._id || address?.id || '';
  const isEdit = Boolean(addressId) && !String(addressId).startsWith('addr_');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    if (address) {
      setForm({
        addressType: normalizeTag(address.addressType || address.type || 'Home'),
        fullName: address.fullName || address.name || '',
        addressLine1: address.addressLine1 || address.address || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || address.zip || '',
        phone: address.phone || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, address]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = validateForm(form);
    if (message) {
      setError(message);
      return;
    }

    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      addressLine1: form.addressLine1.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      country: 'India',
      addressType: normalizeTag(form.addressType),
    };
    if ((!isEdit && isDefault) || (isEdit && address?.isDefault)) {
      payload.isDefault = true;
    }

    setSaving(true);
    setError('');
    try {
      const res = isEdit
        ? await addressService.updateAddress(addressId, payload)
        : await addressService.addAddress(payload);
      if (!res || res.success === false) {
        setError(res?.message || 'Could not save this address');
        setSaving(false);
        return;
      }
      if (onSaved) await onSaved(Array.isArray(res.addresses) ? res.addresses : []);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not save this address');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={saving ? undefined : onClose}></div>

      <div className="relative bg-white w-full rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-w-[480px] sm:max-w-lg mx-auto z-10">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[18px] font-extrabold text-slate-900 m-0">
            {isEdit ? 'Edit Address' : 'Add Address'}
          </h3>
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border-none cursor-pointer text-slate-500 hover:bg-slate-200 transition-colors"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Address Tag</label>
              <select
                value={form.addressType}
                onChange={(e) => updateField('addressType', e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-bold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors cursor-pointer"
              >
                <option value="Home">Home</option>
                <option value="Office">Office</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
              <input
                required
                type="text"
                placeholder="Full Name"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Street Address</label>
            <input
              required
              type="text"
              placeholder="House / Flat No., Building, Street"
              value={form.addressLine1}
              onChange={(e) => updateField('addressLine1', e.target.value)}
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">City</label>
              <input
                required
                type="text"
                placeholder="City"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">State</label>
              <input
                required
                type="text"
                placeholder="State"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Zip Code</label>
              <input
                required
                type="text"
                inputMode="numeric"
                placeholder="Pincode / Zip"
                value={form.pincode}
                onChange={(e) => updateField('pincode', e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Phone Number</label>
              <input
                required
                type="tel"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-[12px] p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs font-semibold m-0 bg-red-50 py-2 px-3 rounded-xl border border-red-200">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#ea580c] text-white rounded-[16px] py-4 mt-2 font-bold text-[15px] cursor-pointer active:scale-[0.98] transition-transform border-none shadow-[0_4px_16px_rgba(234,88,12,0.25)] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Address'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddAddressForm;

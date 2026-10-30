import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../../../services/authService';

const TransportRegistration = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    city: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch logged in user profile on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await userService.getProfile();
        if (res.user) {
          setFormData({
            fullName: res.user.name && res.user.name !== 'User' ? res.user.name : '',
            mobile: res.user.phone || '',
            city: res.user.addresses?.[0]?.city || '',
          });
        }
      } catch (e) {
        // If not logged in or token expired, fallback gracefully
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.fullName.trim() || !formData.mobile.trim()) {
      setErrorMsg('Full Name and Mobile Number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save profile updates to backend MongoDB
      await userService.updateProfile({
        name: formData.fullName.trim(),
        phone: formData.mobile.trim(),
        city: formData.city.trim(),
      });
      localStorage.setItem('sathiseller_transport_registered', 'true');
      navigate('/transport');
    } catch (err) {
      console.error('Registration save error:', err);
      setErrorMsg(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col justify-center items-center p-4 font-sans relative">
      {/* Background ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1e2b4f]/10 to-transparent pointer-events-none"></div>

      <div className="bg-white w-full max-w-[400px] rounded-[28px] shadow-[0_20px_45px_rgba(0,0,0,0.08)] p-6 md:p-8 relative z-10 box-border">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#ff6000]/10 text-[#ff6000] mb-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-[#1e2b4f] tracking-tight">Vehicle Booking Profile</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Confirm your contact details for live freight booking & instant captain dispatch.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1e2b4f] mb-1.5 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              placeholder="e.g. Rajesh Kumar"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#1e2b4f] focus:outline-none focus:border-[#ff6000] focus:ring-1 focus:ring-[#ff6000] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1e2b4f] mb-1.5 uppercase tracking-wider">
              Mobile Number
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-xs font-semibold text-slate-500 select-none">+91</span>
              <input
                type="tel"
                name="mobile"
                required
                maxLength={10}
                value={formData.mobile}
                onChange={handleChange}
                placeholder="98765 43210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm text-[#1e2b4f] focus:outline-none focus:border-[#ff6000] focus:ring-1 focus:ring-[#ff6000] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1e2b4f] mb-1.5 uppercase tracking-wider">
              City / Hub Zone
            </label>
            <input
              type="text"
              name="city"
              required
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Mumbai, Maharashtra"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#1e2b4f] focus:outline-none focus:border-[#ff6000] focus:ring-1 focus:ring-[#ff6000] transition-all"
            />
          </div>

          {/* Security & Verification Note */}
          <div className="flex items-center gap-2 bg-[#97fc43]/15 p-3 rounded-xl border border-[#97fc43]/40 text-xs text-[#1e2b4f]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#397200" strokeWidth="2.2" className="shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <span className="font-semibold text-[11px] text-[#397200]">
              Instant Captain Dispatch & ISO 27001 Verified Transport
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#ff6000] to-[#ff4500] hover:from-[#e55600] hover:to-[#e53e00] text-white font-bold py-3.5 rounded-2xl text-sm shadow-[0_6px_18px_rgba(255,69,0,0.3)] transition-all transform active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Saving Profile…
              </>
            ) : (
              <>
                Save & Continue to Transport
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/transport')}
            className="text-xs font-semibold text-slate-400 hover:text-[#1e2b4f] transition-colors cursor-pointer bg-transparent border-none"
          >
            Skip to Transport Home ➔
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransportRegistration;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, AlertCircle, Clock, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import CustomDatePicker from '../../../components/CustomDatePicker';
import { profileEditRequestService } from '../../../services/authService';

const AccountInfo = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const notice = location.state?.notice || '';
  const returnUrl = location.state?.returnUrl || '';

  const [isEditing, setIsEditing] = useState(() => Boolean(notice));
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingRequest, setPendingRequest] = useState(null);

  const [formData, setFormData] = useState(() => {
    const userDataRaw = localStorage.getItem('sathiseller_user_data');
    let name = localStorage.getItem('sathiseller_user_name');
    let email = localStorage.getItem('sathiseller_user_email');
    let phone = localStorage.getItem('sathiseller_user_phone');
    if (userDataRaw) {
      try {
        const u = JSON.parse(userDataRaw);
        if (!name && u.name) name = u.name;
        if (!email && u.email) email = u.email;
        if (!phone && u.phone) phone = u.phone;
      } catch (e) {}
    }
    return {
      fullName: name && name !== 'User' && name !== 'Customer' ? name : '',
      email: email || '',
      phone: phone || '',
      dob: localStorage.getItem('sathiseller_user_dob') || ''
    };
  });

  useEffect(() => {
    fetchPendingRequest();
  }, []);

  const fetchPendingRequest = async () => {
    try {
      const res = await profileEditRequestService.getMyPendingEditRequest();
      if (res?.request) {
        setPendingRequest(res.request);
      }
    } catch (e) {
      // Non-blocking
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.fullName || formData.fullName.trim().length < 2) {
      alert('Please enter a valid Full Name.');
      return;
    }

    const cleanName = formData.fullName.trim();
    const cleanEmail = formData.email.trim();
    const cleanPhone = formData.phone.trim();
    const cleanDob = formData.dob;

    setSaving(true);
    setSuccessMsg('');

    try {
      const payload = {
        role: 'user',
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        dob: cleanDob,
      };

      const res = await profileEditRequestService.submitEditRequest(payload);
      if (res && res.success) {
        setSuccessMsg('Profile update submitted for admin verification! Changes will take effect once approved.');
        if (res.request) {
          setPendingRequest(res.request);
        }
        setIsEditing(false);

        if (returnUrl) {
          setTimeout(() => {
            navigate(returnUrl, { replace: true });
          }, 1500);
        }
      } else {
        alert(res?.message || 'Failed to submit profile update.');
      }
    } catch (err) {
      console.error('Error submitting user edit request:', err);
      alert(err.response?.data?.message || 'Could not submit profile update for verification.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] md:max-w-3xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-8">
      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center py-5 px-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] z-10 sticky top-0">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} className="text-slate-900" />
        </button>
        <h2 className="text-[17px] font-extrabold m-0 text-slate-900 tracking-tight">Account Information</h2>
        <div className="w-6"></div> {/* Spacer for centering */}
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate('/profile')} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Profile
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Account Information</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Personal Profile & Details</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
          <ShieldCheck size={16} className="text-emerald-600" />
          Verified Account
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-0 py-6 md:py-0 [&::-webkit-scrollbar]:hidden flex flex-col gap-4 md:overflow-visible">
        
        {notice && (
          <div className="bg-orange-50 border border-orange-200 text-[#ea580c] px-4 py-3 rounded-2xl text-[13px] font-semibold flex items-center gap-2.5 shadow-sm">
            <AlertCircle size={20} className="shrink-0 text-[#ea580c]" />
            <span>{notice}</span>
          </div>
        )}

        {/* Pending Verification Notice */}
        {pendingRequest && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <Clock size={20} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-amber-900">Verification Pending</h4>
                <span className="bg-amber-200/80 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  In Review
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                Your submitted profile changes are currently under administrator review and will reflect once verified.
              </p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-[12px] font-semibold flex items-center gap-2 shadow-sm">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider pl-1">Full Name *</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  name="fullName"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-[16px] py-3.5 pl-12 pr-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors disabled:opacity-70 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider pl-1">Email Address</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-[16px] py-3.5 pl-12 pr-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors disabled:opacity-70 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider pl-1">Phone Number *</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone size={18} />
                </div>
                <input 
                  type="tel" 
                  name="phone"
                  placeholder="Enter your mobile number"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-[16px] py-3.5 pl-12 pr-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-[#ea580c] focus:bg-white transition-colors disabled:opacity-70 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* DOB */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider pl-1">Date of Birth</label>
              <div className="relative z-10">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none">
                  <Calendar size={18} />
                </div>
                <CustomDatePicker 
                  value={formData.dob}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Select Date of Birth"
                />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Action */}
      <div className="p-5 md:p-0 md:mt-6 bg-white md:bg-transparent border-t md:border-none border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] md:shadow-none">
        {isEditing ? (
          <button 
            disabled={saving}
            className="w-full bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-2xl py-4 font-bold text-[15px] cursor-pointer active:scale-[0.98] transition-transform border-none shadow-[0_4px_16px_rgba(234,88,12,0.2)] flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={handleSave}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            <span>{saving ? 'Submitting...' : (returnUrl ? 'Submit for Verification & Continue' : 'Submit for Verification')}</span>
          </button>
        ) : (
          <button 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 font-bold text-[15px] cursor-pointer active:scale-[0.98] transition-transform border-none shadow-[0_4px_16px_rgba(15,23,42,0.2)]"
            onClick={() => setIsEditing(true)}
          >
            Edit Information
          </button>
        )}
      </div>

    </div>
  );
};

export default AccountInfo;

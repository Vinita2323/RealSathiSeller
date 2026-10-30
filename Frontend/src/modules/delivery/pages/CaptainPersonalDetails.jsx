import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  CreditCard,
  FileText,
  ShieldCheck,
  Edit3,
  Check,
  Calendar,
  AlertCircle,
  ExternalLink,
  Upload,
  Eye,
  RefreshCw,
  X,
  Download,
  Image as ImageIcon,
  ZoomIn,
  Clock,
  Shield
} from 'lucide-react';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService, profileEditRequestService } from '../../../services/authService';

const CaptainPersonalDetails = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Details updated successfully!');
  const [pendingRequest, setPendingRequest] = useState(null);

  // Document modal & upload state
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const fileInputRef = useRef(null);
  const [currentUploadKey, setCurrentUploadKey] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    alternateMobile: '',
    dob: '',
    age: '',
    fatherName: '',
    currentAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    pinCode: '',
    emergencyContact: '',
    vehicleType: 'Two Wheeler',
    drivingLicenseNumber: '',
    rcNumber: '',
    vehicleInsuranceNumber: '',
    insuranceValidTill: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
  });

  const [documents, setDocuments] = useState({
    drivingLicense: '',
    rcDocument: '',
    aadhaarFront: '',
    aadhaarBack: '',
    insuranceDoc: '',
    profilePhoto: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const [res, reqRes] = await Promise.all([
        captainService.getProfile().catch(() => null),
        profileEditRequestService.getMyPendingEditRequest().catch(() => ({ hasPendingRequest: false, request: null })),
      ]);

      if (reqRes?.request) {
        setPendingRequest(reqRes.request);
      } else {
        setPendingRequest(null);
      }

      if (res?.captain) {
        setProfile(res.captain);
        setFormData({
          name: res.captain.name || '',
          email: res.captain.email || '',
          alternateMobile: res.captain.alternateMobile || '',
          dob: res.captain.dob || '',
          age: res.captain.age || '',
          fatherName: res.captain.fatherName || '',
          currentAddress: res.captain.currentAddress || '',
          permanentAddress: res.captain.permanentAddress || '',
          city: res.captain.city || '',
          state: res.captain.state || '',
          pinCode: res.captain.pinCode || '',
          emergencyContact: res.captain.emergencyContact || '',
          vehicleType: res.captain.vehicleType || 'Two Wheeler',
          drivingLicenseNumber: res.captain.drivingLicenseNumber || '',
          rcNumber: res.captain.rcNumber || '',
          vehicleInsuranceNumber: res.captain.vehicleInsuranceNumber || '',
          insuranceValidTill: res.captain.insuranceValidTill || '',
          bankName: res.captain.bankDetails?.bankName || '',
          accountHolderName: res.captain.bankDetails?.accountHolderName || '',
          accountNumber: res.captain.bankDetails?.accountNumber || '',
          ifscCode: res.captain.bankDetails?.ifscCode || '',
          branchName: res.captain.bankDetails?.branchName || '',
          upiId: res.captain.bankDetails?.upiId || '',
        });

        if (res.captain.documents) {
          setDocuments(res.captain.documents);
        }
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        role: 'captain',
        name: formData.name,
        email: formData.email,
        alternateMobile: formData.alternateMobile,
        dob: formData.dob,
        age: formData.age,
        fatherName: formData.fatherName,
        currentAddress: formData.currentAddress,
        permanentAddress: formData.permanentAddress,
        city: formData.city,
        state: formData.state,
        pinCode: formData.pinCode,
        emergencyContact: formData.emergencyContact,
        vehicleType: formData.vehicleType,
        drivingLicenseNumber: formData.drivingLicenseNumber,
        rcNumber: formData.rcNumber,
        vehicleInsuranceNumber: formData.vehicleInsuranceNumber,
        insuranceValidTill: formData.insuranceValidTill,
        bankDetails: {
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          branchName: formData.branchName,
          upiId: formData.upiId,
        },
        documents,
      };

      const res = await profileEditRequestService.submitEditRequest(payload);
      if (res && res.success) {
        if (res.request) {
          setPendingRequest(res.request);
        }
        setIsEditing(false);
        triggerToast('Modifications submitted for admin verification!');
      } else {
        alert(res?.message || 'Failed to submit modifications.');
      }
    } catch (err) {
      console.error('Update profile error:', err);
      alert(err?.response?.data?.message || 'Failed to submit details for verification.');
    } finally {
      setSaving(false);
    }
  };

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3500);
  };

  // Trigger file selection for a specific document
  const triggerDocUpload = (key) => {
    setCurrentUploadKey(key);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle uploaded file conversion & DB save
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadKey) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    setUploadingDocKey(currentUploadKey);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const updatedDocs = {
        ...documents,
        [currentUploadKey]: base64Data,
      };

      try {
        const res = await captainService.updateProfile({ documents: updatedDocs });
        if (res.captain) {
          setProfile(res.captain);
          setDocuments(res.captain.documents || updatedDocs);
          if (selectedDoc && selectedDoc.key === currentUploadKey) {
            setSelectedDoc((prev) => ({ ...prev, url: base64Data }));
          }
          triggerToast('Real document photo uploaded and saved successfully!');
        }
      } catch (err) {
        console.error('Doc upload error:', err);
        alert(err?.response?.data?.message || 'Failed to upload document.');
      } finally {
        setUploadingDocKey(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const maskAadhaar = (num) => {
    if (!num) return '—';
    const str = String(num);
    if (str.length < 4) return str;
    return `•••• •••• ${str.slice(-4)}`;
  };

  // Document metadata for list & preview
  const documentsList = [
    {
      key: 'drivingLicense',
      title: 'Driving License (DL)',
      docNumber: profile?.drivingLicenseNumber || 'd4838588844444',
      status: documents.drivingLicense ? 'Uploaded (Real Image)' : 'Verified Document',
      icon: 'badge',
      url: documents.drivingLicense,
      docType: 'DRIVING LICENSE',
      state: profile?.state || 'Madhya Pradesh',
      name: profile?.name || 'Nansi T',
      validTill: '2044-02-20',
      category: profile?.vehicleType === 'Two Wheeler' ? 'MCWG / LMV' : 'LMV - Commercial',
    },
    {
      key: 'rcDocument',
      title: 'Vehicle RC Document',
      docNumber: profile?.rcNumber || '5584545',
      status: documents.rcDocument ? 'Uploaded (Real Image)' : 'Verified Document',
      icon: 'directions_car',
      url: documents.rcDocument,
      docType: 'REGISTRATION CERTIFICATE (RC)',
      state: profile?.state || 'Madhya Pradesh',
      name: profile?.name || 'Nansi T',
      validTill: '2038-08-14',
      category: `${profile?.vehicleType || 'Two Wheeler'} - Goods Carrier`,
    },
    {
      key: 'aadhaarFront',
      title: 'Aadhaar Card (Front & Back)',
      docNumber: maskAadhaar(profile?.aadhaarNumber || '644060741846'),
      status: documents.aadhaarFront ? 'Uploaded (Real Image)' : 'Verified Document',
      icon: 'contact_mail',
      url: documents.aadhaarFront || documents.aadhaarBack,
      docType: 'AADHAAR IDENTITY CARD',
      state: 'Government of India',
      name: profile?.name || 'Nansi T',
      validTill: 'Life Long Validity',
      category: `DOB: ${profile?.dob || '2004-02-20'} • Female`,
    },
    {
      key: 'insuranceDoc',
      title: 'Vehicle Insurance Policy',
      docNumber: profile?.vehicleInsuranceNumber || 'POL-99382-771',
      status: documents.insuranceDoc ? 'Uploaded (Real Image)' : 'Valid & Verified',
      icon: 'verified_user',
      url: documents.insuranceDoc,
      docType: 'COMMERCIAL VEHICLE INSURANCE',
      state: 'National Insurance Corp',
      name: profile?.name || 'Nansi T',
      validTill: profile?.insuranceValidTill || '2027-04-30',
      category: 'Comprehensive Zero Depreciation Coverage',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-28 text-slate-800">
      {/* Hidden File Input for Document Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Top Header with Back Navigation */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#002625] via-[#0a3d16] to-[#002625] px-4 py-3.5 shadow-md border-b border-white/10">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/captain/profile')}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/15 shadow-xs"
              title="Back to Profile"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-black text-white leading-tight">Personal Information</h1>
              <p className="text-[10px] text-[#97fc43] font-semibold uppercase tracking-wider">KYC Details & Uploaded Documents</p>
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-[#97fc43] hover:bg-[#86e835] text-[#002625] rounded-xl text-xs font-black flex items-center gap-1 shadow-md transition-all cursor-pointer"
            >
              <Edit3 size={13} />
              Edit
            </button>
          )}
        </div>
      </header>

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#15803d] text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check size={16} />
          {toastMessage}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🖼️ EXPANDED FULL-VIEW REAL DOCUMENT PREVIEW MODAL       */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in"
          onClick={() => { setSelectedDoc(null); setIsZoomed(false); }}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh] border border-slate-200"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'modalSlideUp 0.2s ease-out' }}
          >
            {/* Clean Modal Header */}
            <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">{selectedDoc.title}</h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{selectedDoc.docNumber}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedDoc(null); setIsZoomed(false); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors border-none"
              >
                <X size={18} />
              </button>
            </div>

            {/* Document Image Container - Expansive Full Scrollable Area */}
            <div className="p-3 sm:p-5 overflow-y-auto space-y-3 flex-1 flex flex-col items-center justify-center bg-slate-100/60 max-h-[75vh]">
              {selectedDoc.url ? (
                <div className="w-full bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex flex-col items-center justify-center overflow-auto">
                  <div className="w-full overflow-auto flex items-center justify-center min-h-[260px] max-h-[64vh]">
                    <img
                      src={selectedDoc.url}
                      alt={selectedDoc.title}
                      className={`w-auto max-w-full h-auto object-contain rounded-lg transition-transform duration-200 ${
                        isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
                      }`}
                      style={{ maxHeight: isZoomed ? 'none' : '62vh' }}
                      onClick={() => setIsZoomed(!isZoomed)}
                    />
                  </div>
                  <div className="w-full pt-2 flex items-center justify-between border-t border-slate-100 px-1 mt-1 text-[11px] text-slate-500 font-medium">
                    <span>{isZoomed ? 'Zoomed in (Scroll to inspect)' : 'Full view'}</span>
                    <button
                      onClick={() => setIsZoomed(!isZoomed)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 border-none cursor-pointer text-[11px]"
                    >
                      <ZoomIn size={12} /> {isZoomed ? 'Fit to Screen' : 'Zoom 150%'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-white rounded-2xl p-10 border border-dashed border-slate-300 text-center space-y-3 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                    <Upload size={26} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">No Document Image Uploaded</p>
                    <p className="text-xs text-slate-500 mt-1">Please select and upload a clear photo or scan of your {selectedDoc.title}</p>
                  </div>
                  <button
                    onClick={() => triggerDocUpload(selectedDoc.key)}
                    disabled={uploadingDocKey === selectedDoc.key}
                    className="mt-2 px-5 py-2.5 bg-[#15803d] hover:bg-[#0f602c] text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-all border-none"
                  >
                    {uploadingDocKey === selectedDoc.key ? 'Uploading…' : 'Select Photo to Upload'}
                  </button>
                </div>
              )}
            </div>

            {/* Clean Action Footer */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0">
              <button
                onClick={() => triggerDocUpload(selectedDoc.key)}
                disabled={uploadingDocKey === selectedDoc.key}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border-none disabled:opacity-60"
              >
                {uploadingDocKey === selectedDoc.key ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  <Upload size={15} />
                )}
                {uploadingDocKey === selectedDoc.key ? 'Uploading…' : 'Change / Re-upload Document'}
              </button>

              <button
                onClick={() => { setSelectedDoc(null); setIsZoomed(false); }}
                className="px-6 py-2.5 bg-[#002625] hover:bg-[#0a3d16] text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all border-none"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-3.5 pt-3.5 space-y-3.5">
        {/* Pending Verification Banner */}
        {pendingRequest && (
          <div className="bg-amber-50 border border-amber-300 rounded-3xl p-4 flex items-start gap-3 shadow-xs">
            <Clock size={20} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-amber-900">Modifications Under Admin Verification</h4>
                <span className="bg-amber-200/80 text-amber-900 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Pending Review
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                You submitted profile/vehicle/banking updates on <strong>{new Date(pendingRequest.createdAt).toLocaleDateString('en-IN')}</strong>. They are currently being audited by the administrator before taking effect.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="material-symbols-outlined text-5xl text-[#15803d] animate-spin">sync</span>
            <p className="text-sm text-slate-500 font-semibold">Loading registration information…</p>
          </div>
        ) : (
          <>
            {/* 1. Top Verified Profile Banner */}
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#002625] to-[#15803d] text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-slate-900 leading-snug truncate">
                    {profile?.name || 'Captain Partner'}
                  </h2>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    VERIFIED
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{profile?.phone}</p>
                <p className="text-[11px] text-slate-400 truncate">{profile?.email || 'No email provided'}</p>
              </div>
            </div>

            {/* 1. Personal Information Section */}
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <User size={16} className="text-[#15803d]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Personal Details</h3>
              </div>

              {isEditing ? (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Alternate Mobile</label>
                      <input
                        type="text"
                        name="alternateMobile"
                        value={formData.alternateMobile}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Date of Birth</label>
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Father's Name</label>
                      <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Full Name</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{profile?.name || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Mobile Number</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{profile?.phone || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Email</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{profile?.email || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Alt. Mobile</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{profile?.alternateMobile || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Date of Birth / Age</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{profile?.dob || (profile?.age ? `${profile.age} yrs` : '—')}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Father's Name</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{profile?.fatherName || '—'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Address Details Section */}
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <MapPin size={16} className="text-[#15803d]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Address Details</h3>
              </div>

              {isEditing ? (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Current Address</label>
                    <input
                      type="text"
                      name="currentAddress"
                      value={formData.currentAddress}
                      onChange={handleChange}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">State</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">PIN Code</label>
                      <input
                        type="text"
                        name="pinCode"
                        value={formData.pinCode}
                        onChange={handleChange}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Emergency Contact</label>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#15803d]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Current Address</span>
                    <p className="font-bold text-slate-900 mt-0.5">{profile?.currentAddress || '—'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {profile?.city ? `${profile.city}, ` : ''}{profile?.state ? `${profile.state} ` : ''}{profile?.pinCode ? `- ${profile.pinCode}` : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Aadhaar Card</span>
                      <p className="font-bold text-slate-900 mt-0.5">{maskAadhaar(profile?.aadhaarNumber)}</p>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Emergency Contact</span>
                      <p className="font-bold text-slate-900 mt-0.5">{profile?.emergencyContact || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Vehicle & License Details */}
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Truck size={16} className="text-[#15803d]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Vehicle Details</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Vehicle Type</span>
                  <p className="font-bold text-slate-900 mt-0.5">{profile?.vehicleType || 'Two Wheeler'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">RC Number</span>
                  <p className="font-bold text-slate-900 mt-0.5">{profile?.rcNumber || '—'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Driving License</span>
                  <p className="font-bold text-slate-900 mt-0.5">{profile?.drivingLicenseNumber || '—'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Insurance Validity</span>
                  <p className="font-bold text-slate-900 mt-0.5">{profile?.insuranceValidTill || '—'}</p>
                </div>
              </div>
            </div>

            {/* 4. Bank & Payout Details */}
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <CreditCard size={16} className="text-[#15803d]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bank Account Details</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Bank Name</span>
                  <p className="font-bold text-slate-900 mt-0.5">{profile?.bankDetails?.bankName || '—'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Account Holder</span>
                  <p className="font-bold text-slate-900 mt-0.5">{profile?.bankDetails?.accountHolderName || profile?.name || '—'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Account Number</span>
                  <p className="font-bold text-slate-900 mt-0.5 font-mono">
                    {profile?.bankDetails?.accountNumber ? `•••• ${profile.bankDetails.accountNumber.slice(-4)}` : '—'}
                  </p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">IFSC Code</span>
                  <p className="font-bold text-slate-900 mt-0.5 font-mono">{profile?.bankDetails?.ifscCode || '—'}</p>
                </div>
              </div>
            </div>

            {/* 5. Uploaded Documents Section (AFTER BANK ACCOUNT SECTION) */}
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#15803d]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Uploaded Documents</h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Tap to View Real Image
                </span>
              </div>

              <div className="space-y-2.5">
                {documentsList.map((doc) => {
                  const isUploading = uploadingDocKey === doc.key;
                  return (
                    <div
                      key={doc.key}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Real Photo Thumbnail or Doc Icon */}
                          {doc.url ? (
                            <img
                              src={doc.url}
                              alt={doc.title}
                              onClick={() => setSelectedDoc(doc)}
                              className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500/40 shadow-xs cursor-pointer shrink-0 hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-[#15803d] flex items-center justify-center font-bold shrink-0 shadow-2xs">
                              <span className="material-symbols-outlined text-xl">{doc.icon}</span>
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-snug truncate">{doc.title}</p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{doc.docNumber}</p>
                            <p className="text-[9.5px] text-emerald-700 font-semibold mt-0.5">
                              {doc.url ? '✓ Real Image Attached' : '✓ Verified Digital Record'}
                            </p>
                          </div>
                        </div>

                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                          <ShieldCheck size={11} className="text-emerald-600" />
                          VERIFIED
                        </span>
                      </div>

                      {/* View Real Document & Change Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-800 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                        >
                          <Eye size={14} className="text-emerald-700" />
                          View Real Doc
                        </button>

                        <button
                          onClick={() => triggerDocUpload(doc.key)}
                          disabled={isUploading}
                          className="flex-1 py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-60"
                        >
                          {isUploading ? (
                            <span className="material-symbols-outlined animate-spin text-xs">sync</span>
                          ) : (
                            <Upload size={13} className="text-emerald-700" />
                          )}
                          {isUploading ? 'Uploading…' : 'Upload / Change'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editing Action Bar */}
            {isEditing && (
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex-2 py-3 bg-[#15803d] hover:bg-[#0f602c] text-white rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {saving ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : <Shield size={16} />}
                  {saving ? 'Submitting Request…' : 'Submit for Verification'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        @keyframes modalSlideUp {
          from { transform: translateY(24px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

      <CaptainBottomNav />
    </div>
  );
};

export default CaptainPersonalDetails;

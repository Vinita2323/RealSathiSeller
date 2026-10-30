import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Wallet,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Info,
  XCircle,
} from 'lucide-react';
import { captainService, authService } from '../../../services/authService';

const DELETION_REASONS = [
  'I am switching to another delivery platform or job',
  'Issues or dissatisfaction with payout rates / earnings',
  'Not receiving enough orders or delivery trips in my area',
  'App performance / battery drain / GPS tracking issues',
  'Taking a temporary break / personal reasons',
  'Other reason',
];

const CaptainDeleteAccount = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [selectedReason, setSelectedReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await captainService.getProfile();
      if (res.captain) {
        setProfile(res.captain);
      }
    } catch (err) {
      console.error('Failed to load captain profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (!selectedReason) {
      setErrorMsg('Please select a reason for deleting your account.');
      return;
    }
    if (!confirmedCheck) {
      setErrorMsg('Please tick the confirmation box acknowledging permanent data loss.');
      return;
    }
    setErrorMsg('');
    setShowConfirmModal(true);
  };

  const handleProceedDelete = async () => {
    setIsDeleting(true);
    setErrorMsg('');
    try {
      const res = await captainService.deleteAccount(selectedReason, feedback);
      if (res.success) {
        authService.logout('captain');
        navigate('/captain/login', {
          replace: true,
          state: { message: 'Your Captain Partner account has been successfully deleted.' },
        });
      } else {
        setErrorMsg(res.message || 'Failed to delete account. Please try again.');
        setShowConfirmModal(false);
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.message || 'Error occurred while deleting account.';
      setErrorMsg(serverMsg);
      setShowConfirmModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const captainName = profile?.name || localStorage.getItem('sathiseller_captain_name') || 'Captain Partner';
  const captainPhone = profile?.phone || localStorage.getItem('sathiseller_captain_phone') || '';
  const walletBal = profile?.walletBalance || 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-16">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#002625] text-white shadow-md px-4 py-3.5 flex items-center justify-between border-b border-[#0b3d3b]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/captain/profile')}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white border border-white/10 transition-all cursor-pointer"
            title="Back to Profile"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black m-0 tracking-tight leading-tight">Delete Partner Account</h1>
            <p className="text-[11px] text-teal-200/80 m-0">Permanent account deactivation & data purge</p>
          </div>
        </div>

        <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
          <Trash2 size={16} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        
        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3.5 flex items-start gap-2.5 text-rose-800 animate-fadeIn shadow-xs">
            <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed flex-1">
              {errorMsg}
            </div>
          </div>
        )}

        {/* Critical Danger Warning Banner */}
        <div className="bg-gradient-to-br from-rose-50 via-white to-orange-50 border-2 border-rose-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2.5 text-rose-700">
            <ShieldAlert size={20} className="text-rose-600 shrink-0" />
            <h2 className="text-sm font-black m-0 tracking-tight">Warning: This action cannot be undone</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium m-0">
            Deleting your Sathi Seller Captain account will permanently remove your driver profile, vehicle documents, and verified partner status from our dispatch system.
          </p>

          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2 text-[11.5px] text-slate-700 font-medium">
              <span className="text-rose-600 font-bold">✕</span>
              <span>All registered KYC documents (Driving License, RC, Aadhaar) will be deleted.</span>
            </div>
            <div className="flex items-start gap-2 text-[11.5px] text-slate-700 font-medium">
              <span className="text-rose-600 font-bold">✕</span>
              <span>You will forfeit active captain ratings ({profile?.ratingAverage?.toFixed(1) || '5.0'} ⭐) and delivery history.</span>
            </div>
            <div className="flex items-start gap-2 text-[11.5px] text-slate-700 font-medium">
              <span className="text-rose-600 font-bold">✕</span>
              <span>You will be immediately logged out of the Captain app and cannot receive delivery requests.</span>
            </div>
          </div>
        </div>

        {/* Current Partner Account Snapshot */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-2xs space-y-3">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 block">
            Target Partner Profile
          </span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#002625] to-[#15803d] flex items-center justify-center text-white text-base font-black shadow-2xs">
                {captainName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 m-0 leading-tight">{captainName}</p>
                <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">{captainPhone}</p>
              </div>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Active Partner
            </span>
          </div>

          {/* Wallet Balance Warning */}
          {walletBal > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-amber-700 shrink-0" />
                <div>
                  <span className="text-xs font-black block leading-tight">Unwithdrawn Wallet Balance</span>
                  <span className="text-[11px] text-amber-800 font-medium">You currently have ₹{walletBal.toFixed(2)} in your wallet</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/captain/wallet')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg border-none cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
              >
                Withdraw Now
              </button>
            </div>
          )}
        </div>

        {/* Reason for Deletion Form */}
        <form onSubmit={handleOpenConfirm} className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-black text-[#002625] uppercase tracking-wider mb-2">
              Reason for Deleting Account <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11.5px] text-slate-500 mb-3 font-medium">
              Please let us know why you are leaving so we can improve our captain partner ecosystem.
            </p>

            <div className="space-y-2">
              {DELETION_REASONS.map((reason, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'border-[#ff5500] bg-orange-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deletionReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-0.5 text-[#ff5500] focus:ring-[#ff5500] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    {reason}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Feedback Notes */}
          <div>
            <label className="block text-xs font-black text-[#002625] mb-1.5">
              Additional Feedback (Optional)
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what could have made your experience better..."
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-all resize-y"
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedCheck}
                onChange={(e) => setConfirmedCheck(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 leading-snug">
                I understand that account deletion is <span className="text-rose-600 font-black underline">permanent and non-recoverable</span>. All my captain partner details and documents will be deleted.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate('/captain/profile')}
              className="w-full sm:w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
            >
              Keep My Account
            </button>
            <button
              type="submit"
              disabled={!selectedReason || !confirmedCheck || isDeleting}
              className="w-full sm:w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-black rounded-xl border-none cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} /> Delete Account
            </button>
          </div>
        </form>

      </main>

      {/* Confirmation Safeguard Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 border-2 border-rose-200 shadow-2xl space-y-4 animate-scaleUp">
            
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 m-0">Final Confirmation</h3>
              <p className="text-xs text-slate-600 font-medium m-0 leading-relaxed">
                Are you absolutely sure you want to permanently delete your Captain account for <b className="text-slate-900">{captainPhone}</b>?
              </p>
            </div>

            <div className="bg-rose-50 rounded-xl p-3 text-[11px] text-rose-800 font-bold leading-relaxed border border-rose-200">
              ⚡ You will not be able to log in or recover any trip logs after this step.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleProceedDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl border-none cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  'Yes, Delete Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CaptainDeleteAccount;

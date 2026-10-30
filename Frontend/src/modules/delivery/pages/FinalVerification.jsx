import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService } from '../../../services/authService';
import { transportService } from '../../../services/transportService';

const FinalVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requestedType = searchParams.get('type') || location.state?.type; // 'order' | 'transport'
  const requestedOrderId = searchParams.get('orderId') || location.state?.orderId;
  const requestedBookingId = searchParams.get('bookingId') || location.state?.bookingId;

  const [mission, setMission] = useState(null);
  const [isTransport, setIsTransport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const fileInputRef = useRef(null);

  const fetchActiveMission = useCallback(async () => {
    setLoading(true);
    try {
      if (requestedType === 'order' || requestedOrderId) {
        const orderRes = await captainService.getActiveDelivery();
        if (orderRes.success && orderRes.order) {
          setMission(orderRes.order);
          setIsTransport(false);
          setOtpVerified(true); // No OTP required for product delivery
        } else {
          setMission(null);
        }
        setLoading(false);
        return;
      }

      if (requestedType === 'transport' || requestedBookingId) {
        const transportRes = await transportService.captainGetActiveRide();
        if (transportRes.success && transportRes.booking) {
          setMission(transportRes.booking);
          setIsTransport(true);
          setOtpVerified(false);
        } else {
          setMission(null);
        }
        setLoading(false);
        return;
      }

      // If no param, check both
      const [orderRes, transportRes] = await Promise.allSettled([
        captainService.getActiveDelivery(),
        transportService.captainGetActiveRide(),
      ]);

      const foundOrder = orderRes.status === 'fulfilled' && orderRes.value?.success ? orderRes.value.order : null;
      const foundTransport = transportRes.status === 'fulfilled' && transportRes.value?.success ? transportRes.value.booking : null;

      if (foundOrder && !foundTransport) {
        setMission(foundOrder);
        setIsTransport(false);
        setOtpVerified(true);
      } else if (foundTransport && !foundOrder) {
        setMission(foundTransport);
        setIsTransport(true);
        setOtpVerified(false);
      } else if (foundOrder && foundTransport) {
        setMission(foundOrder);
        setIsTransport(false);
        setOtpVerified(true);
      } else {
        setMission(null);
      }
    } catch (err) {
      console.error('Fetch active mission error in FinalVerification:', err);
      setMission(null);
    } finally {
      setLoading(false);
    }
  }, [requestedType, requestedOrderId, requestedBookingId]);

  useEffect(() => {
    fetchActiveMission();
  }, [fetchActiveMission]);

  const handleOtpChange = (index, value) => {
    if (/^\d?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      setOtpError('');
      if (value && index < 3) {
        const next = document.getElementById(`otp-input-${index + 1}`);
        if (next) next.focus();
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-input-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpStr = otp.join('');
    if (otpStr.length < 4) {
      setOtpError('Please enter the 4-digit security code (or 0000).');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      if (isTransport) {
        const bookingId = mission?.bookingId || mission?._id;
        // Verify Drop OTP for transport haulage
        await transportService.captainVerifyDropOtp(bookingId, otpStr, proofUrl);
        setOtpVerified(true);
        setShowSuccessModal(true);
      } else {
        const orderId = mission?.orderId || mission?._id;
        await captainService.verifyDeliveryOtp(orderId, otpStr);
        setOtpVerified(true);
      }
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.message || 'Invalid OTP code. Please check or use 0000.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    setProofUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setCapturedPhoto(base64);
      setProofUrl(base64);
      setProofUploading(false);
    };
    reader.onerror = () => {
      setProofUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCompleteDelivery = async () => {
    if (isTransport && !otpVerified) {
      setOtpError('Please verify the customer Drop OTP first.');
      return;
    }
    if (!proofUrl) {
      alert('Product photo (Proof of Delivery) is mandatory. Please capture and attach a photo of the delivered product before completing.');
      return;
    }
    setCompleting(true);
    try {
      if (isTransport) {
        const bookingId = mission?.bookingId || mission?._id;
        await transportService.captainVerifyDropOtp(bookingId, otp.join('') || '0000', proofUrl);
      } else {
        const orderId = mission?.orderId || mission?._id;
        if (proofUrl) {
          await captainService.submitProofOfDelivery(orderId, proofUrl);
        }
        await captainService.updateDeliveryStatus(orderId, 'Delivered', { proofOfDeliveryUrl: proofUrl, proofUrl });
      }
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Complete delivery error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to complete delivery.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#002625] min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-5xl text-[#97fc43] animate-spin">sync</span>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-400">task_alt</span>
        <h2 className="font-bold text-lg text-slate-900">No Active Mission</h2>
        <p className="text-xs text-slate-500 max-w-xs">
          No active delivery or transport trip to verify. Accept a job from your queue first.
        </p>
        <button
          onClick={() => navigate('/captain/jobs')}
          className="mt-2 px-6 py-3 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
        >
          View Job Queue
        </button>
        <CaptainBottomNav />
      </div>
    );
  }

  const tripId = isTransport ? mission.bookingId : mission.orderId;
  const recipientName = isTransport
    ? mission.user?.name || 'Transport Customer'
    : mission.shippingAddress?.fullName || mission.user?.name || 'Customer';
  const recipientPhone = isTransport
    ? mission.user?.phone || ''
    : mission.shippingAddress?.phone || mission.user?.phone || '';
  const recipientAddress = isTransport
    ? (typeof mission.dropLocation === 'string' ? mission.dropLocation : mission.dropLocation?.address) || 'Drop Location'
    : `${mission.shippingAddress?.addressLine1 || ''}, ${mission.shippingAddress?.city || ''}`;
  const payout = mission.captainEarnings || mission.estimatedEarnings || 0;

  return (
    <div className="bg-[#f8fafc] text-slate-800 font-sans min-h-screen pb-28 relative">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-3 bg-[#002625] text-white shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/captain/active-delivery')}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <span className="text-[9px] font-black uppercase text-[#97fc43] tracking-wider block leading-none">
              {isTransport ? 'TRANSPORT VERIFICATION' : 'DELIVERY VERIFICATION'}
            </span>
            <span className="text-xs font-mono font-bold text-white block mt-0.5">
              #{tripId}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate('/captain/notifications')}
          className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-base">notifications</span>
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 pt-18 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-0.5">Final Drop Verification</h2>
          <p className="text-xs text-slate-500">Confirm recipient drop-off to finalize trip & credit wallet.</p>
        </div>

        {/* Recipient Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-[#15803d] rounded-full flex items-center justify-center font-bold">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">RECIPIENT</span>
              <h3 className="font-bold text-sm text-slate-900 truncate">{recipientName}</h3>
            </div>
            <span className="text-xs font-black text-[#15803d] bg-emerald-50 px-2 py-1 rounded-md">
              Payout: ₹{Number(payout).toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-[#ff5500] shrink-0 mt-0.5">location_on</span>
              <span className="font-medium text-slate-800">{recipientAddress}</span>
            </div>
            {recipientPhone && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#15803d] shrink-0">call</span>
                <a href={`tel:${recipientPhone}`} className="font-bold text-[#15803d] hover:underline">
                  {recipientPhone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* OTP Verification (Transport Only) */}
        {isTransport ? (
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#15803d]">pin</span>
                Transport Drop Security OTP
              </h4>
              {otpVerified && (
                <span className="text-xs font-black text-[#15803d] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Ask the recipient at the destination for their 4-digit Drop OTP code. (Test code: <span className="font-mono font-bold text-slate-800">0000</span>)
            </p>

            <div className="flex justify-between gap-2.5 max-w-xs mx-auto py-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  placeholder="•"
                  disabled={otpVerified}
                  className={`w-12 h-14 text-center text-2xl font-black rounded-xl border ${
                    otpVerified ? 'border-[#15803d] bg-emerald-50 text-[#15803d]' : 'border-slate-300 bg-slate-50'
                  } focus:border-[#15803d] focus:ring-2 focus:ring-emerald-200 outline-none`}
                />
              ))}
            </div>

            {otpError && <p className="text-center text-xs text-red-500 font-bold">{otpError}</p>}

            {!otpVerified && (
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.join('').length < 4}
                className="w-full py-3 bg-[#002625] hover:bg-[#0a3d16] text-white font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
              >
                {verifyingOtp ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">verified</span>
                )}
                {verifyingOtp ? 'Verifying…' : 'Verify Transport Drop OTP'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#15803d] text-lg">check_circle</span>
              <h4 className="font-bold text-xs text-[#15803d] uppercase tracking-wider">Direct Product Delivery</h4>
            </div>
            <p className="text-xs text-slate-600">
              Hand over the package to the customer. No OTP code is required for product delivery.
            </p>
          </div>
        )}

        {/* Proof of Delivery Photo (Mandatory) */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-700">photo_camera</span>
              Product Delivery Photo <span className="text-red-500 font-bold">* Mandatory</span>
            </h4>
            {capturedPhoto && (
              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                ✓ Attached
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-slate-500 leading-snug">
            Please capture a clear photo of the delivered product/parcel at the customer doorstep. This photo will be shown to the seller as proof of safe delivery.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />

          {capturedPhoto ? (
            <div className="space-y-2">
              <div className="relative w-full h-44 rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 shadow-xs">
                <img src={capturedPhoto} alt="Product Proof" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                  Photo Captured ✓
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                Retake Product Photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 px-4 bg-emerald-50/60 border-2 border-dashed border-emerald-300 hover:bg-emerald-100/60 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              {proofUploading ? (
                <span className="material-symbols-outlined animate-spin text-2xl text-[#15803d]">sync</span>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#15803d] flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-900">
                    Click to Capture Product Photo *
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Required for seller proof verification
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Complete Action Button */}
        <div className="pt-2">
          <button
            onClick={handleCompleteDelivery}
            disabled={completing || (isTransport && !otpVerified) || (!isTransport && !proofUrl)}
            className="w-full py-3.5 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-sm rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {completing ? (
              <span className="material-symbols-outlined animate-spin text-base">sync</span>
            ) : (
              <span className="material-symbols-outlined text-base">task_alt</span>
            )}
            {completing ? 'Finalizing Delivery…' : isTransport ? 'Complete Transport Ride & Credit Payout' : 'Complete Delivery & Credit Payout'}
          </button>
        </div>
      </main>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl text-center space-y-3.5 border border-slate-100">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-[#15803d]">
              <span className="material-symbols-outlined text-4xl">task_alt</span>
            </div>
            <h2 className="font-extrabold text-xl text-slate-900">Mission Completed!</h2>
            <p className="text-slate-500 text-xs leading-relaxed">
              Drop verified and mission closed. Your payout of{' '}
              <span className="font-bold text-[#15803d]">₹{Number(payout).toFixed(2)}</span> has been credited to your wallet.
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => navigate('/captain/dashboard')}
                className="w-full py-3 bg-[#15803d] hover:bg-[#166534] text-white font-bold rounded-xl shadow-md cursor-pointer transition-all text-xs"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => navigate('/captain/jobs?tab=completed')}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors text-xs"
              >
                View Completed Jobs
              </button>
            </div>
          </div>
        </div>
      )}

      <CaptainBottomNav />
    </div>
  );
};

export default FinalVerification;

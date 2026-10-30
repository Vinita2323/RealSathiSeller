import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, Edit2, Loader2 } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';
import {
  USER_LOGIN_DRAFT_KEY,
  clearLoginDraft,
  writeLoginDraft,
} from '../../../utils/loginFormDraft';

const VerifyOtp = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();

  const { syncWishlistWithServer } = useWishlist();
  const { fetchCart, addToCart } = useCart();
  const { syncAuthFromStorage } = useAuth();

  const phone = location.state?.phone || '+91 9876543210';

  const goEditPhone = () => {
    const hasRealPhone = Boolean(phone && phone !== '+91 9876543210');
    if (hasRealPhone) {
      writeLoginDraft(USER_LOGIN_DRAFT_KEY, { phoneNumber: phone });
      navigate('/login', { state: { phone } });
      return;
    }
    navigate('/login');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) return;

    try {
      setLoading(true);
      await authService.verifyUserOtp(phone, enteredOtp);
      clearLoginDraft(USER_LOGIN_DRAFT_KEY);
      syncAuthFromStorage();

      // 1. Sync guest wishlist to backend database
      await syncWishlistWithServer();

      // 2. Fetch server cart
      await fetchCart();

      // 3. Handle pending actions
      const pendingRaw = localStorage.getItem('sathiseller_pending_action');
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          localStorage.removeItem('sathiseller_pending_action');

          if (pending.type === 'ADD_TO_CART' && pending.product) {
            await addToCart(pending.product, pending.quantity || 1);
            navigate(pending.returnUrl || '/cart', { replace: true });
            return;
          } else if (pending.type === 'BUY_NOW' && pending.product) {
            await addToCart(pending.product, pending.quantity || 1);
            navigate('/checkout', { replace: true });
            return;
          } else if (pending.type === 'CHECKOUT') {
            navigate('/checkout', { replace: true });
            return;
          }
        } catch (pErr) {
          console.error('Error handling pending action:', pErr);
        }
      }

      // Check expired redirect
      const expRedir = sessionStorage.getItem('sathiseller_auth_expired_redirect');
      if (expRedir) {
        sessionStorage.removeItem('sathiseller_auth_expired_redirect');
        navigate(expRedir, { replace: true });
        return;
      }

      // replace: true removes /verify-otp from history so add-address back cannot reopen OTP
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setErrorMsg('');
      await authService.sendUserOtp(phone);
      alert('OTP has been resent to your phone.');
    } catch (err) {
      setErrorMsg('Failed to resend OTP.');
    }
  };

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input if digit entered
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs.current[index - 1].focus();
    }
  };

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-[#fdf2ec] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#ffedd5] via-[#ffedd5] to-[#f97316]/20 font-sans text-slate-800 relative w-full flex flex-col md:items-center md:justify-center p-4 md:py-12 md:px-4 overflow-hidden">
      
      {/* Background Blurs */}
      <div className="absolute -left-[100px] top-[20%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#f97316] rounded-full mix-blend-multiply filter blur-[60px] md:blur-[100px] opacity-[0.15]"></div>
      <div className="absolute -right-[100px] bottom-[10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#ea580c] rounded-full mix-blend-multiply filter blur-[60px] md:blur-[100px] opacity-[0.15]"></div>

      {/* Main Card */}
      <div className="w-full max-w-[480px] md:max-w-md mx-auto flex-1 md:flex-initial bg-white rounded-2xl md:rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] md:shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-slate-100 relative z-10 p-5 md:p-8 flex flex-col justify-between overflow-y-auto md:overflow-visible [&::-webkit-scrollbar]:hidden">
        
        <div>
          {/* Header Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={goEditPhone}
              className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
            >
              <ArrowLeft size={18} />
            </button>
            <img src="/Logo.png" alt="Sathi Seller" className="h-20 max-w-[180px] object-contain my-1" />
            <div className="w-10"></div> {/* Spacer */}
          </div>

          {/* Title & Sent-to Phone Banner */}
          <div className="text-center my-4">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 text-[#ea580c]">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-[22px] font-extrabold text-[#0f172a] mb-1 tracking-tight">Verify Code</h1>
            <p className="text-[13px] text-slate-500 font-medium">We sent a 6-digit OTP code to</p>
            <div className="inline-flex items-center gap-1.5 bg-orange-50 text-[#ea580c] font-bold text-[13px] px-3 py-1 rounded-full mt-1 border border-orange-100">
              <span>{phone}</span>
              <button 
                type="button"
                onClick={goEditPhone} 
                className="text-[#ea580c] hover:opacity-80 cursor-pointer"
                title="Edit Phone Number"
              >
                <Edit2 size={12} />
              </button>
            </div>
          </div>

          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2">
                <label className="text-[12px] font-extrabold text-[#0f172a]">Enter 6-Digit OTP</label>
                <span className="text-[11px] font-bold text-[#ea580c] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  Mock OTP: 123456
                </span>
              </div>
              <div className="flex justify-between gap-2 w-full">
                {otp.map((digit, index) => (
                  <input 
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text" 
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="flex-1 min-w-0 aspect-square max-h-[54px] rounded-[10px] border border-slate-200 text-center text-[#0f172a] text-[20px] font-semibold outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-orange-100 transition-all bg-white shadow-sm"
                  />
                ))}
              </div>
              {errorMsg && <p className="text-xs text-red-500 font-semibold text-center mt-1">{errorMsg}</p>}
            </div>

            {/* Resend OTP */}
            <div className="flex justify-center text-[13px] text-slate-500 font-medium">
              Didn't receive the code?{' '}
              <button 
                type="button"
                onClick={handleResendOtp}
                className="bg-transparent border-none text-[#ea580c] font-bold ml-1 cursor-pointer hover:underline"
              >
                Resend OTP
              </button>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={otp.join('').length < 6 || loading}
              className="w-full bg-gradient-to-r from-[#f97316] to-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed text-white border-none rounded-[12px] py-3.5 px-5 text-[14px] font-bold tracking-wide cursor-pointer shadow-[0_6px_16px_rgba(234,88,12,0.25)] transition-transform duration-200 active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  Verify & Log In
                  <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-center text-slate-400 font-normal mt-6">
          Having trouble? Contact Sathi Seller Support.
        </p>

      </div>
    </div>
  );
};

export default VerifyOtp;

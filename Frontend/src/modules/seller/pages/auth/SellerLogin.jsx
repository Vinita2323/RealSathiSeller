import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Phone, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react';
import { authService } from '../../../../services/authService';
import { useAuth } from '../../../../context/AuthContext';
import {
  SELLER_LOGIN_DRAFT_KEY,
  clearLoginDraft,
  readLoginDraft,
  writeLoginDraft,
} from '../../../../utils/loginFormDraft';

const SellerLogin = () => {
  const navigate = useNavigate();
  const { syncAuthFromStorage } = useAuth();
  const savedDraft = readLoginDraft(SELLER_LOGIN_DRAFT_KEY) || {};
  const [mobileNumber, setMobileNumber] = useState(savedDraft.mobileNumber || '');
  const [password, setPassword] = useState(savedDraft.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Mode: 'login' | 'forgot_password'
  const [authMode, setAuthMode] = useState(savedDraft.authMode || 'login');
  const [forgotStep, setForgotStep] = useState(savedDraft.forgotStep || 1); // 1 = enter phone & send OTP, 2 = enter OTP & new password
  const [forgotPhone, setForgotPhone] = useState(savedDraft.forgotPhone || '');
  const [otpCode, setOtpCode] = useState(savedDraft.otpCode || '');
  const [newPassword, setNewPassword] = useState(savedDraft.newPassword || '');
  const [confirmPassword, setConfirmPassword] = useState(savedDraft.confirmPassword || '');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Keep login details when user opens Terms / Privacy in the same tab
  useEffect(() => {
    writeLoginDraft(SELLER_LOGIN_DRAFT_KEY, {
      mobileNumber,
      password,
      authMode,
      forgotStep,
      forgotPhone,
      otpCode,
      newPassword,
      confirmPassword,
    });
  }, [mobileNumber, password, authMode, forgotStep, forgotPhone, otpCode, newPassword, confirmPassword]);

  const startResendCountdown = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      const res = await authService.sellerLogin(cleanPhone, password);

      if (res.success && res.token) {
        clearLoginDraft(SELLER_LOGIN_DRAFT_KEY);
        syncAuthFromStorage();
        navigate('/seller/dashboard');
      } else if (res.requiresPasswordSetup) {
        // Existing seller with no password set
        setForgotPhone(cleanPhone);
        setAuthMode('forgot_password');
        setForgotStep(1);
        setErrorMsg(res.message || 'Password not set for this account yet. Please verify OTP to create a password.');
      } else {
        setErrorMsg(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      const status = err.response?.data?.accountStatus || err.response?.data?.status;

      if (err.response?.data?.requiresPasswordSetup) {
        setForgotPhone(cleanPhone);
        setAuthMode('forgot_password');
        setForgotStep(1);
        setErrorMsg(serverMsg);
      } else if (status === 'under_review' || serverMsg.toLowerCase().includes('under review')) {
        setErrorMsg('Your account is currently under review by the admin team. Once approved, you will be able to log in.');
      } else if (status === 'rejected' || serverMsg.toLowerCase().includes('rejected')) {
        setErrorMsg('Your seller application has been rejected by the admin. Please contact support.');
      } else if (status === 'suspended' || serverMsg.toLowerCase().includes('suspended')) {
        setErrorMsg('Your seller account has been suspended. Please contact support.');
      } else if (status === 'pending_otp' || serverMsg.toLowerCase().includes('otp')) {
        setErrorMsg('Your mobile number verification is pending. Please complete your registration.');
      } else {
        setErrorMsg(serverMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPhone = forgotPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      const res = await authService.sendSellerOtp(cleanPhone, { purpose: 'reset' });
      if (res.success) {
        setSuccessMsg(res.message || 'OTP sent successfully to your mobile number.');
        setForgotStep(2);
        startResendCountdown();
      } else {
        setErrorMsg(res.message || 'This mobile number is not registered. Please register first.');
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message
        || err.message
        || 'This mobile number is not registered. Please register first.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPhone = forgotPhone.replace(/\D/g, '').slice(-10);
    const cleanOtp = otpCode.trim();

    if (cleanOtp.length < 4) {
      setErrorMsg('Please enter the OTP sent to your phone');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      const res = await authService.sellerResetPassword(cleanPhone, cleanOtp, newPassword);

      if (res.success) {
        if (res.token) {
          // Approved seller: directly logged in
          clearLoginDraft(SELLER_LOGIN_DRAFT_KEY);
          syncAuthFromStorage();
          setSuccessMsg('Password set successfully! Redirecting to dashboard...');
          setTimeout(() => {
            navigate('/seller/dashboard');
          }, 1200);
        } else {
          // Account is under review
          setSuccessMsg(res.message || 'Password set successfully. Your account is currently under review by admin.');
          setTimeout(() => {
            setAuthMode('login');
            setForgotStep(1);
          }, 3000);
        }
      } else {
        setErrorMsg(res.message || 'Failed to set password. Please check OTP and try again.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Main Single Card Box */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.05)] border border-slate-200 p-8 space-y-6">
        
        {/* Card Header with Logo, Title, and Subtitle */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src="/Logo.png" alt="Sathi Seller Logo" className="h-14 w-auto object-contain" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight pt-1">
            {authMode === 'login' ? 'Seller Portal Login' : 'Set / Reset Password'}
          </h2>
          <p className="text-sm font-normal text-slate-500 max-w-xs mx-auto">
            {authMode === 'login'
              ? 'Log in with your registered mobile number and password'
              : 'Verify your registered mobile number via OTP to set your password'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {authMode === 'login' && (
          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Mobile Number */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Mobile Number</label>
              <div className="flex rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#ff7526] transition-all">
                <div className="bg-slate-50 px-3.5 flex items-center border-r border-slate-200 text-slate-600 text-sm font-medium select-none">
                  +91
                </div>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  className="block w-full px-3.5 py-2.5 bg-white placeholder-slate-400 text-slate-900 outline-none text-sm font-normal"
                  placeholder="Enter 10-digit mobile number"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPhone(mobileNumber);
                    setAuthMode('forgot_password');
                    setForgotStep(1);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs font-medium text-[#ff7526] hover:underline bg-transparent border-none cursor-pointer p-0"
                >
                  Forgot / Set Password?
                </button>
              </div>
              <div className="relative rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#ff7526] transition-all flex items-center">
                <div className="pl-3.5 text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 bg-white placeholder-slate-400 text-slate-900 outline-none text-sm font-normal pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || mobileNumber.length < 10 || !password}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-medium text-white bg-[#ff7526] hover:bg-[#e65507] focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Logging in...
                </>
              ) : (
                <>
                  Log In to Seller Portal
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        )}

        {/* FORGOT / SET PASSWORD FORM */}
        {authMode === 'forgot_password' && (
          <div className="space-y-4">
            {forgotStep === 1 ? (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                  Enter your registered mobile number to receive a one-time OTP and create or reset your password.
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Registered Mobile Number</label>
                  <div className="flex rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#ff7526] transition-all">
                    <div className="bg-slate-50 px-3.5 flex items-center border-r border-slate-200 text-slate-600 text-sm font-medium select-none">
                      +91
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                      className="block w-full px-3.5 py-2.5 bg-white placeholder-slate-400 text-slate-900 outline-none text-sm font-normal"
                      placeholder="Enter 10-digit mobile number"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || forgotPhone.length < 10}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-medium text-white bg-[#ff7526] hover:bg-[#e65507] focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Sending OTP...
                    </>
                  ) : (
                    <>
                      Send Verification OTP
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">6-Digit OTP</label>
                    <span className="text-[11px] font-bold text-[#ff7526] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      Mock OTP: 123456
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 text-center tracking-widest font-mono text-lg outline-none focus:border-[#ff7526] transition-all"
                    placeholder="• • • • • •"
                  />
                  <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                    <span>Sent to +91 {forgotPhone}</span>
                    <button
                      type="button"
                      disabled={resendTimer > 0 || loading}
                      onClick={handleSendForgotOtp}
                      className="text-[#ff7526] hover:underline disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer p-0"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#ff7526] transition-all flex items-center">
                    <div className="pl-3.5 text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white placeholder-slate-400 text-slate-900 outline-none text-sm font-normal pr-10"
                      placeholder="Enter new password (min 6 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
                  <div className="relative rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#ff7526] transition-all flex items-center">
                    <div className="pl-3.5 text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white placeholder-slate-400 text-slate-900 outline-none text-sm font-normal pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 4 || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-medium text-white bg-[#ff7526] hover:bg-[#e65507] focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Updating Password...
                    </>
                  ) : (
                    <>
                      Set Password & Proceed
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setForgotStep(1);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-transparent border-none cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Seller Login
              </button>
            </div>
          </div>
        )}

        {/* New to Sathi Seller Register Callout */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-slate-400 font-normal">New to Sathi Seller?</span>
          </div>

          <Link
            to="/seller/register"
            className="w-full flex justify-center py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors text-center no-underline"
          >
            Apply for Seller Account
          </Link>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed m-0 pt-1">
            By accessing the portal, you agree to our{' '}
            <Link to="/seller/terms" className="text-[#ff7526] hover:underline font-medium">
              Terms of Service
            </Link>{' '}
            &{' '}
            <Link to="/seller/privacy" className="text-[#ff7526] hover:underline font-medium">
              Privacy Policy
            </Link>
          </p>
        </div>

      </div>

    </div>
  );
};

export default SellerLogin;


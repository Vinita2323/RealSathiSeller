import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';
import {
  CAPTAIN_LOGIN_DRAFT_KEY,
  clearLoginDraft,
  readLoginDraft,
  writeLoginDraft,
} from '../../../utils/loginFormDraft';

const CaptainLogin = () => {
  const navigate = useNavigate();
  const { syncAuthFromStorage } = useAuth();
  const savedDraft = readLoginDraft(CAPTAIN_LOGIN_DRAFT_KEY) || {};
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

  // Keep login details when user opens Privacy / Terms in the same tab
  useEffect(() => {
    writeLoginDraft(CAPTAIN_LOGIN_DRAFT_KEY, {
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
      const res = await authService.captainLogin(cleanPhone, password);

      if (res.success && res.token) {
        clearLoginDraft(CAPTAIN_LOGIN_DRAFT_KEY);
        syncAuthFromStorage();
        /* Temporarily commented out: Captain Membership redirect
        if (res.requiresMembership) {
          navigate('/captain/membership');
        } else {
          navigate('/captain/dashboard');
        }
        */
        navigate('/captain/dashboard');
      } else if (res.requiresPasswordSetup) {
        // Existing captain with no password set
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
        setErrorMsg('Your Captain account is currently under review by the admin team. Once approved, you will be able to log in.');
      } else if (status === 'rejected' || serverMsg.toLowerCase().includes('rejected')) {
        setErrorMsg('Your Captain registration has been rejected by the admin. Please contact support.');
      } else if (status === 'suspended' || serverMsg.toLowerCase().includes('suspended')) {
        setErrorMsg('Your Captain account is currently suspended. Please contact support.');
      } else if (status === 'pending_otp' || serverMsg.toLowerCase().includes('otp')) {
        setErrorMsg('Your mobile verification is pending. Please complete your registration OTP verification.');
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
      const res = await authService.sendCaptainOtp(cleanPhone, { purpose: 'reset' });
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
      const res = await authService.captainResetPassword(cleanPhone, cleanOtp, newPassword);

      if (res.success) {
        if (res.token) {
          // Approved captain: directly logged in
          clearLoginDraft(CAPTAIN_LOGIN_DRAFT_KEY);
          syncAuthFromStorage();
          setSuccessMsg('Password set successfully! Redirecting to Captain dashboard...');
          setTimeout(() => {
            navigate('/captain/dashboard');
          }, 1200);
        } else {
          // Account is under review
          setSuccessMsg(res.message || 'Password set successfully. Your application is currently under review by admin.');
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
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden bg-slate-50 font-sans">
      {/* Background Atmospheric Element */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#15803d 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      ></div>
      
      {/* Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#97fc43]/20 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#15803d]/10 blur-[100px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-20 relative z-10 items-center">
        
        {/* Left Side Branding */}
        <div className="hidden md:flex flex-col justify-center space-y-6">
          <img src="/DeliveryLogo.png" alt="Sathi Seller Logo" className="h-20 w-auto object-contain self-start" />
          <h1 className="text-4xl lg:text-6xl font-extrabold text-[#002625] tracking-tight leading-tight">
            Captain <br />
            <span className="text-[#15803d]">Command Center.</span>
          </h1>
          <p className="text-slate-600 text-lg max-w-md">
            Your premium gateway to real-time logistics, route intelligence, and instant payouts.
          </p>
          
          {/* Quick Stats */}
          <div className="flex gap-8 pt-6">
             <div className="space-y-1">
                <p className="text-[#15803d] font-bold text-2xl">24/7</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Dispatch Support</p>
             </div>
             <div className="space-y-1">
                <p className="text-[#15803d] font-bold text-2xl">Live</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Route Sync</p>
             </div>
          </div>
        </div>

        {/* Login Form Column */}
        <div className="flex flex-col justify-center max-w-md mx-auto w-full md:max-w-none">
          <div className="bg-white p-8 sm:p-10 rounded-2xl w-full border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            
            {/* Mobile Logo */}
            <div className="md:hidden flex justify-center mb-6">
               <img src="/DeliveryLogo.png" alt="Sathi Seller Logo" className="h-16 w-auto object-contain" />
            </div>

            <div className="mb-6 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold text-[#002625] mb-1">
                {authMode === 'login' ? 'Captain Login' : 'Set / Reset Password'}
              </h2>
              <p className="text-slate-500 text-sm">
                {authMode === 'login'
                  ? 'Log in with your registered mobile number and password'
                  : 'Verify your mobile number via OTP to set or reset your password'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">
                    Mobile Number
                  </label>
                  <div className="flex rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#15803d] transition-all">
                    <div className="bg-slate-50 px-3.5 flex items-center border-r border-slate-200 text-slate-600 text-sm font-medium select-none">
                      +91
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 10-digit mobile number"
                      className="block w-full px-3.5 py-3 bg-white placeholder-slate-400 text-slate-900 outline-none text-xs sm:text-sm font-normal"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 ml-1">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPhone(mobileNumber);
                        setAuthMode('forgot_password');
                        setForgotStep(1);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs font-bold text-[#15803d] hover:underline bg-transparent border-none cursor-pointer p-0"
                    >
                      Forgot / Set Password?
                    </button>
                  </div>
                  <div className="relative rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#15803d] transition-all flex items-center">
                    <div className="pl-3.5 text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="block w-full px-3 py-3 bg-white placeholder-slate-400 text-slate-900 outline-none text-xs sm:text-sm font-normal pr-10"
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
                  className="w-full mt-2 py-3.5 rounded-xl shadow-md transition-all duration-300 transform active:scale-98 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm cursor-pointer border-none text-[#002625] bg-[#97fc43] hover:bg-[#86e835] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Logging in...
                    </>
                  ) : (
                    <>
                      Log In to Captain Portal
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
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                      Enter your registered mobile number to receive a one-time OTP to set or reset your password.
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">
                        Registered Mobile Number
                      </label>
                      <div className="flex rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#15803d] transition-all">
                        <div className="bg-slate-50 px-3.5 flex items-center border-r border-slate-200 text-slate-600 text-sm font-medium select-none">
                          +91
                        </div>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={forgotPhone}
                          onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 10-digit mobile number"
                          className="block w-full px-3.5 py-3 bg-white placeholder-slate-400 text-slate-900 outline-none text-xs sm:text-sm font-normal"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || forgotPhone.length < 10}
                      className="w-full mt-2 py-3.5 rounded-xl shadow-md transition-all duration-300 transform active:scale-98 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm cursor-pointer border-none text-[#002625] bg-[#97fc43] hover:bg-[#86e835] disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <label className="text-xs font-bold text-slate-700 ml-1">6-Digit OTP</label>
                        <span className="text-[11px] font-bold text-[#15803d] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Mock OTP: 123456
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="block w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 text-center tracking-widest font-mono text-lg outline-none focus:border-[#15803d] transition-all"
                        placeholder="• • • • • •"
                      />
                      <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                        <span>Sent to +91 {forgotPhone}</span>
                        <button
                          type="button"
                          disabled={resendTimer > 0 || loading}
                          onClick={handleSendForgotOtp}
                          className="text-[#15803d] font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer p-0"
                        >
                          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">New Password</label>
                      <div className="relative rounded-xl border border-slate-200 shadow-2xs overflow-hidden focus-within:border-[#15803d] transition-all flex items-center">
                        <div className="pl-3.5 text-slate-400">
                          <Lock size={16} />
                        </div>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 6 characters)"
                          className="block w-full px-3 py-3 bg-white placeholder-slate-400 text-slate-900 outline-none text-xs sm:text-sm font-normal pr-10"
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
                      <label className="text-xs font-bold text-slate-700 ml-1">Confirm Password</label>
                      <div className="relative rounded-xl border border-slate-200 shadow-2xs focus-within:border-[#15803d] transition-all flex items-center">
                        <div className="pl-3.5 text-slate-400">
                          <Lock size={16} />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="block w-full px-3 py-3 bg-white placeholder-slate-400 text-slate-900 outline-none text-xs sm:text-sm font-normal pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 z-10 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 4 || newPassword.length < 6 || newPassword !== confirmPassword}
                      className="w-full mt-2 py-3.5 rounded-xl shadow-md transition-all duration-300 transform active:scale-98 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm cursor-pointer border-none text-[#002625] bg-[#97fc43] hover:bg-[#86e835] disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <ArrowLeft size={14} /> Back to Captain Login
                  </button>
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                New Captain?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/captain/register')}
                  className="text-[#15803d] hover:underline font-bold cursor-pointer bg-transparent border-none"
                >
                  Apply / Register Here
                </button>
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed m-0">
                By continuing, you agree to our{' '}
                <button 
                  type="button" 
                  onClick={() => navigate('/captain/privacy')} 
                  className="text-[#15803d] hover:underline font-semibold bg-transparent border-none p-0 cursor-pointer text-[11px]"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CaptainLogin;


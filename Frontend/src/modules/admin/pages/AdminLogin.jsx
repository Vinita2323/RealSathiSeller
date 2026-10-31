import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const { syncAuthFromStorage, setAdminSessionValid } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(true);

  // Ensure fields start completely blank and prevent browser autofill
  useEffect(() => {
    setEmail('');
    setPassword('');
    const timer = setTimeout(() => {
      setIsReadOnly(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Validate any existing remembered/session cookie before showing the form.
  useEffect(() => {
    let cancelled = false;
    const validateExistingSession = async () => {
      try {
        const res = await authService.getAdminProfile();
        if (!cancelled && res?.success && res.admin) {
          setAdminSessionValid?.(true);
          syncAuthFromStorage('admin');
          navigate('/admin', { replace: true });
          return;
        }
      } catch (e) {
        localStorage.removeItem('sathiseller_admin_token');
        localStorage.removeItem('sathiseller_admin_session');
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };
    validateExistingSession();
    return () => {
      cancelled = true;
    };
  }, [navigate, setAdminSessionValid, syncAuthFromStorage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both admin email and password');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      const res = await authService.adminLogin(email.trim(), password, rememberMe);
      if (!res?.success) {
        throw new Error(res?.message || 'Invalid email or password');
      }
      setPassword('');
      setAdminSessionValid?.(true);
      syncAuthFromStorage('admin');
      setLoading(false);
      navigate('/admin', { replace: true });
    } catch (err) {
      setLoading(false);
      setAdminSessionValid?.(false);
      setErrorMsg(err.response?.data?.message || err.message || 'Invalid email or password');
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#002625] flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-[#ff5500]" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#002625] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#ff5500]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#001a19] border border-[#0d4a48] rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-md mb-2">
            <img src="/Logo.png" alt="Sathi Seller Logo" className="h-10 object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck size={20} className="text-[#ff5500]" />
            <h1 className="text-xl font-bold text-white tracking-tight">Super Admin Portal</h1>
          </div>
          <p className="text-xs text-teal-300/70">Enter your credentials to access the system panel</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold p-3 rounded-xl text-center flex items-center justify-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" autoComplete="off">
          {/* Hidden dummy fields to prevent aggressive browser autofill */}
          <input
            type="text"
            name="fake_user_prevent_autofill"
            autoComplete="off"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none', zIndex: -1 }}
            tabIndex={-1}
            aria-hidden="true"
          />
          <input
            type="password"
            name="fake_pass_prevent_autofill"
            autoComplete="off"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none', zIndex: -1 }}
            tabIndex={-1}
            aria-hidden="true"
          />

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Admin Email</label>
            <div className="relative">
              <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-300/60 pointer-events-none" />
              <input
                type="email"
                name="admin_login_email"
                required
                autoComplete="off"
                readOnly={isReadOnly}
                onFocus={() => setIsReadOnly(false)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter admin email"
                className="w-full bg-[#002625] border border-[#0d4a48] focus:border-[#ff5500] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-teal-300/40 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Password</label>
            <div className="relative">
              <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-300/60 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="admin_login_password"
                required
                autoComplete="new-password"
                readOnly={isReadOnly}
                onFocus={() => setIsReadOnly(false)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-[#002625] border border-[#0d4a48] focus:border-[#ff5500] rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-teal-300/40 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-300/70 hover:text-white bg-transparent border-none cursor-pointer p-1 rounded-md transition-colors"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[#0d4a48] bg-[#002625] text-[#ff5500] focus:ring-[#ff5500] cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-300">
              Remember me for 30 days
            </span>
          </label>
          <p className="text-[10px] text-teal-300/50 -mt-2 leading-relaxed">
            Remember me only extends a verified login session. It never grants access without valid credentials.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff5500] hover:bg-[#e04a00] text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 border-none cursor-pointer shadow-lg shadow-[#ff5500]/20 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Admin Panel</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#0d4a48]/50">
          <p className="text-[11px] text-teal-300/50 font-mono">Sathi Seller Secure Gateway v2.4</p>
        </div>
      </div>
    </div>
  );
};

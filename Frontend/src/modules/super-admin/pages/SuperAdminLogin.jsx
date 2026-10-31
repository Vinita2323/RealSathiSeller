import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '../context/SuperAdminContext';
import { superAdminService } from '../../../services/superAdminService';
import { useAuth } from '../../../context/AuthContext';
import { Lock, Mail, ArrowRight, Building2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const { login } = useSuperAdmin();
  const { setSuperAdminSessionValid } = useAuth() || {};

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
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

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      try {
        const res = await superAdminService.getProfile();
        if (!cancelled && res?.success && res.superAdmin) {
          login(res.superAdmin);
          setSuperAdminSessionValid?.(true);
          navigate('/super-admin/dashboard', { replace: true });
          return;
        }
      } catch (e) {
        localStorage.removeItem('sathiseller_super_admin_token');
        localStorage.removeItem('sathiseller_super_admin_session');
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };
    validate();
    return () => {
      cancelled = true;
    };
    // Run once on mount to resume a valid cookie session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await superAdminService.login({
        email: email.trim(),
        password,
        rememberMe: Boolean(rememberMe),
      });
      if (res.success && res.superAdmin) {
        setPassword('');
        login(res.superAdmin);
        setSuperAdminSessionValid?.(true);
        navigate('/super-admin/dashboard');
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to connect to Super Admin authentication service'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#001c1b] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#ff5500]" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#001c1b] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#ff5500]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-3">
        <div className="inline-flex p-3.5 rounded-2xl bg-[#002625] border border-teal-800/60 shadow-2xl text-[#ff5500]">
          <Building2 size={36} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Super Admin Treasury
        </h2>
        <p className="text-xs sm:text-sm text-teal-200/80 font-medium max-w-sm mx-auto">
          Central financial control, transaction ledgers, seller & captain payouts, and platform settlements.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200 py-8 px-6 sm:px-10 rounded-3xl shadow-2xl shadow-black/50 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Super Admin Email
              </label>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  name="super_admin_email"
                  required
                  autoComplete="off"
                  readOnly={isReadOnly}
                  onFocus={() => setIsReadOnly(false)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter super admin email"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#002625] focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="super_admin_password"
                  required
                  autoComplete="new-password"
                  readOnly={isReadOnly}
                  onFocus={() => setIsReadOnly(false)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#002625] focus:bg-white rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#ff5500] focus:ring-[#ff5500] cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-600">Remember me for 30 days</span>
            </label>
            <p className="text-[10px] text-slate-400 -mt-2 leading-relaxed">
              Remember me only extends a verified login session. It never grants access without valid credentials.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 border-none cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Treasury Access</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

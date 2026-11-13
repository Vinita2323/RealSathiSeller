import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Loader2 } from 'lucide-react';
import repairService, { repairErrorMessage } from '../../../services/repairService';

const TechnicianLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await repairService.technician.login(phone.replace(/\D/g, '').slice(-10), password);
      if (res?.success && res.token) {
        localStorage.setItem('sathiseller_technician_token', res.token);
        localStorage.setItem('sathiseller_technician_data', JSON.stringify(res.technician || {}));
        navigate('/technician/jobs', { replace: true });
      }
    } catch (err) {
      setError(repairErrorMessage(err, 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 font-sans">
      <form onSubmit={submit} autoComplete="off" className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center"><Wrench size={22} /></div>
          <div>
            <h1 className="text-[17px] font-extrabold text-[#1e1b4b] m-0">Technician Login</h1>
            <p className="text-[11px] text-slate-400 m-0">Repair & Services panel</p>
          </div>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          autoComplete="off"
          className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-[14px] outline-none focus:border-[#ff5500]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-[14px] outline-none focus:border-[#ff5500]"
        />
        {error && <p className="text-[12px] font-bold text-rose-600 m-0">{error}</p>}
        <button
          type="submit"
          disabled={loading || phone.length !== 10 || !password}
          className="w-full py-3 rounded-xl bg-[#ff5500] text-white text-[14px] font-extrabold border-none cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />} Login
        </button>
      </form>
    </div>
  );
};

export default TechnicianLogin;

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronRight, Loader2 } from 'lucide-react';
import repairService, { repairErrorMessage } from '../../../services/repairService';
import { RepairStatusChip, RepairPageHeader, formatDateTime } from '../../../components/repair/RepairUi';

const TechnicianJobs = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await repairService.technician.getJobs(tab);
      setJobs(res?.bookings || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('sathiseller_technician_token');
        navigate('/technician/login', { replace: true });
        return;
      }
      setError(repairErrorMessage(err, 'Could not load jobs.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab, navigate]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(true); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const logout = () => {
    localStorage.removeItem('sathiseller_technician_token');
    localStorage.removeItem('sathiseller_technician_data');
    navigate('/technician/login', { replace: true });
  };

  let name = 'Technician';
  try { name = JSON.parse(localStorage.getItem('sathiseller_technician_data') || '{}').name || name; } catch { /* ignore */ }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans w-full max-w-[480px] md:max-w-3xl mx-auto pb-10">
      <RepairPageHeader
        title="Repair Jobs"
        subtitle={name}
        right={
          <button type="button" onClick={logout} className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 cursor-pointer" aria-label="Logout">
            <LogOut size={16} />
          </button>
        }
      />
      <div className="px-4 pt-4 space-y-3">
        <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
          {[['active', 'Active'], ['completed', 'Completed']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${tab === id ? 'bg-[#ff5500] text-white' : 'bg-transparent text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p className="text-[12px] font-bold text-rose-600 m-0">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#ff5500]" /></div>
        ) : jobs.length === 0 ? (
          <p className="text-[12px] text-slate-400 text-center py-10 m-0">{tab === 'active' ? 'No repair jobs assigned to you.' : 'No completed jobs yet.'}</p>
        ) : (
          jobs.map((j) => (
            <button
              key={j._id}
              type="button"
              onClick={() => navigate(`/technician/jobs/${j._id}`)}
              className="w-full text-left bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-orange-200"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-extrabold text-[#1e1b4b] m-0 truncate">{j.brand} {j.model} · {j.categoryName}</p>
                <p className="text-[11px] text-slate-500 m-0 truncate">{j.problem}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <RepairStatusChip status={j.status} />
                  <span className="text-[10px] font-semibold text-slate-400">#{j.bookingId} · {formatDateTime(j.updatedAt)}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default TechnicianJobs;

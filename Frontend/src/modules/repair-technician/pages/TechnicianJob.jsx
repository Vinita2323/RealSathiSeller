import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Camera, X, Loader2 } from 'lucide-react';
import repairService, { repairErrorMessage } from '../../../services/repairService';
import { RepairStatusChip, RepairPageHeader, formatRupees } from '../../../components/repair/RepairUi';

const TechnicianJob = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const [findings, setFindings] = useState('');
  const [photos, setPhotos] = useState([]);
  const [items, setItems] = useState([{ label: 'Labour', amount: '' }]);
  const [estimatedDays, setEstimatedDays] = useState('');
  const [notes, setNotes] = useState('');
  const [repairNotes, setRepairNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await repairService.technician.getJob(id);
      if (res?.success) setJob(res.booking);
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not load this job.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      if (res?.booking) setJob(res.booking);
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const url = await repairService.uploadPhoto(f);
        if (url) urls.push(url);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (err) {
      setError(repairErrorMessage(err, 'Photo upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const sendQuotation = () =>
    run(() =>
      repairService.technician.submitQuotation(job._id, {
        findings,
        photos,
        items: items.map((i) => ({ label: i.label, amount: Number(i.amount) })),
        estimatedDays: Number(estimatedDays) || 0,
        notes,
      })
    );

  if (loading) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center"><Loader2 className="animate-spin text-[#ff5500]" /></div>;
  }
  if (!job) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[13px] text-slate-500 m-0">{error || 'Job not found.'}</p>
        <button type="button" onClick={() => navigate('/technician/jobs')} className="px-5 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold border-none cursor-pointer">Back</button>
      </div>
    );
  }

  const q = job.quotation || {};
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#ff5500] bg-white';

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans w-full max-w-[480px] md:max-w-3xl mx-auto pb-12">
      <RepairPageHeader title={`${job.brand} ${job.model}`} subtitle={`#${job.bookingId}`} onBack={() => navigate('/technician/jobs')} />
      <div className="px-4 pt-4 space-y-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-bold text-slate-500 m-0">{job.categoryName}</p>
            <RepairStatusChip status={job.status} />
          </div>
          <p className="text-[13px] font-extrabold text-[#1e1b4b] m-0">{job.problem}{job.subProblem ? ` → ${job.subProblem}` : ""}</p>
          {job.description && <p className="text-[12px] text-slate-600 m-0">{job.description}</p>}
          {job.photos?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {job.photos.map((p) => (
                <a key={p} href={p} target="_blank" rel="noreferrer"><img src={p} alt="Item" className="w-16 h-16 rounded-lg object-cover border border-slate-200" /></a>
              ))}
            </div>
          )}
          {job.repairCenter && <p className="text-[11px] text-slate-400 m-0">Center: {job.repairCenter.name}</p>}
        </div>

        {/* Diagnosis + quotation form */}
        {job.status === 'DIAGNOSING' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-[13px] font-extrabold text-[#1e1b4b] m-0">Diagnosis &amp; Quotation</h3>
            <textarea rows={3} placeholder="Diagnosis findings (what is wrong?)" value={findings} onChange={(e) => setFindings(e.target.value)} className={`${inputCls} resize-none`} />

            <div className="flex gap-2 flex-wrap">
              {photos.map((url) => (
                <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                  <img src={url} alt="Diagnosis" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((x) => x !== url))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center border-none cursor-pointer"><X size={10} /></button>
                </div>
              ))}
              {photos.length < 6 && (
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center bg-white cursor-pointer disabled:opacity-60">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  <span className="text-[9px] font-bold">Photo</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
            </div>

            <p className="text-[12px] font-bold text-slate-500 m-0">Quotation lines (parts / labour)</p>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input className={`${inputCls} flex-1`} placeholder="e.g. Screen replacement" value={it.label} onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className={`${inputCls} w-24`} type="number" min="0" placeholder="₹" value={it.amount} onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))} className="w-10 rounded-xl bg-rose-50 text-rose-500 border-none cursor-pointer flex items-center justify-center"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setItems((arr) => [...arr, { label: '', amount: '' }])} className="flex items-center gap-1 text-[12px] font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0">
              <Plus size={14} /> Add line
            </button>
            <div className="flex justify-between text-[14px] font-extrabold text-[#1e1b4b] border-t border-slate-100 pt-2">
              <span>Total</span><span>{formatRupees(total)}</span>
            </div>
            <div className="flex gap-2">
              <input className={`${inputCls} w-28`} type="number" min="0" placeholder="Est. days" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} />
              <input className={`${inputCls} flex-1`} placeholder="Notes for customer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <button
              type="button"
              disabled={busy || !findings.trim() || total <= 0 || items.some((i) => !i.label.trim() || i.amount === '')}
              onClick={sendQuotation}
              className="w-full py-3 rounded-xl bg-[#ff5500] text-white text-[13px] font-extrabold border-none cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send Quotation to Customer'}
            </button>
          </div>
        )}

        {/* Sent quotation summary */}
        {q.status && q.status !== 'None' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <h3 className="text-[13px] font-extrabold text-[#1e1b4b] m-0">Quotation</h3>
              <span className="text-[10px] font-extrabold uppercase text-slate-400">{q.status}</span>
            </div>
            {job.diagnosis?.findings && <p className="text-[12px] text-slate-600 m-0">{job.diagnosis.findings}</p>}
            {q.items.map((it, i) => (
              <div key={`${it.label}-${i}`} className="flex justify-between text-[12px] font-semibold text-slate-600"><span>{it.label}</span><span>{formatRupees(it.amount)}</span></div>
            ))}
            <div className="flex justify-between text-[13px] font-extrabold text-[#1e1b4b] border-t border-slate-100 pt-1.5"><span>Total</span><span>{formatRupees(q.total)}</span></div>
            {job.status === 'QUOTATION_SENT' && <p className="text-[11px] text-amber-700 font-bold m-0">Waiting for the customer to approve.</p>}
            {job.status === 'QUOTATION_REJECTED' && <p className="text-[11px] text-rose-600 font-bold m-0">Customer rejected. The item will be returned unrepaired.</p>}
          </div>
        )}

        {job.status === 'QUOTATION_APPROVED' && (
          <button type="button" disabled={busy} onClick={() => run(() => repairService.technician.startRepair(job._id))} className="w-full py-3 rounded-xl bg-[#ff5500] text-white text-[13px] font-extrabold border-none cursor-pointer disabled:opacity-60">
            {busy ? 'Please wait…' : 'Start Repair'}
          </button>
        )}

        {job.status === 'IN_REPAIR' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <textarea rows={3} placeholder="Repair notes (what was done)" value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} className={`${inputCls} resize-none`} />
            <button type="button" disabled={busy} onClick={() => run(() => repairService.technician.complete(job._id, repairNotes))} className="w-full py-3 rounded-xl bg-[#15803d] text-white text-[13px] font-extrabold border-none cursor-pointer disabled:opacity-60">
              {busy ? 'Please wait…' : 'Mark Repair Completed'}
            </button>
          </div>
        )}

        {error && <p className="text-[12px] font-bold text-rose-600 m-0">{error}</p>}
      </div>
    </div>
  );
};

export default TechnicianJob;

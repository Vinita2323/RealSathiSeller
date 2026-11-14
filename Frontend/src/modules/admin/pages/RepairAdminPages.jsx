import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X, Plus, Trash2, RefreshCw, Eye, Wrench, Truck, BadgeCheck, ShieldCheck } from 'lucide-react';
import repairService, { repairErrorMessage, REPAIR_STATUS_LABELS, DEFAULT_REPAIR_HERO } from '../../../services/repairService';
import { REPAIR_OPEN_BOOKING_KEY, REPAIR_OPEN_BOOKING_EVENT } from '../components/RepairRequestNotifier';
import { RepairStatusChip, RepairCategoryIcon, REPAIR_ICON_NAMES, formatRupees, formatDateTime } from '../../../components/repair/RepairUi';

/* Shared admin UI bits ----------------------------------------------------------------- */
const card = 'bg-white border border-slate-200 rounded-2xl shadow-sm';
const input = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#ff5500] bg-white';
const btnPrimary = 'px-3.5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold border-none cursor-pointer disabled:opacity-60';
const btnGhost = 'px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-60';
const btnDanger = 'px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold cursor-pointer disabled:opacity-60';

const PageTitle = ({ title, subtitle, right }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
    <div>
      <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5 mb-0">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const Modal = ({ title, onClose, children, wide = false }) => (
  <div className="fixed inset-0 z-[80] bg-slate-900/50 flex items-center justify-center p-3">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10">
        <h3 className="text-sm font-bold text-slate-900 m-0">{title}</h3>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-50 border-none cursor-pointer flex items-center justify-center text-slate-500"><X size={16} /></button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-[11px] font-bold text-slate-500 mb-1">{label}</span>
    {children}
  </label>
);

/* BOOKINGS (also used for Rider assignment + Quotations views) ------------------------------ */
const STATUS_FILTERS = ['ALL', ...Object.keys(REPAIR_STATUS_LABELS)];

export const RepairBookingsAdmin = ({ preset = 'all' }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [viewOnly, setViewOnly] = useState(false); // eye icon = read-only details, "Manage" = assign / cancel

  // Opened from the "New Repair Request" popup: jump straight to that booking
  useEffect(() => {
    const open = (id, readOnly = false) => {
      if (!id) return;
      setViewOnly(Boolean(readOnly));
      setOpenId(id);
      try { sessionStorage.removeItem(REPAIR_OPEN_BOOKING_KEY); } catch { /* ignore */ }
    };
    try {
      const raw = sessionStorage.getItem(REPAIR_OPEN_BOOKING_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        open(pending?.id, pending?.readOnly);
      }
    } catch { /* ignore malformed value */ }
    const onEvent = (e) => open(e.detail?.id, e.detail?.readOnly);
    window.addEventListener(REPAIR_OPEN_BOOKING_EVENT, onEvent);
    return () => window.removeEventListener(REPAIR_OPEN_BOOKING_EVENT, onEvent);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await repairService.admin.listBookings({ status: status === 'ALL' ? '' : status, q });
      setBookings(res?.bookings || []);
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not load repair bookings.'));
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const visible = useMemo(() => {
    if (preset === 'quotations') return bookings.filter((b) => b.quotation?.status && b.quotation.status !== 'None');
    if (preset === 'riders') {
      return bookings.filter(
        (b) =>
          (b.status === 'REQUESTED') ||
          (['REPAIR_COMPLETED', 'QUOTATION_REJECTED'].includes(b.status) && !b.deliveryCaptainId) ||
          (b.status === 'PICKUP_ASSIGNED') || (b.status === 'DELIVERY_ASSIGNED')
      );
    }
    return bookings;
  }, [bookings, preset]);

  const titles = {
    all: ['Repair Bookings', 'All repair & service bookings'],
    quotations: ['Repair Quotations', 'Quotations sent by technicians and customer decisions'],
    riders: ['Repair Rider Assignment', 'Bookings that need a pickup or delivery rider'],
  };

  return (
    <div>
      <PageTitle
        title={titles[preset][0]}
        subtitle={titles[preset][1]}
        right={<button type="button" className={btnGhost} onClick={load}><RefreshCw size={12} className="inline mr-1" />Refresh</button>}
      />
      <div className="flex flex-wrap gap-2 mb-3">
        <input className={`${input} max-w-xs`} placeholder="Search booking ID, item, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${input} max-w-[220px]`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : REPAIR_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2.5">Booking</th><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Pickup rider</th><th className="px-3 py-2.5">Quotation</th><th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10"><Loader2 className="animate-spin inline text-[#ff5500]" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">No repair bookings found.</td></tr>
            ) : visible.map((b) => (
              <tr key={b._id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap">#{b.bookingId}<div className="text-[10px] font-medium text-slate-400">{formatDateTime(b.createdAt)}</div></td>
                <td className="px-3 py-2.5">{b.brand} {b.model}<div className="text-[10px] text-slate-400">{b.categoryName} · {b.problem}{b.subProblem ? ` → ${b.subProblem}` : ""}</div></td>
                <td className="px-3 py-2.5">{b.pickupAddress?.fullName}<div className="text-[10px] text-slate-400">{b.pickupAddress?.phone}</div></td>
                <td className="px-3 py-2.5"><RepairStatusChip status={b.status} /></td>
                <td className="px-3 py-2.5">{b.pickupCaptainId?.name || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5">{b.quotation?.status && b.quotation.status !== 'None' ? `${formatRupees(b.quotation.total)} · ${b.quotation.status}` : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-2">
                  <button type="button" title="View repair details" aria-label="View repair details" className={`${btnGhost} !px-2.5`} onClick={() => { setViewOnly(true); setOpenId(b._id); }}><Eye size={14} className="inline" /></button>
                  <button type="button" className={btnGhost} onClick={() => { setViewOnly(false); setOpenId(b._id); }}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && <BookingDetailModal id={openId} readOnly={viewOnly} onSwitchToManage={() => setViewOnly(false)} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};

/* REPAIR WORKFLOW PANEL — admin runs diagnosis → quotation → repair → completion from the Manage window ------- */
// Larger text for the Manage / View window
const mInput = input.replace('text-xs', 'text-[15px]').replace('py-2 ', 'py-2.5 ');
const mPrimary = btnPrimary.replace('text-xs', 'text-[15px]').replace('px-3.5 py-2', 'px-5 py-2.5');
const mGhost = btnGhost.replace('text-xs', 'text-[15px]').replace('px-3.5 py-2', 'px-5 py-2.5');
const mDanger = btnDanger.replace('text-[11px]', 'text-sm').replace('px-3 py-1.5', 'px-4 py-2.5');

const NEXT_STEP_HELP = {
  REQUESTED: 'Assign a pickup rider above.',
  PICKUP_ASSIGNED: 'Waiting for the rider to accept the pickup.',
  PICKUP_ACCEPTED: 'Waiting for the rider to start the ride to the customer.',
  PICKUP_STARTED: 'The rider is on the way to the customer.',
  REACHED_CUSTOMER: 'The rider is with the customer, waiting for the pickup OTP.',
  PICKED_UP: 'Item picked up. Waiting for the rider to start the ride to the repair center.',
  CENTER_RIDE_STARTED: 'The rider is on the way to you. Give the handover OTP once the device is received.',
  REACHED_CENTER: 'The rider has arrived. Give the handover OTP (shown above) after you receive the device.',
  QUOTATION_SENT: 'Diagnosis recorded. Call the customer and record their decision.',
  QUOTATION_REJECTED: 'The customer declined the repair. Assign a delivery rider above to return the device.',
  REPAIR_COMPLETED: 'Repair is done. Assign a delivery rider above to deliver it back to the customer.',
  DELIVERY_ASSIGNED: 'Waiting for the delivery rider to accept.',
  DELIVERY_ACCEPTED: 'Waiting for the delivery rider to collect the device from you.',
  OUT_FOR_DELIVERY: 'The device is out for delivery. The customer gives the delivery OTP to the rider.',
  DELIVERED: 'Completed. The repair was delivered to the customer.',
  CANCELLED: 'This booking was cancelled.',
};

const RepairWorkflowPanel = ({ b, run, busy }) => {
  const [findings, setFindings] = useState('');
  const [estimate, setEstimate] = useState('');
  const [amount, setAmount] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [repairNotes, setRepairNotes] = useState('');

  // The customer to call: account holder + the contact on the pickup address (they can differ)
  const customerName = b.user?.name || b.pickupAddress?.fullName || 'Customer';
  const phones = [...new Set([b.pickupAddress?.phone, b.user?.phone].filter(Boolean))];

  const wrap = (children) => (
    <div className="border border-[#ff5500]/30 bg-[#fff8f3] rounded-xl p-3.5 text-[15px] space-y-2.5">
      <div className="flex items-center gap-1.5 text-[#ea580c] font-extrabold uppercase text-xs tracking-wider"><Wrench size={12} /> Repair workflow · next step</div>
      {children}
    </div>
  );

  const callCard = (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="m-0 text-xs font-bold uppercase text-slate-400">Customer</p>
        <p className="m-0 text-sm font-extrabold text-slate-900">{customerName}</p>
        <p className="m-0 text-slate-500">{[b.pickupAddress?.city, b.pickupAddress?.pincode].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {phones.map((ph) => (
          <a key={ph} href={`tel:${ph}`} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold no-underline flex items-center gap-1.5">
            📞 Call {ph}
          </a>
        ))}
      </div>
    </div>
  );

  if (b.status === 'AT_REPAIR_CENTER') {
    return wrap(
      <>
        <p className="m-0 text-slate-700">The device is at the repair center. Start the diagnosis.</p>
        <button type="button" disabled={busy} className={mPrimary} onClick={() => run(() => repairService.admin.startDiagnosis(b._id))}>Start Diagnosis</button>
      </>
    );
  }

  if (b.status === 'DIAGNOSING') {
    return wrap(
      <>
        <p className="m-0 text-slate-700">Write down the problem you found. After saving, call the customer and tell them what needs to be repaired.</p>
        <textarea rows={3} className={`${mInput} resize-none`} placeholder="Problem found (e.g. speaker coil burnt, needs replacement)" value={findings} onChange={(e) => setFindings(e.target.value)} />
        <div>
          <span className="block text-sm font-bold text-slate-500 mb-1">Estimated repair cost ₹ <span className="font-normal text-slate-400">(optional — you can confirm the final amount on the call)</span></span>
          <input className={`${mInput} w-40`} type="number" min="0" placeholder="e.g. 1200" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
        </div>
        {callCard}
        <button type="button" disabled={busy || !findings.trim()} className={mPrimary} onClick={() => run(() => repairService.admin.saveDiagnosis(b._id, { findings, estimatedCost: estimate }))}>
          Save Diagnosis
        </button>
      </>
    );
  }

  if (b.status === 'QUOTATION_SENT') {
    const est = Number(b.quotation?.total) || 0;
    return wrap(
      <>
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1">
          <p className="m-0 text-xs font-bold uppercase text-slate-400">Problem found</p>
          <p className="m-0 text-slate-800 text-sm font-semibold">{b.diagnosis?.findings || '—'}</p>
          {est > 0 && <p className="m-0 text-slate-500">Estimated cost: {formatRupees(est)}</p>}
        </div>
        {callCard}
        <p className="m-0 text-slate-700">Call the customer, explain the problem, then record what they decided.</p>
        <div className="grid grid-cols-[150px_1fr] gap-2">
          <input className={mInput} type="number" min="0" placeholder="Agreed amount ₹" value={amount === '' && est > 0 ? est : amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={mInput} placeholder="Note from the call (optional)" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !(Number(amount === '' ? est : amount) > 0)}
            className={mPrimary}
            onClick={() => run(() => repairService.admin.recordDecision(b._id, { decision: 'approve', amount: amount === '' ? est : amount, note: decisionNote }))}
          >
            Customer Agreed — Proceed with Repair
          </button>
          <button
            type="button"
            disabled={busy}
            className={mDanger}
            onClick={() => { if (window.confirm('Customer declined the repair? The device will be returned without repair (only the diagnosis fee is charged).')) run(() => repairService.admin.recordDecision(b._id, { decision: 'reject', note: decisionNote })); }}
          >
            Customer Declined — Return Device
          </button>
        </div>
      </>
    );
  }

  if (b.status === 'QUOTATION_APPROVED') {
    return wrap(
      <>
        <p className="m-0 text-slate-700">The customer agreed to <b>{formatRupees(b.quotation?.total)}</b>. Start the repair work.</p>
        <button type="button" disabled={busy} className={mPrimary} onClick={() => run(() => repairService.admin.startRepair(b._id))}>Start Repair</button>
      </>
    );
  }

  if (b.status === 'IN_REPAIR') {
    return wrap(
      <>
        <p className="m-0 text-slate-700">Repair in progress. When it is finished, mark it completed — then assign a delivery rider to return the device.</p>
        <textarea rows={2} className={`${mInput} resize-none`} placeholder="Repair notes — what was done (optional)" value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} />
        <button type="button" disabled={busy} className={mPrimary} onClick={() => run(() => repairService.admin.completeRepair(b._id, repairNotes))}>Mark Repair Completed</button>
      </>
    );
  }

  const help = NEXT_STEP_HELP[b.status];
  return help ? wrap(<p className="m-0 text-slate-700">{help}</p>) : null;
};

const BookingDetailModal = ({ id, onClose, onChanged, readOnly = false, onSwitchToManage }) => {
  const [data, setData] = useState(null);
  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickupRider, setPickupRider] = useState('');
  const [deliveryRider, setDeliveryRider] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        repairService.admin.getBooking(id),
        repairService.admin.listRiders(),
      ]);
      setData(d);
      setRiders(r?.riders || []);
    } catch (err) {
      setError(repairErrorMessage(err));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Keep the open window in sync with riders / technicians moving the job along (skipped while saving or tab hidden)
  const busyRef = React.useRef(false);
  busyRef.current = busy;
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden && !busyRef.current) load(); }, 8000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <Modal title="Repair booking" onClose={onClose}>{error ? <p className="text-[15px] text-rose-600">{error}</p> : <Loader2 className="animate-spin text-[#ff5500]" />}</Modal>;
  }
  const b = data.booking;
  const riderSelect = (value, setValue) => (
    <select className={mInput} value={value} onChange={(e) => setValue(e.target.value)}>
      <option value="">{riders.length === 0 ? 'No repair drivers yet — use Add Driver' : 'Select driver…'}</option>
      {riders.map((r) => <option key={r._id} value={r._id}>{r.name || r.phone} · {r.isOnline ? 'online' : 'offline'}</option>)}
    </select>
  );

  const canAssignPickup = !readOnly && ['REQUESTED', 'PICKUP_ASSIGNED'].includes(b.status);
  const canAssignDelivery = !readOnly && ['REPAIR_COMPLETED', 'QUOTATION_REJECTED', 'DELIVERY_ASSIGNED'].includes(b.status);
  const canCancel = !readOnly && ['REQUESTED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED', 'REACHED_CUSTOMER', 'PICKED_UP', 'CENTER_RIDE_STARTED', 'REACHED_CENTER', 'AT_REPAIR_CENTER', 'DIAGNOSING', 'QUOTATION_SENT'].includes(b.status);
  const closed = readOnly || ['DELIVERED', 'CANCELLED'].includes(b.status);

  return (
    <Modal title={`${readOnly ? 'Repair details' : 'Manage repair'} · #${b.bookingId}`} onClose={onClose} wide>
      <div className="flex items-center justify-between">
        <RepairStatusChip status={b.status} />
        <span className="text-sm text-slate-400">{formatDateTime(b.createdAt)}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-[15px]">
        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="font-bold text-slate-800 m-0">{b.brand} {b.model} <span className="text-slate-400 font-medium">({b.categoryName})</span></p>
          <p className="m-0 text-slate-600">Problem: {b.problem}{b.subProblem ? ` → ${b.subProblem}` : ""}</p>
          {b.description && <p className="m-0 text-slate-500">{b.description}</p>}
          {b.photos?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-1">
              {b.photos.map((p) => <a key={p} href={p} target="_blank" rel="noreferrer"><img src={p} alt="Item" className={`${readOnly ? 'w-24 h-24' : 'w-14 h-14'} rounded-lg object-cover border border-slate-200`} /></a>)}
            </div>
          )}
          {b.photos?.length === 0 && <p className="m-0 text-slate-400">No photos uploaded.</p>}
        </div>
        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="font-bold text-slate-800 m-0">{b.pickupAddress?.fullName} · {b.pickupAddress?.phone}</p>
          <p className="m-0 text-slate-600">{[b.pickupAddress?.addressLine1, b.pickupAddress?.addressLine2, b.pickupAddress?.landmark, b.pickupAddress?.city, b.pickupAddress?.state, b.pickupAddress?.pincode].filter(Boolean).join(', ')}</p>
          <p className="m-0 text-slate-400">Pickup: {b.pickupSlot?.date}, {b.pickupSlot?.timeSlot}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-[15px]">
        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
          <p className="font-bold text-slate-800 m-0">Pickup rider</p>
          <p className="m-0 text-slate-600">{b.pickupCaptainId ? `${b.pickupCaptainId.name} (${b.pickupCaptainStatus})` : 'Not assigned'}</p>
          {canAssignPickup && (
            <div className="flex gap-2">{riderSelect(pickupRider, setPickupRider)}
              <button type="button" disabled={busy || !pickupRider} className={mPrimary} onClick={() => run(() => repairService.admin.assignPickup(b._id, pickupRider))}>Assign</button></div>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
          <p className="font-bold text-slate-800 m-0">Delivery rider</p>
          <p className="m-0 text-slate-600">{b.deliveryCaptainId ? `${b.deliveryCaptainId.name} (${b.deliveryCaptainStatus})` : 'Not assigned'}</p>
          {canAssignDelivery && (
            <div className="flex gap-2">{riderSelect(deliveryRider, setDeliveryRider)}
              <button type="button" disabled={busy || !deliveryRider} className={mPrimary} onClick={() => run(() => repairService.admin.assignDelivery(b._id, deliveryRider))}>Assign</button></div>
          )}
        </div>
      </div>

      {!readOnly && <RepairWorkflowPanel b={b} run={run} busy={busy} />}

      {b.quotation?.status !== 'None' && (
        <div className="bg-slate-50 rounded-xl p-3 text-[15px] space-y-1">
          <p className="font-bold text-slate-800 m-0">{b.decisionMode === 'phone' ? 'Repair cost (agreed by phone)' : 'Quotation'} · {b.quotation.status === 'Sent' && b.decisionMode === 'phone' ? 'Awaiting call' : b.quotation.status}</p>
          {b.diagnosis?.findings && <p className="m-0 text-slate-600">Diagnosis: {b.diagnosis.findings}</p>}
          {b.quotation.items.map((it, i) => <div key={`${it.label}-${i}`} className="flex justify-between text-slate-600"><span>{it.label}</span><span>{formatRupees(it.amount)}</span></div>)}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1"><span>Total</span><span>{formatRupees(b.quotation.total)}</span></div>
        </div>
      )}

      {['CENTER_RIDE_STARTED', 'REACHED_CENTER'].includes(b.status) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[15px] flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-amber-900 m-0">Repair-center handover OTP</p>
            <p className="m-0 text-amber-700">
              {b.status === 'REACHED_CENTER'
                ? 'The rider has reached the center. Give this OTP to the rider after you receive the device.'
                : 'The rider is on the way to the center. Give this OTP only once the device is handed over.'}
            </p>
          </div>
          <span className="text-2xl font-black tracking-[6px] text-amber-900 shrink-0">{b.centerOtp || '—'}</span>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-3 text-[15px] space-y-1">
        <p className="font-bold text-slate-800 m-0">Billing</p>
        <p className="m-0 text-slate-600">Diagnosis fee {formatRupees(b.diagnosisFee)} · Amount due {formatRupees(b.amountDue)} · {b.paymentStatus}{b.paymentMethod ? ` (${b.paymentMethod})` : ''}</p>
        {data.payments?.map((p) => <p key={p._id} className="m-0 text-slate-500">{p.kind} {formatRupees(p.amount)} via {p.method} · {formatDateTime(p.createdAt)}</p>)}
      </div>

      {readOnly && (
        <div className="bg-slate-50 rounded-xl p-3 text-[15px] space-y-1">
          <p className="font-bold text-slate-800 m-0">Timeline</p>
          <p className="m-0 text-slate-600">Booked: {formatDateTime(b.createdAt) || '—'}</p>
          <p className="m-0 text-slate-600">Rider started ride: {formatDateTime(b.rideStartedAt) || '—'}</p>
          <p className="m-0 text-slate-600">Rider reached customer: {formatDateTime(b.reachedCustomerAt) || '—'}</p>
          <p className="m-0 text-slate-600">Picked up: {formatDateTime(b.pickedUpAt) || '—'}</p>
          <p className="m-0 text-slate-600">Rider started ride to repair center: {formatDateTime(b.centerRideStartedAt) || '—'}</p>
          <p className="m-0 text-slate-600">Rider reached repair center: {formatDateTime(b.reachedCenterAt) || '—'}</p>
          <p className="m-0 text-slate-600">Handed over at repair center: {formatDateTime(b.atCenterAt) || '—'}</p>
          <p className="m-0 text-slate-600">Repair completed: {formatDateTime(b.repairCompletedAt) || '—'}</p>
          <p className="m-0 text-slate-600">Delivered: {formatDateTime(b.deliveredAt) || '—'}</p>
          {b.repairNotes && <p className="m-0 text-slate-600 pt-1"><b>Technician repair notes:</b> {b.repairNotes}</p>}
          {b.cancelReason && <p className="m-0 text-rose-600 pt-1"><b>Cancelled ({b.cancelledBy}):</b> {b.cancelReason}</p>}
        </div>
      )}

      <details className="text-[15px]" open={readOnly}>
        <summary className="cursor-pointer font-bold text-slate-500">Activity log</summary>
        <ul className="m-0 mt-2 p-0 list-none space-y-1">
          {[...b.statusHistory].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`} className="text-slate-500"><b>{REPAIR_STATUS_LABELS[h.status] || h.status}</b> · {h.byRole} · {formatDateTime(h.at)}{h.note ? ` — ${h.note}` : ''}</li>
          ))}
        </ul>
      </details>

      {error && <p className="text-[15px] font-bold text-rose-600 m-0">{error}</p>}
      {readOnly && (
        <div className="flex justify-end gap-2">
          <button type="button" className={mGhost} onClick={onClose}>Close</button>
          {!['DELIVERED', 'CANCELLED'].includes(b.status) && <button type="button" className={mPrimary} onClick={onSwitchToManage}>Manage this booking</button>}
        </div>
      )}
      {canCancel && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} className={mDanger} onClick={() => { const reason = window.prompt('Reason for cancelling this repair?'); if (reason !== null) run(() => repairService.admin.cancel(b._id, reason)); }}>Cancel booking</button>
        </div>
      )}
    </Modal>
  );
};

/* TECHNICIANS --------------------------------------------------------------------------------- */
export const RepairTechniciansAdmin = () => {
  const [list, setList] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | technician
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([repairService.admin.listTechnicians(), repairService.admin.listCenters()]);
      setList(t?.technicians || []);
      setCenters(c?.centers || []);
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        skills: String(form.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
        repairCenter: form.repairCenter || null,
        active: form.active !== false,
      };
      if (form.password) payload.password = form.password;
      if (form._id) await repairService.admin.updateTechnician(form._id, payload);
      else await repairService.admin.createTechnician(payload);
      setEditing(null);
      await load();
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete technician ${t.name}?`)) return;
    try { await repairService.admin.deleteTechnician(t._id); await load(); } catch (err) { setError(repairErrorMessage(err)); }
  };

  return (
    <div>
      <PageTitle
        title="Repair Technicians"
        subtitle={`Technicians sign in at ${window.location.origin}/technician/login`}
        right={<button type="button" className={btnPrimary} onClick={() => setEditing({ active: true })}><Plus size={12} className="inline mr-1" />Add technician</button>}
      />
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Phone</th><th className="px-3 py-2.5">Skills</th><th className="px-3 py-2.5">Center</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-10"><Loader2 className="animate-spin inline text-[#ff5500]" /></td></tr>
              : list.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-slate-400">No technicians yet.</td></tr>
              : list.map((t) => (
                <tr key={t._id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-bold text-slate-800">{t.name}</td>
                  <td className="px-3 py-2.5">{t.phone}</td>
                  <td className="px-3 py-2.5">{(t.skills || []).join(', ') || '—'}</td>
                  <td className="px-3 py-2.5">{t.repairCenter?.name || '—'}</td>
                  <td className="px-3 py-2.5">{t.active ? <span className="text-emerald-600 font-bold">Active</span> : <span className="text-slate-400 font-bold">Inactive</span>}</td>
                  <td className="px-3 py-2.5 text-right space-x-2">
                    <button type="button" className={btnGhost} onClick={() => setEditing({ ...t, skills: (t.skills || []).join(', '), repairCenter: t.repairCenter?._id || '' })}>Edit</button>
                    <button type="button" className={btnDanger} onClick={() => remove(t)}>Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <TechnicianForm initial={editing} centers={centers} busy={busy} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
};

const TechnicianForm = ({ initial, centers, busy, onClose, onSave }) => {
  const [f, setF] = useState({ name: '', phone: '', email: '', skills: '', repairCenter: '', password: '', active: true, ...initial });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  return (
    <Modal title={f._id ? 'Edit technician' : 'Add technician'} onClose={onClose}>
      <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3">
        <Field label="Name"><input className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <Field label="Mobile (login ID)"><input className={input} value={f.phone} disabled={Boolean(f._id)} maxLength={10} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })} required /></Field>
        <Field label="Email"><input className={input} value={f.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Skills (comma separated)"><input className={input} value={f.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="Mobile, Laptop, TV" /></Field>
        <Field label="Repair center">
          <select className={input} value={f.repairCenter} onChange={(e) => set({ repairCenter: e.target.value })}>
            <option value="">None</option>
            {centers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={f._id ? 'New password (leave blank to keep)' : 'Password (min 6 characters)'}>
          <input className={input} type="password" autoComplete="new-password" value={f.password} onChange={(e) => set({ password: e.target.value })} required={!f._id} />
        </Field>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
        <div className="flex justify-end gap-2 pt-1"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
};

/* REPAIR CENTERS ------------------------------------------------------------------------------- */
export const RepairCentersAdmin = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList((await repairService.admin.listCenters())?.centers || []); } catch (err) { setError(repairErrorMessage(err)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (f) => {
    setBusy(true);
    setError('');
    try {
      const payload = { name: f.name, address: f.address, phone: f.phone, city: f.city, state: f.state, pincode: f.pincode, active: f.active !== false };
      if (f._id) await repairService.admin.updateCenter(f._id, payload);
      else await repairService.admin.createCenter(payload);
      setEditing(null);
      await load();
    } catch (err) { setError(repairErrorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete repair center ${c.name}?`)) return;
    try { await repairService.admin.deleteCenter(c._id); await load(); } catch (err) { setError(repairErrorMessage(err)); }
  };

  return (
    <div>
      <PageTitle title="Repair Centers" subtitle="Where riders drop devices and technicians repair them" right={<button type="button" className={btnPrimary} onClick={() => setEditing({ active: true })}><Plus size={12} className="inline mr-1" />Add center</button>} />
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading ? <Loader2 className="animate-spin text-[#ff5500]" /> : list.length === 0 ? <p className="text-xs text-slate-400">No repair centers yet. Add one so riders know where to drop items.</p> : list.map((c) => (
          <div key={c._id} className={`${card} p-4 space-y-1.5`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 m-0">{c.name}</h3>
              <span className={`text-[10px] font-extrabold ${c.active ? 'text-emerald-600' : 'text-slate-400'}`}>{c.active ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
            <p className="text-xs text-slate-600 m-0">{c.address}</p>
            <p className="text-[11px] text-slate-400 m-0">{[c.city, c.state, c.pincode].filter(Boolean).join(', ')} {c.phone ? `· ${c.phone}` : ''}</p>
            <div className="flex gap-2 pt-1"><button type="button" className={btnGhost} onClick={() => setEditing(c)}>Edit</button><button type="button" className={btnDanger} onClick={() => remove(c)}>Delete</button></div>
          </div>
        ))}
      </div>
      {editing && <CenterForm initial={editing} busy={busy} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
};

const CenterForm = ({ initial, busy, onClose, onSave }) => {
  const [f, setF] = useState({ name: '', address: '', phone: '', city: '', state: '', pincode: '', active: true, ...initial });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  return (
    <Modal title={f._id ? 'Edit repair center' : 'Add repair center'} onClose={onClose}>
      <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3">
        <Field label="Center name"><input className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <Field label="Address"><textarea className={`${input} resize-none`} rows={2} value={f.address} onChange={(e) => set({ address: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City"><input className={input} value={f.city || ''} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="State"><input className={input} value={f.state || ''} onChange={(e) => set({ state: e.target.value })} /></Field>
          <Field label="Pincode"><input className={input} value={f.pincode || ''} onChange={(e) => set({ pincode: e.target.value })} /></Field>
          <Field label="Phone"><input className={input} value={f.phone || ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
};

/* REPAIR CATEGORIES — the "What do you need repaired?" tiles customers see -------------------------- */
export const RepairPricingAdmin = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList((await repairService.admin.listCategories())?.categories || []); } catch (err) { setError(repairErrorMessage(err)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (f) => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: f.name,
        icon: f.icon,
        image: f.image || '',
        active: f.active !== false,
        diagnosisFee: Number(f.diagnosisFee) || 0,
        priority: Number(f.priority) || 1,
        brands: f.brands.map((b) => ({ name: b.name, models: String(b.modelsText || '').split(',').map((m) => m.trim()).filter(Boolean) })).filter((b) => b.name.trim()),
        problems: f.problems.map((p) => ({ name: p.name, estimateMin: Number(p.estimateMin) || 0, estimateMax: Number(p.estimateMax) || 0, subProblems: p.subProblems || [] })).filter((p) => p.name.trim()),
      };
      if (f._id) await repairService.admin.updateCategory(f._id, payload);
      else await repairService.admin.createCategory(payload);
      setEditing(null);
      await load();
    } catch (err) {
      setError(repairErrorMessage(err));
      throw err; // keep the form open
    } finally { setBusy(false); }
  };

  const toggle = async (c) => {
    setError('');
    try { await repairService.admin.updateCategory(c._id, { active: !c.active }); await load(); } catch (err) { setError(repairErrorMessage(err)); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? Customers will no longer see it. Existing bookings are not affected.`)) return;
    try { await repairService.admin.deleteCategory(c._id); await load(); } catch (err) { setError(repairErrorMessage(err)); }
  };

  const toForm = (c) => ({
    ...c,
    image: c.image || '',
    brands: (c.brands || []).map((b) => ({ name: b.name, modelsText: (b.models || []).join(', ') })),
    problems: (c.problems || []).map((p) => ({ name: p.name, estimateMin: p.estimateMin, estimateMax: p.estimateMax, subProblems: p.subProblems || [] })),
  });
  const blank = { name: '', icon: 'Wrench', image: '', active: true, diagnosisFee: 199, priority: list.length + 1, brands: [{ name: '', modelsText: '' }], problems: [{ name: '', estimateMin: '', estimateMax: '' }] };

  return (
    <div>
      <PageTitle
        title="Repair Categories"
        subtitle="Gadget categories customers can book — add, edit, hide or delete them, with their brands, problems and diagnosis fee"
        right={<button type="button" className={btnPrimary} onClick={() => setEditing(blank)}><Plus size={12} className="inline mr-1" />Add category</button>}
      />
      {error && !editing && <p className="text-xs font-bold text-rose-600">{error}</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5">Order</th><th className="px-3 py-2.5">Diagnosis fee</th>
              <th className="px-3 py-2.5">Brands</th><th className="px-3 py-2.5">Problems</th><th className="px-3 py-2.5">Visible</th><th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-10"><Loader2 className="animate-spin inline text-[#ff5500]" /></td></tr>
              : list.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-slate-400">No categories yet. Click “Add category”.</td></tr>
              : list.map((c) => (
                <tr key={c._id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#ea580c] flex items-center justify-center overflow-hidden shrink-0"><RepairCategoryIcon name={c.icon} image={c.image} size={18} /></div>
                      <span className="font-bold text-slate-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{c.priority}</td>
                  <td className="px-3 py-2.5">{formatRupees(c.diagnosisFee)}</td>
                  <td className="px-3 py-2.5">{(c.brands || []).length}</td>
                  <td className="px-3 py-2.5">{(c.problems || []).length}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => toggle(c)} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer ${c.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {c.active ? 'Shown' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right space-x-2 whitespace-nowrap">
                    <button type="button" className={btnGhost} onClick={() => setEditing(toForm(c))}>Edit</button>
                    <button type="button" className={btnDanger} onClick={() => remove(c)}><Trash2 size={12} className="inline" /> Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <CategoryForm initial={editing} busy={busy} error={error} onClose={() => { setEditing(null); setError(''); }} onSave={save} />}
    </div>
  );
};

const CategoryForm = ({ initial, busy, error, onClose, onSave }) => {
  const [f, setF] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const fileRef = React.useRef(null);
  const set = (p) => { setLocalError(''); setF((x) => ({ ...x, ...p })); };
  const setBrand = (i, p) => set({ brands: f.brands.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const setProblem = (i, p) => set({ problems: f.problems.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { set({ image: await repairService.uploadPhoto(file) }); } catch (err) { setLocalError(repairErrorMessage(err, 'Image upload failed.')); } finally { setUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setLocalError('Category name is required.');
    if (!f.problems.some((p) => p.name.trim())) return setLocalError('Add at least one problem customers can select.');
    try { await onSave(f); } catch { /* error shown from parent */ }
    return undefined;
  };

  return (
    <Modal title={f._id ? `Edit “${initial.name}”` : 'Add category'} onClose={onClose} wide>
      <form autoComplete="off" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-4">
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="sm:col-span-3"><Field label="Category name (e.g. Cameras, ACs, Printers)"><input className={input} value={f.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} required /></Field></div>
              <Field label="Diagnosis fee (₹)"><input className={input} type="number" min="0" value={f.diagnosisFee} onChange={(e) => set({ diagnosisFee: e.target.value })} /></Field>
              <Field label="Display order"><input className={input} type="number" min="1" value={f.priority} onChange={(e) => set({ priority: e.target.value })} /></Field>
              <label className="flex items-end gap-2 text-xs font-bold text-slate-600 pb-2"><input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Visible to customers</label>
            </div>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">Customer tile preview</span>
            <div className="w-[150px] bg-white border border-slate-200 rounded-2xl p-3 shadow-sm space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ea580c] overflow-hidden"><RepairCategoryIcon name={f.icon} image={f.image} /></div>
              <p className="text-[13px] font-extrabold text-[#1e1b4b] m-0 break-words">{f.name || 'Category'}</p>
              <p className="text-[10px] font-semibold text-slate-400 m-0">Diagnosis from {formatRupees(f.diagnosisFee)}</p>
            </div>
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-bold text-slate-500 mb-1.5">Icon</span>
          <div className="flex flex-wrap gap-1.5">
            {REPAIR_ICON_NAMES.map((n) => (
              <button key={n} type="button" title={n} onClick={() => set({ icon: n, image: '' })}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer ${!f.image && f.icon === n ? 'border-[#ff5500] bg-orange-50 text-[#ea580c]' : 'border-slate-200 bg-white text-slate-500'}`}>
                <RepairCategoryIcon name={n} size={16} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" className={btnGhost} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : f.image ? 'Change custom image' : 'Or upload a custom image'}</button>
            {f.image && <button type="button" className={btnDanger} onClick={() => set({ image: '' })}>Remove image</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-slate-500">Brands &amp; models (customers can also type a brand that is not in this list)</span>
          {f.brands.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <input className={input} placeholder="Brand" value={b.name} onChange={(e) => setBrand(i, { name: e.target.value })} />
              <input className={input} placeholder="Models, comma separated (e.g. iPhone 13, iPhone 14)" value={b.modelsText} onChange={(e) => setBrand(i, { modelsText: e.target.value })} />
              <button type="button" className={btnDanger} onClick={() => set({ brands: f.brands.filter((_, j) => j !== i) })}><Trash2 size={12} /></button>
            </div>
          ))}
          <button type="button" className="flex items-center gap-1 text-xs font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0" onClick={() => set({ brands: [...f.brands, { name: '', modelsText: '' }] })}><Plus size={13} /> Add brand</button>
        </div>

        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-slate-500">Problems customers can select (with indicative price range)</span>
          {f.problems.map((p, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2">
              <input className={input} placeholder="Problem (e.g. Broken screen)" value={p.name} onChange={(e) => setProblem(i, { name: e.target.value })} />
              <input className={input} type="number" min="0" placeholder="Min ₹" value={p.estimateMin} onChange={(e) => setProblem(i, { estimateMin: e.target.value })} />
              <input className={input} type="number" min="0" placeholder="Max ₹" value={p.estimateMax} onChange={(e) => setProblem(i, { estimateMax: e.target.value })} />
              <button type="button" className={btnDanger} onClick={() => set({ problems: f.problems.filter((_, j) => j !== i) })}><Trash2 size={12} /></button>
            </div>
          ))}
          <button type="button" className="flex items-center gap-1 text-xs font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0" onClick={() => set({ problems: [...f.problems, { name: '', estimateMin: '', estimateMax: '' }] })}><Plus size={13} /> Add problem</button>
        </div>

        {(localError || error) && <p className="text-xs font-bold text-rose-600 m-0">{localError || error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy || uploading} className={btnPrimary}>{busy ? 'Saving…' : 'Save category'}</button>
        </div>
      </form>
    </Modal>
  );
};

/* REPORTS -------------------------------------------------------------------------------------- */
export const RepairReportsAdmin = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    repairService.admin.getReportSummary().then((r) => setData(r?.summary)).catch((e) => setError(repairErrorMessage(e)));
  }, []);

  if (error) return <p className="text-xs font-bold text-rose-600">{error}</p>;
  if (!data) return <Loader2 className="animate-spin text-[#ff5500]" />;
  const revenue = data.revenue.reduce((s, r) => s + r.amount, 0);
  const tiles = [
    ['Total bookings', data.totals.total],
    ['Quotations approved', data.totals.approved],
    ['Quotations rejected', data.totals.rejected],
    ['Approved quotation value', formatRupees(data.totals.quotationTotal)],
    ['Collected revenue', formatRupees(revenue)],
  ];
  return (
    <div className="space-y-4">
      <PageTitle title="Repair Reports" subtitle="Overview of repair bookings and collections" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map(([k, v]) => <div key={k} className={`${card} p-4`}><p className="text-[10px] font-bold uppercase text-slate-400 m-0">{k}</p><p className="text-lg font-black text-slate-900 m-0 mt-1">{v}</p></div>)}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className={`${card} p-4`}>
          <h3 className="text-sm font-bold text-slate-900 mt-0 mb-2">By status</h3>
          {data.byStatus.length === 0 ? <p className="text-xs text-slate-400 m-0">No data.</p> : data.byStatus.map((s) => (
            <div key={s.status} className="flex justify-between text-xs py-1 border-b border-slate-50"><span>{REPAIR_STATUS_LABELS[s.status] || s.status}</span><b>{s.count}</b></div>
          ))}
        </div>
        <div className={`${card} p-4`}>
          <h3 className="text-sm font-bold text-slate-900 mt-0 mb-2">By category</h3>
          {data.byCategory.length === 0 ? <p className="text-xs text-slate-400 m-0">No data.</p> : data.byCategory.map((c) => (
            <div key={c.category} className="flex justify-between text-xs py-1 border-b border-slate-50"><span>{c.category}</span><span><b>{c.count}</b> <span className="text-slate-400">({c.delivered} delivered)</span></span></div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* PAGE CONTENT (hero banner on the customer Repair & Services page) ------------------------------ */
const PREVIEW_ICONS = [Truck, BadgeCheck, ShieldCheck, Wrench];

export const RepairPageContentAdmin = () => {
  const [form, setForm] = useState(null);
  const [defaults, setDefaults] = useState(DEFAULT_REPAIR_HERO);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    repairService.admin.getContent()
      .then((r) => {
        setForm({ ...DEFAULT_REPAIR_HERO, ...r.content.hero });
        if (r.defaults?.hero) setDefaults(r.defaults.hero);
      })
      .catch((e) => setError(repairErrorMessage(e)));
  }, []);

  if (!form) return error ? <p className="text-xs font-bold text-rose-600">{error}</p> : <Loader2 className="animate-spin text-[#ff5500]" />;

  const set = (p) => { setSaved(''); setError(''); setForm((f) => ({ ...f, ...p })); };
  const setFeature = (i, value) => set({ features: form.features.map((f, j) => (j === i ? value : f)) });

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const res = await repairService.admin.updateContent({ ...form, features: form.features.map((f) => f.trim()).filter(Boolean) });
      setForm({ ...DEFAULT_REPAIR_HERO, ...res.content.hero });
      setSaved('Saved. Customers will see the new banner immediately.');
    } catch (e) {
      setError(repairErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <PageTitle title="Repair Page Content" subtitle="Manage the banner shown at the top of the customer Repair & Services page" />

      <div className={`${card} p-5 space-y-4`}>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={form.enabled !== false} onChange={(e) => set({ enabled: e.target.checked })} />
          Show banner on the Repair & Services page
        </label>
        <Field label={`Title (${form.title.length}/80)`}>
          <input className={input} maxLength={80} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={`Description (${form.subtitle.length}/160)`}>
          <textarea className={`${input} resize-none`} rows={2} maxLength={160} value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
        </Field>
        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-slate-500">Highlights (up to 4, max 24 characters each)</span>
          {form.features.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input className={input} maxLength={24} value={f} onChange={(e) => setFeature(i, e.target.value)} placeholder={`Highlight ${i + 1}`} />
              <button type="button" className={btnDanger} onClick={() => set({ features: form.features.filter((_, j) => j !== i) })}><Trash2 size={12} /></button>
            </div>
          ))}
          {form.features.length < 4 && (
            <button type="button" className="flex items-center gap-1 text-xs font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0" onClick={() => set({ features: [...form.features, ''] })}>
              <Plus size={13} /> Add highlight
            </button>
          )}
        </div>

        <div>
          <span className="block text-[11px] font-bold text-slate-500 mb-1.5">Preview (as customers see it)</span>
          <div className="max-w-[400px] bg-[#f8fafc] rounded-xl p-3 border border-slate-100">
            {form.enabled === false ? (
              <p className="text-[11px] text-slate-400 m-0">Banner is hidden.</p>
            ) : (
              <div className="bg-gradient-to-r from-[#ff5500] to-[#ff8a3d] rounded-xl px-3 py-2.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Wrench size={15} className="shrink-0" />
                  <h2 className="text-[13px] font-extrabold m-0 leading-tight">{form.title || 'Title'}</h2>
                </div>
                {form.subtitle && <p className="text-[11px] font-medium m-0 mt-0.5 opacity-95 leading-snug">{form.subtitle}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] font-bold">
                  {form.features.filter((f) => f.trim()).map((text, i) => {
                    const Icon = PREVIEW_ICONS[i % PREVIEW_ICONS.length];
                    return <span key={`${text}-${i}`} className="flex items-center gap-1 whitespace-nowrap"><Icon size={11} /> {text}</span>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-xs font-bold text-rose-600 m-0">{error}</p>}
        {saved && <p className="text-xs font-bold text-emerald-600 m-0">{saved}</p>}
        <div className="flex justify-between gap-2">
          <button type="button" className={btnGhost} onClick={() => set({ ...defaults, features: [...defaults.features] })}>Reset to default</button>
          <button type="button" disabled={busy || !form.title.trim()} className={btnPrimary} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

/* REPAIR DRIVERS — captain accounts added by admin for repair pickups / deliveries ------------------ */
const VEHICLE_TYPES = ['Two Wheeler', 'Three Wheeler', 'Four Wheeler', 'Mini Truck / Van'];

export const RepairDriversAdmin = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { setList((await repairService.admin.listDrivers())?.drivers || []); } catch (err) { setError(repairErrorMessage(err)); } finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (f) => {
    setBusy(true);
    setError('');
    try {
      if (f._id) {
        const data = { name: f.name, city: f.city, vehicleType: f.vehicleType, drivingLicenseNumber: f.drivingLicenseNumber, repairOnly: f.repairOnly };
        if (f.password) data.password = f.password;
        await repairService.admin.updateDriver(f._id, data);
      } else {
        await repairService.admin.createDriver({
          name: f.name, phone: f.phone, password: f.password, city: f.city,
          vehicleType: f.vehicleType, drivingLicenseNumber: f.drivingLicenseNumber, repairOnly: f.repairOnly,
        });
      }
      setEditing(null);
      await load(true);
    } catch (err) {
      setError(repairErrorMessage(err));
      throw err; // keep the form open
    } finally { setBusy(false); }
  };

  const toggleActive = async (d) => {
    setError('');
    try { await repairService.admin.updateDriver(d._id, { active: !d.active }); await load(true); } catch (err) { setError(repairErrorMessage(err)); }
  };
  const remove = async (d) => {
    if (!window.confirm(`Delete driver ${d.name}? Their login will be removed.`)) return;
    setError('');
    try { await repairService.admin.deleteDriver(d._id); await load(true); } catch (err) { setError(repairErrorMessage(err)); }
  };

  return (
    <div>
      <PageTitle
        title="Repair Drivers"
        subtitle="Drivers who pick up devices for repair and deliver them back"
        right={<button type="button" className={btnPrimary} onClick={() => setEditing({ name: '', phone: '', password: '', city: '', vehicleType: 'Two Wheeler', drivingLicenseNumber: '', repairOnly: true })}><Plus size={12} className="inline mr-1" />Add driver</button>}
      />
      <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl px-4 py-2.5 text-[11px] mb-3">
        Drivers sign in with their mobile number and password at <b>{window.location.origin}/captain/login</b>. Their repair jobs appear on the
        captain dashboard under <b>Repair Pickups &amp; Deliveries</b>. Assign them to bookings from Repair Bookings → Manage.
      </div>
      {error && !editing && <p className="text-xs font-bold text-rose-600">{error}</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2.5">Driver</th><th className="px-3 py-2.5">Vehicle</th><th className="px-3 py-2.5">City</th>
              <th className="px-3 py-2.5">Active jobs</th><th className="px-3 py-2.5">Completed</th><th className="px-3 py-2.5">Access</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-10"><Loader2 className="animate-spin inline text-[#ff5500]" /></td></tr>
              : list.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-slate-400">No repair drivers yet. Click “Add driver”.</td></tr>
              : list.map((d) => (
                <tr key={d._id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${d.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} title={d.isOnline ? 'Online' : 'Offline'} />
                      <div><div className="font-bold text-slate-800">{d.name}</div><div className="text-[10px] text-slate-400">{d.phone}</div></div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{d.vehicleType || '—'}{d.drivingLicenseNumber ? <div className="text-[10px] text-slate-400">DL {d.drivingLicenseNumber}</div> : null}</td>
                  <td className="px-3 py-2.5">{d.city || '—'}</td>
                  <td className="px-3 py-2.5 font-bold">{d.activeJobs}</td>
                  <td className="px-3 py-2.5">{d.completedJobs}</td>
                  <td className="px-3 py-2.5">{d.repairOnly ? 'Repair only' : 'Repair + orders'}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => toggleActive(d)} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer ${d.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {d.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right space-x-2 whitespace-nowrap">
                    <button type="button" className={btnGhost} onClick={() => setEditing({ ...d, password: '' })}>Edit</button>
                    <button type="button" className={btnDanger} onClick={() => remove(d)}><Trash2 size={12} className="inline" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <DriverForm initial={editing} busy={busy} error={error} onClose={() => { setEditing(null); setError(''); }} onSave={save} />}
    </div>
  );
};

const DriverForm = ({ initial, busy, error, onClose, onSave }) => {
  const [f, setF] = useState(initial);
  const [localError, setLocalError] = useState('');
  const set = (p) => { setLocalError(''); setF((x) => ({ ...x, ...p })); };
  const isNew = !f._id;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setLocalError('Driver name is required.');
    if (isNew && f.phone.length !== 10) return setLocalError('Enter a valid 10-digit mobile number.');
    if (isNew && f.password.length < 6) return setLocalError('Password must be at least 6 characters.');
    if (!isNew && f.password && f.password.length < 6) return setLocalError('Password must be at least 6 characters.');
    try { await onSave(f); } catch { /* error shown from parent */ }
    return undefined;
  };

  return (
    <Modal title={isNew ? 'Add repair driver' : `Edit ${initial.name}`} onClose={onClose}>
      <form autoComplete="off" onSubmit={submit} className="space-y-3">
        <Field label="Full name"><input className={input} value={f.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <Field label="Mobile number (login ID)">
          <input className={input} value={f.phone} maxLength={10} inputMode="numeric" disabled={!isNew} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })} required={isNew} />
        </Field>
        <Field label={isNew ? 'Password (min 6 characters)' : 'New password (leave blank to keep the current one)'}>
          <input className={input} type="password" autoComplete="new-password" value={f.password} onChange={(e) => set({ password: e.target.value })} required={isNew} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City"><input className={input} value={f.city || ''} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="Vehicle">
            <select className={input} value={f.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })}>
              {[...new Set([f.vehicleType, ...VEHICLE_TYPES].filter(Boolean))].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Driving licence number (optional)"><input className={input} value={f.drivingLicenseNumber || ''} onChange={(e) => set({ drivingLicenseNumber: e.target.value })} /></Field>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input type="checkbox" className="mt-0.5" checked={f.repairOnly !== false} onChange={(e) => set({ repairOnly: e.target.checked })} />
          <span><b>Repair only</b> — this driver will not be sent grocery / product delivery orders.</span>
        </label>
        {(localError || error) && <p className="text-xs font-bold text-rose-600 m-0">{localError || error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : isNew ? 'Add driver' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
};

/* REPAIR PROBLEMS & PRICING — the "Select problem" step customers see, per category ------------------------- */
export const RepairProblemsAdmin = () => {
  // Larger text on this page for readability
  const bigInput = 'w-full px-3.5 py-3 rounded-xl border border-slate-300 text-[15px] text-slate-900 outline-none focus:border-[#ff5500] bg-white';
  const bigPrimary = btnPrimary.replace('text-xs', 'text-[15px]').replace('px-3.5 py-2', 'px-5 py-3');
  const bigGhost = btnGhost.replace('text-xs', 'text-[15px]').replace('px-3.5 py-2', 'px-5 py-3');
  const bigDanger = btnDanger.replace('text-[11px]', 'text-sm').replace('px-3 py-1.5', 'px-3.5 py-2.5');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null); // { diagnosisFee, problems: [{ name, estimateMin, estimateMax }] }
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [openSubs, setOpenSubs] = useState({}); // row index -> sub-problems expanded

  const toDraft = (c) => ({
    diagnosisFee: c.diagnosisFee ?? 0,
    problems: (c.problems || []).map((p) => ({
      name: p.name,
      estimateMin: p.estimateMin ?? 0,
      estimateMax: p.estimateMax ?? 0,
      subProblems: (p.subProblems || []).map((sp) => ({ name: sp.name, estimateMin: sp.estimateMin ?? 0, estimateMax: sp.estimateMax ?? 0 })),
    })),
  });

  const load = useCallback(async (keepId) => {
    setLoading(true);
    try {
      const list = (await repairService.admin.listCategories())?.categories || [];
      setCategories(list);
      const id = keepId && list.some((c) => c._id === keepId) ? keepId : list[0]?._id || '';
      setSelectedId(id);
      const c = list.find((x) => x._id === id);
      setDraft(c ? toDraft(c) : null);
      setDirty(false);
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = categories.find((c) => c._id === selectedId);

  const choose = (id) => {
    if (id === selectedId) return;
    if (dirty && !window.confirm('You have unsaved changes for this category. Discard them?')) return;
    const c = categories.find((x) => x._id === id);
    setSelectedId(id);
    setDraft(c ? toDraft(c) : null);
    setDirty(false);
    setError('');
    setSaved('');
  };

  const edit = (patch) => { setDirty(true); setSaved(''); setError(''); setDraft((d) => ({ ...d, ...patch })); };
  const setRow = (i, patch) => edit({ problems: draft.problems.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setSub = (i, j, patch) =>
    edit({ problems: draft.problems.map((p, pi) => (pi === i ? { ...p, subProblems: p.subProblems.map((sp, sj) => (sj === j ? { ...sp, ...patch } : sp)) } : p)) });
  const addSub = (i) => {
    setOpenSubs((o) => ({ ...o, [i]: true }));
    edit({ problems: draft.problems.map((p, pi) => (pi === i ? { ...p, subProblems: [...p.subProblems, { name: '', estimateMin: '', estimateMax: '' }] } : p)) });
  };
  const removeSub = (i, j) =>
    edit({ problems: draft.problems.map((p, pi) => (pi === i ? { ...p, subProblems: p.subProblems.filter((_, sj) => sj !== j) } : p)) });
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.problems.length) return;
    const arr = [...draft.problems];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    edit({ problems: arr });
  };

  const save = async () => {
    const rows = draft.problems.filter((p) => p.name.trim());
    if (rows.length === 0) return setError('Add at least one problem — customers must be able to select one.');
    for (const p of rows) {
      const min = Number(p.estimateMin) || 0;
      const max = Number(p.estimateMax) || 0;
      if (min < 0 || max < 0) return setError(`“${p.name}”: prices cannot be negative.`);
      if (max > 0 && min > max) return setError(`“${p.name}”: the minimum price cannot be more than the maximum.`);
    }
    if (new Set(rows.map((p) => p.name.trim().toLowerCase())).size !== rows.length) return setError('Two problems have the same name. Please make each one unique.');
    for (const p of rows) {
      const subs = (p.subProblems || []).filter((sp) => sp.name.trim());
      for (const sp of subs) {
        const min = Number(sp.estimateMin) || 0;
        const max = Number(sp.estimateMax) || 0;
        if (min < 0 || max < 0) return setError(`“${p.name} → ${sp.name}”: prices cannot be negative.`);
        if (max > 0 && min > max) return setError(`“${p.name} → ${sp.name}”: the minimum price cannot be more than the maximum.`);
      }
      if (new Set(subs.map((sp) => sp.name.trim().toLowerCase())).size !== subs.length) return setError(`“${p.name}” has two sub-problems with the same name.`);
    }
    setBusy(true);
    setError('');
    try {
      await repairService.admin.updateCategory(selectedId, {
        diagnosisFee: Math.max(0, Number(draft.diagnosisFee) || 0),
        problems: rows.map((p) => ({
          name: p.name.trim(),
          estimateMin: Number(p.estimateMin) || 0,
          estimateMax: Number(p.estimateMax) || 0,
          subProblems: (p.subProblems || []).filter((sp) => sp.name.trim()).map((sp) => ({ name: sp.name.trim(), estimateMin: Number(sp.estimateMin) || 0, estimateMax: Number(sp.estimateMax) || 0 })),
        })),
      });
      await load(selectedId);
      setSaved('Saved. Customers see these problems and prices immediately.');
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const discard = () => { if (current) { setDraft(toDraft(current)); setDirty(false); setError(''); setSaved(''); } };

  if (loading) return <Loader2 className="animate-spin text-[#ff5500]" />;
  if (categories.length === 0) {
    return (
      <div>
        <PageTitle title="Problems & Pricing" subtitle="The problems customers can select, with their price estimates" />
        <p className="text-xs text-slate-500">No repair categories yet. Add one under <b>Repair Categories</b> first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Problems & Pricing" subtitle="Manage the “Select problem” list and price estimates customers see for each category" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button key={c._id} type="button" onClick={() => choose(c._id)}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold border cursor-pointer flex items-center gap-2 ${c._id === selectedId ? 'bg-[#ff5500] text-white border-[#ff5500]' : 'bg-white text-slate-700 border-slate-200'}`}>
            <span className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center"><RepairCategoryIcon name={c.icon} image={c.image} size={14} /></span>
            {c.name}
          </button>
        ))}
      </div>

      {draft && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-xl font-extrabold text-slate-900 m-0">{current?.name} — problems</h3>
              <label className="block">
                <span className="block text-sm font-bold text-slate-600 mb-1.5">Diagnosis fee (₹)</span>
                <input className={`${bigInput} w-40`} type="number" min="0" value={draft.diagnosisFee} onChange={(e) => edit({ diagnosisFee: e.target.value })} />
              </label>
            </div>

            <div className="hidden sm:grid grid-cols-[28px_1fr_140px_140px_auto] gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 px-1">
              <span /> <span>Problem</span> <span>Min price ₹</span> <span>Max price ₹</span> <span />
            </div>
            {draft.problems.map((p, i) => (
              <div key={i} className="space-y-2">
              <div className="grid grid-cols-[28px_1fr_100px_100px_auto] sm:grid-cols-[28px_1fr_140px_140px_auto] gap-2 items-center">
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="h-5 px-1 text-sm leading-none bg-transparent border-none cursor-pointer text-slate-500 hover:text-[#ff5500] disabled:opacity-30" aria-label="Move up">▲</button>
                  <button type="button" disabled={i === draft.problems.length - 1} onClick={() => move(i, 1)} className="h-5 px-1 text-sm leading-none bg-transparent border-none cursor-pointer text-slate-500 hover:text-[#ff5500] disabled:opacity-30" aria-label="Move down">▼</button>
                </div>
                <input className={bigInput} placeholder="e.g. Broken / cracked screen" maxLength={80} value={p.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                <input className={bigInput} type="number" min="0" placeholder="Min" value={p.estimateMin} onChange={(e) => setRow(i, { estimateMin: e.target.value })} />
                <input className={bigInput} type="number" min="0" placeholder="Max" value={p.estimateMax} onChange={(e) => setRow(i, { estimateMax: e.target.value })} />
                <button type="button" className={bigDanger} onClick={() => edit({ problems: draft.problems.filter((_, j) => j !== i) })} aria-label="Delete problem"><Trash2 size={12} /></button>
              </div>

              {/* Sub-problems: shown on the next booking page after the customer picks this problem */}
              <div className="ml-8 border-l-2 border-orange-300 pl-4 space-y-2.5 pb-1">
                <button type="button" onClick={() => setOpenSubs((o) => ({ ...o, [i]: !o[i] }))} className="text-sm font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0">
                  {openSubs[i] ? '▾' : '▸'} Sub-problems ({(p.subProblems || []).length}) {(p.subProblems || []).length === 0 && <span className="text-slate-500 font-medium">— customers go straight to the next step</span>}
                </button>
                {openSubs[i] && (
                  <div className="space-y-2">
                    {(p.subProblems || []).map((sp, j) => (
                      <div key={j} className="grid grid-cols-[1fr_100px_100px_auto] sm:grid-cols-[1fr_140px_140px_auto] gap-2 items-center">
                        <input className={bigInput} placeholder="e.g. Front glass only" maxLength={80} value={sp.name} onChange={(e) => setSub(i, j, { name: e.target.value })} />
                        <input className={bigInput} type="number" min="0" placeholder="Min" value={sp.estimateMin} onChange={(e) => setSub(i, j, { estimateMin: e.target.value })} />
                        <input className={bigInput} type="number" min="0" placeholder="Max" value={sp.estimateMax} onChange={(e) => setSub(i, j, { estimateMax: e.target.value })} />
                        <button type="button" className={bigDanger} onClick={() => removeSub(i, j)} aria-label="Delete sub-problem"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <button type="button" className="flex items-center gap-1 text-sm font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0" onClick={() => addSub(i)}>
                      <Plus size={12} /> Add sub-problem
                    </button>
                  </div>
                )}
              </div>
              </div>
            ))}
            <button type="button" className="flex items-center gap-1.5 text-[15px] font-bold text-[#ea580c] bg-transparent border-none cursor-pointer p-0" onClick={() => edit({ problems: [...draft.problems, { name: '', estimateMin: '', estimateMax: '' }] })}>
              <Plus size={13} /> Add problem
            </button>
            <p className="text-sm text-slate-500 m-0">Leave both prices as 0 to show the problem without a price estimate. Use the arrows to change the order customers see.</p>

            {error && <p className="text-sm font-bold text-rose-600 m-0">{error}</p>}
            {saved && <p className="text-sm font-bold text-emerald-600 m-0">{saved}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={bigGhost} disabled={!dirty || busy} onClick={discard}>Discard changes</button>
              <button type="button" className={bigPrimary} disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>

          <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-600 m-0 mb-3">Customer preview — “Select problem”</p>
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {draft.problems.filter((p) => p.name.trim()).map((p, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl px-3.5 py-3 flex flex-wrap justify-between gap-x-2 gap-y-1">
                  <span className="text-[15px] font-bold text-[#1e1b4b]">{p.name}</span>
                  {Number(p.estimateMax) > 0 && <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Est. {formatRupees(p.estimateMin)} – {formatRupees(p.estimateMax)}</span>}
                  {(p.subProblems || []).filter((sp) => sp.name.trim()).length > 0 && (
                    <div className="w-full">
                      <span className="text-xs font-semibold text-[#ea580c]">Next page: {(p.subProblems || []).filter((sp) => sp.name.trim()).map((sp) => sp.name).join(' · ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 m-0 mt-3">Diagnosis from {formatRupees(draft.diagnosisFee)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

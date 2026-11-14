import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, KeyRound, MapPin, Check, Circle, Loader2 } from 'lucide-react';
import { getUserSocket } from '../../../../services/userSocket';
import repairService, { repairErrorMessage, FINAL_REPAIR_STATUSES, REPAIR_STATUS_LABELS } from '../../../../services/repairService';
import { RepairStatusChip, RepairPageHeader, formatRupees, formatDateTime } from '../../../../components/repair/RepairUi';

// Main journey shown as a progress timeline
const JOURNEY = [
  { key: 'REQUESTED', label: 'Booking confirmed' },
  { key: 'PICKED_UP', label: 'Picked up by rider' },
  { key: 'AT_REPAIR_CENTER', label: 'Reached repair center' },
  { key: 'QUOTATION_SENT', label: 'Diagnosis & quotation' },
  { key: 'IN_REPAIR', label: 'Repair in progress' },
  { key: 'REPAIR_COMPLETED', label: 'Repair completed' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

// Map every status onto the furthest journey step it represents
const STEP_INDEX = {
  REQUESTED: 0, PICKUP_ASSIGNED: 0, PICKUP_ACCEPTED: 0, PICKUP_STARTED: 0, REACHED_CUSTOMER: 0,
  PICKED_UP: 1, CENTER_RIDE_STARTED: 1, REACHED_CENTER: 1,
  AT_REPAIR_CENTER: 2,
  DIAGNOSING: 2, QUOTATION_SENT: 3, QUOTATION_APPROVED: 3, QUOTATION_REJECTED: 3,
  IN_REPAIR: 4,
  REPAIR_COMPLETED: 5, DELIVERY_ASSIGNED: 5, DELIVERY_ACCEPTED: 5,
  OUT_FOR_DELIVERY: 6,
  DELIVERED: 7,
};

const RepairTrack = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await repairService.getMyBooking(id);
      if (res?.success) setBooking(res.booking);
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not load this repair.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Live updates from the server (rider assigned / on the way / reached…): refresh immediately
  useEffect(() => {
    const socket = getUserSocket();
    if (!socket) return undefined;
    const onUpdate = () => load();
    socket.on('repair:update', onUpdate);
    return () => socket.off('repair:update', onUpdate);
  }, [load]);

  // Refresh while the repair is in progress (hidden tabs skipped). Stops once delivered / cancelled.
  const isFinal = booking ? FINAL_REPAIR_STATUSES.includes(booking.status) : false;
  useEffect(() => {
    if (!booking || isFinal) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [booking?._id, isFinal, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn) => {
    setActing(true);
    setError('');
    try {
      const res = await fn();
      if (res?.booking) setBooking(res.booking);
      await load();
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#ff5500]" />
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[13px] text-slate-500 m-0">{error || 'Repair booking not found.'}</p>
        <button type="button" onClick={() => navigate('/repair')} className="px-5 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold border-none cursor-pointer">
          Back to Repairs
        </button>
      </div>
    );
  }

  const cancelled = booking.status === 'CANCELLED';
  const stepIdx = STEP_INDEX[booking.status] ?? 0;
  const q = booking.quotation || {};
  const phoneMode = booking.decisionMode === 'phone'; // admin discusses the diagnosis with the customer by phone
  const canCancel = ['REQUESTED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED'].includes(booking.status);
  const rider = ['DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'OUT_FOR_DELIVERY'].includes(booking.status)
    ? booking.deliveryCaptainId
    : booking.pickupCaptainId;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans w-full max-w-[480px] md:max-w-3xl mx-auto">
      <RepairPageHeader title="Repair Tracking" subtitle={`#${booking.bookingId}`} onBack={() => navigate('/repair')} />

      <div className="px-4 pt-4 space-y-3">
        {/* Summary */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[14px] font-extrabold text-[#1e1b4b] m-0">{booking.brand} {booking.model}</h2>
              <p className="text-[11px] font-semibold text-slate-400 m-0">{booking.categoryName} · {booking.problem}{booking.subProblem ? ` → ${booking.subProblem}` : ""}</p>
            </div>
            <RepairStatusChip status={booking.status} />
          </div>
          {booking.description && <p className="text-[12px] text-slate-600 m-0">{booking.description}</p>}
          {booking.photos?.length > 0 && (
            <div className="flex gap-2 pt-1">
              {booking.photos.map((p) => <img key={p} src={p} alt="Item" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />)}
            </div>
          )}
          <p className="text-[11px] font-semibold text-slate-400 m-0 flex items-center gap-1">
            <MapPin size={12} /> Pickup {booking.pickupSlot?.date}, {booking.pickupSlot?.timeSlot}
          </p>
        </div>

        {/* Live rider status */}
        {booking.status === 'PICKUP_STARTED' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-extrabold text-blue-900 m-0">Your rider is on the way</p>
              <p className="text-[11px] text-blue-700 m-0">{booking.pickupCaptainId?.name ? `${booking.pickupCaptainId.name} is heading to your address.` : 'The rider is heading to your address.'} Keep your pickup OTP ready.</p>
            </div>
            {booking.pickupCaptainId?.phone && (
              <a href={`tel:${booking.pickupCaptainId.phone}`} className="w-9 h-9 rounded-xl bg-white text-blue-700 flex items-center justify-center shrink-0"><Phone size={16} /></a>
            )}
          </div>
        )}
        {booking.status === 'REACHED_CUSTOMER' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-[13px] font-extrabold text-emerald-900 m-0">Your rider has arrived</p>
            <p className="text-[11px] text-emerald-700 m-0">Share the pickup OTP below with the rider to hand over your item.</p>
          </div>
        )}

        {booking.status === 'CENTER_RIDE_STARTED' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-[13px] font-extrabold text-blue-900 m-0">Your item is on its way to the repair center</p>
            <p className="text-[11px] text-blue-700 m-0">The rider is taking it to the repair center for diagnosis.</p>
          </div>
        )}
        {booking.status === 'REACHED_CENTER' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-[13px] font-extrabold text-emerald-900 m-0">Your item has reached the repair center</p>
            <p className="text-[11px] text-emerald-700 m-0">The handover is being confirmed. Diagnosis starts right after.</p>
          </div>
        )}

        {/* OTP for rider */}
        {booking.pickupOtp && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-800 m-0 flex items-center gap-1"><KeyRound size={12} /> Pickup OTP</p>
              <p className="text-[10px] text-amber-700 m-0">
                {['REQUESTED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED'].includes(booking.status)
                  ? 'Keep this ready. Share it only with the rider when they arrive to collect your item.'
                  : 'Share only with the rider when they arrive to collect your item.'}
              </p>
            </div>
            <span className="text-[22px] font-black tracking-[6px] text-amber-900">{booking.pickupOtp}</span>
          </div>
        )}
        {booking.deliveryOtp && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-800 m-0 flex items-center gap-1"><KeyRound size={12} /> Delivery OTP</p>
              <p className="text-[10px] text-emerald-700 m-0">Share with the rider only after you receive your repaired item.</p>
            </div>
            <span className="text-[22px] font-black tracking-[6px] text-emerald-900">{booking.deliveryOtp}</span>
          </div>
        )}

        {/* Quotation */}
        {phoneMode && booking.status === 'QUOTATION_SENT' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
            <p className="text-[13px] font-extrabold text-amber-900 m-0">Diagnosis completed</p>
            {booking.diagnosis?.findings && <p className="text-[12px] text-amber-900 m-0"><b>Problem found:</b> {booking.diagnosis.findings}</p>}
            <p className="text-[11px] text-amber-800 m-0">Our team will call you shortly to discuss the repair and the cost. No action is needed in the app.</p>
          </div>
        )}

        {q.status && q.status !== 'None' && !(phoneMode && q.status === 'Sent') && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-extrabold text-[#1e1b4b] m-0">{phoneMode ? 'Repair Cost (agreed by phone)' : 'Repair Quotation'}</h3>
              <span className="text-[10px] font-extrabold uppercase text-slate-400">{q.status}</span>
            </div>
            {booking.diagnosis?.findings && (
              <p className="text-[12px] text-slate-600 m-0"><b>Diagnosis:</b> {booking.diagnosis.findings}</p>
            )}
            <div className="space-y-1">
              {q.items.map((it, i) => (
                <div key={`${it.label}-${i}`} className="flex justify-between text-[12px] font-semibold text-slate-600">
                  <span>{it.label}</span><span>{formatRupees(it.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-extrabold text-[#1e1b4b] border-t border-slate-100 pt-1.5">
                <span>Total</span><span>{formatRupees(q.total)}</span>
              </div>
            </div>
            {q.estimatedDays > 0 && <p className="text-[11px] text-slate-500 m-0">Estimated repair time: {q.estimatedDays} day(s)</p>}
            {q.notes && <p className="text-[11px] text-slate-500 m-0">{q.notes}</p>}
            <p className="text-[10px] text-slate-400 m-0">
              If you approve, the diagnosis fee is included. If you reject, only the diagnosis fee ({formatRupees(booking.diagnosisFee)}) is payable on return delivery.
            </p>

            {booking.status === 'QUOTATION_SENT' && !phoneMode && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Add a note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#ff5500]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => act(() => repairService.respondToQuotation(booking._id, 'reject', note))}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-600 text-[12px] font-extrabold cursor-pointer disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => act(() => repairService.respondToQuotation(booking._id, 'approve', note))}
                    className="flex-1 py-2.5 rounded-xl bg-[#ff5500] text-white text-[12px] font-extrabold border-none cursor-pointer disabled:opacity-60"
                  >
                    Approve {formatRupees(q.total)}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rider / center */}
        {(rider?.name || booking.repairCenter) && !cancelled && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2">
            {rider?.name && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase m-0">Your rider</p>
                  <p className="text-[13px] font-extrabold text-[#1e1b4b] m-0">{rider.name}</p>
                </div>
                {rider.phone && (
                  <a href={`tel:${rider.phone}`} className="w-9 h-9 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center">
                    <Phone size={16} />
                  </a>
                )}
              </div>
            )}
            {booking.repairCenter && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase m-0">Repair center</p>
                <p className="text-[12px] font-semibold text-slate-600 m-0">{booking.repairCenter.name}{booking.repairCenter.city ? `, ${booking.repairCenter.city}` : ''}</p>
              </div>
            )}
          </div>
        )}

        {/* Bill */}
        {booking.amountDue > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase m-0">Amount payable on delivery</p>
              <p className="text-[11px] text-slate-500 m-0">{booking.paymentStatus === 'Paid' ? `Paid (${booking.paymentMethod || 'collected'})` : 'Pay the rider after confirming delivery'}</p>
            </div>
            <span className="text-[16px] font-black text-[#1e1b4b]">{formatRupees(booking.amountDue)}</span>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <h3 className="text-[13px] font-extrabold text-[#1e1b4b] m-0 mb-3">Progress</h3>
          {cancelled ? (
            <p className="text-[12px] font-bold text-rose-600 m-0">Cancelled{booking.cancelReason ? ` — ${booking.cancelReason}` : ''}</p>
          ) : (
            <ol className="m-0 p-0 list-none space-y-3">
              {JOURNEY.map((s, i) => {
                const done = i <= stepIdx && !(booking.status === 'REQUESTED' && i > 0);
                const current = i === stepIdx;
                return (
                  <li key={s.key} className="flex items-start gap-3">
                    <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[#ff5500] text-white' : 'bg-slate-100 text-slate-300'}`}>
                      {done ? <Check size={12} /> : <Circle size={8} />}
                    </span>
                    <div>
                      <p className={`text-[12px] m-0 ${done ? 'font-extrabold text-[#1e1b4b]' : 'font-semibold text-slate-400'}`}>{s.label}</p>
                      {current && <p className="text-[10px] text-[#ea580c] font-bold m-0">{REPAIR_STATUS_LABELS[booking.status]}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {booking.statusHistory?.length > 0 && (
            <details className="mt-3">
              <summary className="text-[11px] font-bold text-slate-400 cursor-pointer">Activity log</summary>
              <ul className="m-0 mt-2 p-0 list-none space-y-1">
                {[...booking.statusHistory].reverse().map((h, i) => (
                  <li key={`${h.at}-${i}`} className="text-[10px] text-slate-500">
                    <b>{REPAIR_STATUS_LABELS[h.status] || h.status}</b> · {formatDateTime(h.at)}{h.note ? ` — ${h.note}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {error && <p className="text-[12px] font-bold text-rose-600 m-0">{error}</p>}

        {canCancel && (
          <button
            type="button"
            disabled={acting}
            onClick={() => { if (window.confirm('Cancel this repair booking?')) act(() => repairService.cancelMyBooking(booking._id, 'Cancelled by customer')); }}
            className="w-full py-3 rounded-xl bg-white border border-rose-200 text-rose-600 text-[12px] font-extrabold cursor-pointer disabled:opacity-60"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </div>
  );
};

export default RepairTrack;

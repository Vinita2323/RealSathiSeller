import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wrench, Volume2, VolumeX, MapPin, Phone, X, Truck } from 'lucide-react';
import repairService from '../../../services/repairService';
import { useAdmin } from '../context/useAdmin';

export const REPAIR_OPEN_BOOKING_KEY = 'sathiseller_repair_open_booking';
export const REPAIR_OPEN_BOOKING_EVENT = 'repair-open-booking';

/**
 * Alerts the admin about Repair & Services events, same idea as the seller's new-order popup:
 *  - "New Repair Request"  → a customer booked a repair (status REQUESTED)
 *  - "Rider at Repair Center" → a rider reached the center and needs the handover OTP from admin
 * Polls one lightweight feed while the admin panel is open (any page) and rings the order sound.
 * The first poll is only a baseline, so items that already existed don't pop up on page load.
 */
const keyOf = (kind, item) => `${kind}:${String(item._id)}`;

const RepairRequestNotifier = () => {
  const { setActiveTab } = useAdmin();
  const [active, setActive] = useState(null); // { kind: 'request' | 'arrival', ...booking }
  const [muted, setMuted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const knownRef = useRef(new Set());
  const baselineRef = useRef(false);
  const queueRef = useRef([]);
  const activeKeyRef = useRef(null);
  const mutedRef = useRef(false);
  const audioRef = useRef(null);
  const pollingRef = useRef(false);

  const chime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* audio unavailable */ }
  };

  const play = () => {
    if (mutedRef.current) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/SellerOrder.mpeg');
        audioRef.current.loop = true;
      }
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      if (p !== undefined) p.catch(chime); // autoplay blocked → fall back to a short chime
    } catch { chime(); }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const showNext = useCallback(() => {
    if (activeKeyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeKeyRef.current = keyOf(next.kind, next);
    setActive(next);
    play();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    activeKeyRef.current = null;
    setActive(null);
    stop();
    showNext();
  }, [showNext]);

  const poll = useCallback(async () => {
    if (pollingRef.current || document.hidden) return;
    pollingRef.current = true;
    try {
      const res = await repairService.admin.getNewRequests();
      if (!res?.success) return;
      setPendingCount(res.count || 0);
      const items = [
        ...(res.requests || []).map((r) => ({ ...r, kind: 'request' })),
        ...(res.arrivals || []).map((r) => ({ ...r, kind: 'arrival' })),
      ];
      if (!baselineRef.current) {
        items.forEach((it) => knownRef.current.add(keyOf(it.kind, it)));
        baselineRef.current = true;
        return;
      }
      for (const it of items) {
        const k = keyOf(it.kind, it);
        if (knownRef.current.has(k)) continue;
        knownRef.current.add(k);
        queueRef.current.push(it);
      }
      // Close the popup if it was already handled elsewhere (request assigned / cancelled, rider verified)
      if (activeKeyRef.current && !items.some((it) => keyOf(it.kind, it) === activeKeyRef.current)) {
        activeKeyRef.current = null;
        setActive(null);
        stop();
      }
      showNext();
    } catch { /* silent: background poll */ } finally {
      pollingRef.current = false;
    }
  }, [showNext]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 10000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      stop();
    };
  }, [poll]);

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) stop();
    else if (activeKeyRef.current) play();
  };

  // readOnly=true → "View Details" (read-only); false → "Accept & Assign Rider" / "Open Booking" (manage view)
  const openBooking = (readOnly) => {
    if (!active) return;
    const detail = { id: String(active._id), readOnly };
    try { sessionStorage.setItem(REPAIR_OPEN_BOOKING_KEY, JSON.stringify(detail)); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(REPAIR_OPEN_BOOKING_EVENT, { detail }));
    setActiveTab('repair_bookings');
    close();
  };

  if (!active) return null;

  const isArrival = active.kind === 'arrival';

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/55 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className={`${isArrival ? 'bg-gradient-to-r from-[#15803d] to-[#22a559]' : 'bg-gradient-to-r from-[#ff5500] to-[#ff8a3d]'} text-white px-5 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">{isArrival ? <Truck size={18} /> : <Wrench size={18} />}</div>
            <div>
              <p className="text-[15px] font-extrabold m-0 leading-tight">{isArrival ? 'Rider at Repair Center' : 'New Repair Request'}</p>
              <p className="text-[11px] font-semibold m-0 opacity-90">#{active.bookingId}{!isArrival && pendingCount > 1 ? ` · ${pendingCount} waiting` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleMute} className="w-8 h-8 rounded-lg bg-white/20 border-none text-white cursor-pointer flex items-center justify-center" aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button type="button" onClick={close} className="w-8 h-8 rounded-lg bg-white/20 border-none text-white cursor-pointer flex items-center justify-center" aria-label="Dismiss"><X size={15} /></button>
          </div>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <div>
            <p className="text-sm font-extrabold text-slate-900 m-0">{active.brand} {active.model}</p>
            <p className="text-slate-500 m-0">{active.categoryName} · {active.problem}{active.subProblem ? ` → ${active.subProblem}` : ""}</p>
          </div>

          {isArrival ? (
            <>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="m-0 flex items-center gap-1.5 text-slate-700 font-semibold"><Truck size={12} /> Rider: {active.pickupCaptainId?.name || 'Rider'}{active.pickupCaptainId?.phone ? ` · ${active.pickupCaptainId.phone}` : ''}</p>
                {active.repairCenter?.name && <p className="m-0 text-slate-500">Center: {active.repairCenter.name}</p>}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="m-0 text-[11px] font-bold text-amber-800">Handover OTP — give it to the rider after you receive the device</p>
                <p className="m-0 mt-1 text-3xl font-black tracking-[8px] text-amber-900">{active.centerOtp || '—'}</p>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="m-0 flex items-center gap-1.5 text-slate-700 font-semibold"><Phone size={12} /> {active.pickupAddress?.fullName || 'Customer'} · {active.pickupAddress?.phone}</p>
              <p className="m-0 flex items-center gap-1.5 text-slate-600"><MapPin size={12} /> {active.pickupAddress?.city || '—'} · pickup {active.pickupSlot?.date}, {active.pickupSlot?.timeSlot}</p>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button type="button" onClick={() => openBooking(false)} className="w-full py-2.5 rounded-xl bg-[#ff5500] text-white text-xs font-extrabold border-none cursor-pointer">
              {isArrival ? 'Open Booking' : 'Accept & Assign Rider'}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => openBooking(true)} className="flex-1 py-2.5 rounded-xl bg-white border border-[#ff5500] text-[#ea580c] text-xs font-bold cursor-pointer">View Details</button>
              <button type="button" onClick={close} className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Later</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepairRequestNotifier;

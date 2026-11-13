import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, MapPin, Phone, Building2, Volume2, VolumeX } from 'lucide-react';
import repairService, { repairErrorMessage } from '../../../services/repairService';
import { markJobAsDismissed, isJobDismissed } from '../utils/jobDismissal';

/**
 * Live "new repair job" popup for drivers.
 * When admin assigns a repair pickup / delivery (to a driver added under Repair & Services or to any
 * captain), the driver sees this popup on whichever captain page they are on, with the ring sound.
 * Polls one lightweight endpoint while the app is visible; stops quietly when there is no captain token.
 */
const offerKeyOf = (o) => `repair:${o.bookingId}:${o.offerType}:${o.updatedAt || ''}`;

const RepairJobNotifier = () => {
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);

  const activeKeyRef = useRef(null);
  const mutedRef = useRef(false);
  const audioRef = useRef(null);
  const pollingRef = useRef(false);

  const stopSound = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };
  const playSound = () => {
    if (mutedRef.current) return;
    try {
      if (!audioRef.current) { audioRef.current = new Audio('/DeliveryAppRing.mpeg'); audioRef.current.loop = true; }
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      if (p !== undefined) p.catch(() => {}); // autoplay may be blocked until the first tap
    } catch { /* audio unavailable */ }
  };

  const clear = useCallback(() => {
    activeKeyRef.current = null;
    setOffer(null);
    setError('');
    stopSound();
  }, []);

  const poll = useCallback(async () => {
    if (pollingRef.current || document.hidden) return;
    if (!localStorage.getItem('sathiseller_captain_token')) return;
    pollingRef.current = true;
    try {
      const res = await repairService.captain.getPending();
      const offers = (res?.offers || []).filter((o) => !isJobDismissed(offerKeyOf(o)));

      // The offer on screen was withdrawn / re-assigned by admin → close it
      if (activeKeyRef.current && !offers.some((o) => offerKeyOf(o) === activeKeyRef.current)) {
        clear();
      }
      if (!activeKeyRef.current && offers.length > 0) {
        activeKeyRef.current = offerKeyOf(offers[0]);
        setOffer(offers[0]);
        playSound();
      }
    } catch { /* silent background poll */ } finally {
      pollingRef.current = false;
    }
  }, [clear]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 8000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); stopSound(); };
  }, [poll]);

  const dismiss = () => {
    if (offer) markJobAsDismissed(offerKeyOf(offer));
    clear();
  };

  const accept = async () => {
    if (!offer) return;
    setBusy(true);
    setError('');
    try {
      await repairService.captain.accept(offer._id);
      markJobAsDismissed(offerKeyOf(offer));
      clear();
      navigate('/captain/repair-jobs');
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not accept this job.'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!offer) return;
    setBusy(true);
    setError('');
    try {
      await repairService.captain.reject(offer._id);
      markJobAsDismissed(offerKeyOf(offer));
      clear();
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not reject this job.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) stopSound(); else if (activeKeyRef.current) playSound();
  };

  if (!offer) return null;

  const isDelivery = offer.offerType === 'delivery';
  const addr = offer.pickupAddress || {};
  const customerAddress = [addr.addressLine1, addr.addressLine2, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/55 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#15803d] to-[#22a559] text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Wrench size={18} /></div>
            <div>
              <p className="text-[15px] font-extrabold m-0 leading-tight">{isDelivery ? 'New Repair Delivery' : 'New Repair Pickup'}</p>
              <p className="text-[11px] font-semibold m-0 opacity-90">#{offer.bookingId}</p>
            </div>
          </div>
          <button type="button" onClick={toggleMute} className="w-8 h-8 rounded-lg bg-white/20 border-none text-white cursor-pointer flex items-center justify-center" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div>
            <p className="text-sm font-extrabold text-slate-900 m-0">{offer.brand} {offer.model}</p>
            <p className="text-slate-500 m-0">{offer.categoryName} · {offer.problem}</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            {isDelivery && offer.repairCenter && (
              <p className="m-0 flex items-start gap-1.5 text-slate-700 font-semibold"><Building2 size={13} className="mt-0.5 shrink-0" /> Collect from: {offer.repairCenter.name}{offer.repairCenter.address ? `, ${offer.repairCenter.address}` : ''}</p>
            )}
            <p className="m-0 flex items-start gap-1.5 text-slate-700"><MapPin size={13} className="mt-0.5 shrink-0" /> {isDelivery ? 'Deliver to: ' : 'Pick up from: '}{customerAddress || '—'}</p>
            {addr.phone && <p className="m-0 flex items-center gap-1.5 text-slate-600"><Phone size={13} /> {addr.fullName || 'Customer'} · {addr.phone}</p>}
            {!isDelivery && <p className="m-0 text-slate-500">Slot: {offer.pickupSlot?.date}, {offer.pickupSlot?.timeSlot}</p>}
          </div>

          {error && <p className="m-0 font-bold text-rose-600">{error}</p>}

          <div className="space-y-2 pt-0.5">
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={reject} className="flex-1 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-600 text-xs font-extrabold cursor-pointer disabled:opacity-60">Reject</button>
              <button type="button" disabled={busy} onClick={accept} className="flex-[2] py-2.5 rounded-xl bg-[#15803d] text-white text-xs font-extrabold border-none cursor-pointer disabled:opacity-60">{busy ? 'Please wait…' : `Accept ${isDelivery ? 'Delivery' : 'Pickup'}`}</button>
            </div>
            <button type="button" disabled={busy} onClick={() => { dismiss(); navigate('/captain/repair-jobs'); }} className="w-full py-2 rounded-xl bg-transparent border-none text-slate-500 text-[11px] font-bold cursor-pointer">View in Repair Jobs (decide later)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepairJobNotifier;

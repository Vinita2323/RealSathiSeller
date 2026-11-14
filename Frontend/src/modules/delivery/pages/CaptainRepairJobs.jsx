import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Building2, Loader2 } from 'lucide-react';
import repairService, { repairErrorMessage } from '../../../services/repairService';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { RepairStatusChip, RepairPageHeader, formatRupees } from '../../../components/repair/RepairUi';

const TABS = [
  { id: 'pickups', label: 'Pickups' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'history', label: 'History' },
];

// Google Maps directions to the customer (uses coordinates when the address has them)
const mapsLink = (addr = {}) => {
  const hasCoords = Number.isFinite(Number(addr.lat)) && Number.isFinite(Number(addr.lng)) && addr.lat !== null && addr.lng !== null;
  const dest = hasCoords
    ? `${addr.lat},${addr.lng}`
    : [addr.addressLine1, addr.addressLine2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
};

// Google Maps directions to the repair center
const centerMapsLink = (c = {}) => {
  const hasCoords = Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) && c.lat !== null && c.lng !== null;
  const dest = hasCoords ? `${c.lat},${c.lng}` : (c.fullAddress || [c.name, c.address, c.city].filter(Boolean).join(', '));
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
};

// Where the parcel is dropped / collected: the repair center, or the admin's address when no center is set
const dropOf = (job) => job.dropLocation || job.repairCenter || null;
const dropText = (d) => d.fullAddress || [d.address, d.city].filter(Boolean).join(', ');
const centerInfo = (job) => {
  const d = dropOf(job);
  return d ? (
    <p className="text-[11px] font-semibold text-slate-600 m-0 flex items-start gap-1.5">
      <Building2 size={13} className="mt-0.5 shrink-0" />
      <span>Take to: {d.source === 'admin' ? 'Admin' : d.name} — {dropText(d)}{d.phone ? ` · ${d.phone}` : ''}</span>
    </p>
  ) : (
    <p className="text-[11px] font-semibold text-amber-700 m-0">Drop-off address is not set yet — please ask admin where to take the item.</p>
  );
};

const CaptainRepairJobs = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pickups');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [otps, setOtps] = useState({});
  const [payMethod, setPayMethod] = useState({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await repairService.captain.getJobs(tab);
      setJobs(res?.bookings || []);
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not load repair jobs.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(true); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (id, fn, success) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      if (success) setOtps((o) => ({ ...o, [id]: '' }));
      await load(true);
    } catch (err) {
      setError(repairErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const Btn = ({ onClick, children, tone = 'primary', disabled }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex-1 min-w-0 px-3 py-3 rounded-xl text-[13px] leading-tight text-center font-extrabold cursor-pointer disabled:opacity-60 border ${
        tone === 'primary' ? 'bg-[#15803d] text-white border-[#15803d]' : 'bg-white text-rose-600 border-rose-200'
      }`}
    >
      {children}
    </button>
  );

  // Plain render function (not a component) so the input keeps focus while typing
  const renderOtpRow = ({ job, placeholder, onSubmit, label }) => (
    <div className="space-y-2">
      <input
        type="tel"
        inputMode="numeric"
        maxLength={4}
        placeholder={placeholder}
        value={otps[job._id] || ''}
        onChange={(e) => setOtps((o) => ({ ...o, [job._id]: e.target.value.replace(/\D/g, '') }))}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center text-[18px] font-black tracking-[8px] outline-none focus:border-[#15803d]"
      />
      <Btn disabled={busyId === job._id || (otps[job._id] || '').length !== 4} onClick={() => onSubmit(otps[job._id])}>
        {busyId === job._id ? 'Please wait…' : label}
      </Btn>
    </div>
  );

  const renderActions = (job) => {
    const id = job._id;
    switch (job.status) {
      case 'PICKUP_ASSIGNED':
        return (
          <div className="flex gap-2">
            <Btn tone="danger" disabled={busyId === id} onClick={() => run(id, () => repairService.captain.reject(id))}>Reject</Btn>
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.accept(id))}>Accept Pickup</Btn>
          </div>
        );
      case 'PICKUP_ACCEPTED':
        return (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 m-0">Tap below when you leave. The customer will see that you are on the way.</p>
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.startRide(id))}>
              {busyId === id ? 'Please wait…' : 'Start Ride to Customer'}
            </Btn>
          </div>
        );
      case 'PICKUP_STARTED':
        return (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#15803d] m-0">You are on the way to the customer.</p>
            <a
              href={mapsLink(job.pickupAddress)}
              target="_blank"
              rel="noreferrer"
              className="block w-full px-3 py-3 text-center rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] leading-tight font-extrabold no-underline"
            >
              Open navigation
            </a>
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.reached(id))}>
              {busyId === id ? 'Please wait…' : "I've Reached the Customer"}
            </Btn>
          </div>
        );
      case 'REACHED_CUSTOMER':
        return (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#15803d] m-0">You have reached. Ask the customer for their pickup OTP.</p>
            {renderOtpRow({
              job,
              placeholder: 'Customer pickup OTP',
              label: 'Verify OTP & Pick Up',
              onSubmit: (otp) => run(id, () => repairService.captain.verifyPickupOtp(id, otp), true),
            })}
          </div>
        );
      case 'PICKED_UP':
        return (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#15803d] m-0">Item picked up. Take it to the repair center.</p>
            {centerInfo(job)}
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.startCenterRide(id))}>
              {busyId === id ? 'Please wait…' : 'Start Ride to Repair Center'}
            </Btn>
          </div>
        );
      case 'CENTER_RIDE_STARTED':
        return (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#15803d] m-0">You are on the way to the repair center.</p>
            {centerInfo(job)}
            {dropOf(job) && (
              <a href={centerMapsLink(dropOf(job))} target="_blank" rel="noreferrer" className="block w-full px-3 py-3 text-center rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] leading-tight font-extrabold no-underline">
                Open navigation
              </a>
            )}
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.reachedCenter(id))}>
              {busyId === id ? 'Please wait…' : "I've Reached the Repair Center"}
            </Btn>
          </div>
        );
      case 'REACHED_CENTER':
        return (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#15803d] m-0">You have reached the repair center. Ask the center staff for the handover OTP.</p>
            {renderOtpRow({
              job,
              placeholder: 'Repair center OTP',
              label: 'Verify OTP & Hand Over',
              onSubmit: (otp) => run(id, () => repairService.captain.verifyCenterOtp(id, otp), true),
            })}
          </div>
        );
      case 'DELIVERY_ASSIGNED':
        return (
          <div className="flex gap-2">
            <Btn tone="danger" disabled={busyId === id} onClick={() => run(id, () => repairService.captain.reject(id))}>Reject</Btn>
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.accept(id))}>Accept Delivery</Btn>
          </div>
        );
      case 'DELIVERY_ACCEPTED':
        return (
          <div className="space-y-2">
            {dropOf(job) && (
              <p className="text-[11px] font-semibold text-slate-600 m-0 flex items-start gap-1.5">
                <Building2 size={13} className="mt-0.5 shrink-0" />
                <span>Collect from: {dropOf(job).source === 'admin' ? 'Admin' : dropOf(job).name} — {dropText(dropOf(job))}</span>
              </p>
            )}
            {dropOf(job) && (
              <a href={centerMapsLink(dropOf(job))} target="_blank" rel="noreferrer" className="block w-full px-3 py-3 text-center rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] leading-tight font-extrabold no-underline">
                Open navigation
              </a>
            )}
            <Btn disabled={busyId === id} onClick={() => run(id, () => repairService.captain.collect(id))}>
              Collected — Start Delivery
            </Btn>
          </div>
        );
      case 'OUT_FOR_DELIVERY': {
        const method = payMethod[id] || 'CASH';
        return (
          <div className="space-y-2">
            {job.amountDue > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1.5">
                <p className="text-[12px] font-extrabold text-amber-900 m-0">Collect {formatRupees(job.amountDue)} from customer</p>
                <div className="flex gap-2">
                  {['CASH', 'ONLINE'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod((p) => ({ ...p, [id]: m }))}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        method === m ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-800 border-amber-200'
                      }`}
                    >
                      {m === 'CASH' ? 'Cash received' : 'Paid online / UPI'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {renderOtpRow({
              job,
              placeholder: 'Customer delivery OTP',
              label: 'Verify OTP & Deliver',
              onSubmit: (otp) => run(id, () => repairService.captain.verifyDeliveryOtp(id, otp, method), true),
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans w-full max-w-md mx-auto">
      <RepairPageHeader title="Repair Jobs" subtitle="Pickups & deliveries" onBack={() => navigate('/captain/dashboard')} />

      <div className="px-4 pt-4 space-y-3">
        <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${
                tab === t.id ? 'bg-[#15803d] text-white' : 'bg-transparent text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-[12px] font-bold text-rose-600 m-0">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#15803d]" /></div>
        ) : jobs.length === 0 ? (
          <p className="text-[12px] text-slate-400 text-center py-10 m-0">
            {tab === 'pickups' ? 'No repair pickups assigned to you.' : tab === 'deliveries' ? 'No repair deliveries assigned to you.' : 'No repair history yet.'}
          </p>
        ) : (
          jobs.map((job) => {
            const addr = job.pickupAddress || {};
            return (
              <div key={job._id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-[#1e1b4b] m-0 truncate">{job.brand} {job.model}</p>
                    <p className="text-[11px] font-semibold text-slate-400 m-0">{job.categoryName} · #{job.bookingId}</p>
                  </div>
                  <RepairStatusChip status={job.status} />
                </div>
                <p className="text-[11px] text-slate-600 m-0">Problem: {job.problem}{job.subProblem ? ` → ${job.subProblem}` : ""}</p>
                <div className="text-[11px] text-slate-600 flex items-start gap-1.5">
                  <MapPin size={13} className="mt-0.5 shrink-0" />
                  <span>
                    {[addr.addressLine1, addr.addressLine2, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(', ')}
                    <br />
                    <span className="text-slate-400">{job.pickupSlot?.date} · {job.pickupSlot?.timeSlot}</span>
                  </span>
                </div>
                {addr.phone && (
                  <a href={`tel:${addr.phone}`} className="text-[11px] font-bold text-[#15803d] flex items-center gap-1.5 no-underline">
                    <Phone size={13} /> {addr.fullName || 'Customer'} · {addr.phone}
                  </a>
                )}
                {tab !== 'history' && renderActions(job)}
              </div>
            );
          })
        )}
      </div>
      <CaptainBottomNav />
    </div>
  );
};

export default CaptainRepairJobs;

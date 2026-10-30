import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { transportService } from '../../../services/transportService';
import { markJobAsDismissed } from '../utils/jobDismissal';

const NewJobRequest = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('id');

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJobRequest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transportService.captainGetRequests();
      const requests = res.requests || [];
      if (requests.length > 0) {
        if (requestedId) {
          const matched = requests.find(
            (r) => r.bookingId === requestedId || r._id === requestedId
          );
          setJob(matched || requests[0]);
        } else {
          setJob(requests[0]);
        }
      } else {
        setJob(null);
      }
    } catch (err) {
      console.error('Fetch job request error:', err);
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [requestedId]);

  useEffect(() => {
    fetchJobRequest();
  }, [fetchJobRequest]);

  const handleAccept = async () => {
    if (!job) return;
    setActionLoading(true);
    try {
      const bookingId = job.bookingId || job._id;
      await transportService.captainAcceptRequest(bookingId);
      markJobAsDismissed(job);
      navigate(`/captain/active-delivery?type=transport&bookingId=${bookingId}`);
    } catch (err) {
      console.error('Accept job error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to accept shipment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!job) {
      navigate('/captain/dashboard');
      return;
    }
    setActionLoading(true);
    try {
      const bookingId = job.bookingId || job._id;
      await transportService.captainRejectRequest(bookingId);
      markJobAsDismissed(job);
      navigate('/captain/dashboard');
    } catch (err) {
      console.error('Reject job error:', err);
      navigate('/captain/dashboard');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#002625] min-h-screen flex flex-col items-center justify-center gap-3 text-white">
        <span className="material-symbols-outlined text-4xl text-[#97fc43] animate-spin">sync</span>
        <p className="text-xs font-bold text-slate-300">Loading Job Request Telemetry…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <span className="material-symbols-outlined text-3xl">task_alt</span>
        </div>
        <h2 className="text-lg font-black text-slate-800 mb-1">No Pending Shipment Requests</h2>
        <p className="text-xs text-slate-500 max-w-xs mb-6">
          There are currently no new transport requests matching your vehicle. Check back shortly.
        </p>
        <button
          onClick={() => navigate('/captain/dashboard')}
          className="px-6 py-3 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const tripId = job.bookingId || job._id;
  const earnings = job.estimatedEarnings || job.captainEarnings || 0;
  const pickupAddress =
    (typeof job.pickupLocation === 'string' ? job.pickupLocation : job.pickupLocation?.address) ||
    'Pickup Location';
  const dropAddress =
    (typeof job.dropLocation === 'string' ? job.dropLocation : job.dropLocation?.address) ||
    'Drop Destination';
  const distanceKm = job.distanceKm ? `${job.distanceKm} km` : 'In Range';
  const estTime = job.estimatedDurationMin ? `${job.estimatedDurationMin} mins` : '15-25 mins';
  const packages = job.goods?.packages ? `${job.goods.packages} Boxes` : 'Freight';
  const paymentMethod = job.paymentMethod || 'Prepaid';
  const vehicleName = job.vehicleSnapshot?.name || 'Transport Fleet';

  return (
    <div className="bg-[#f8fafc] text-slate-800 font-sans min-h-screen flex flex-col justify-between">
      {/* Top Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-3 bg-[#002625] text-white shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/captain/dashboard')}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <span className="text-[9px] font-black uppercase text-[#97fc43] tracking-wider block leading-none">
              NEW TRANSPORT REQUEST
            </span>
            <span className="text-xs font-mono font-bold text-white block mt-0.5">
              #{tripId}
            </span>
          </div>
        </div>
      </header>

      {/* Main Request Card */}
      <main className="pt-18 pb-24 px-4 max-w-md mx-auto w-full space-y-3.5 flex-1">
        {/* Earnings Card */}
        <div className="bg-gradient-to-tr from-[#002625] to-[#0a3d16] text-white p-4.5 rounded-2xl shadow-md flex items-center justify-between border border-white/10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#97fc43] block">
              ESTIMATED EARNINGS
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-bold text-[#97fc43]">₹</span>
              <span className="text-3xl font-black text-white font-mono">
                {Number(earnings).toFixed(2)}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-[#97fc43]/20 text-[#97fc43] text-[10px] font-black uppercase tracking-wider rounded-lg border border-[#97fc43]/40">
            ACTIVE NOW
          </span>
        </div>

        {/* Route Timeline */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block pb-1 border-b border-slate-100">
            ROUTE INFORMATION
          </span>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#047857] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xs">storefront</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-[#047857] uppercase tracking-wider block">
                  PICKUP LOCATION
                </span>
                <p className="font-bold text-xs text-slate-900 leading-snug">
                  {pickupAddress}
                </p>
              </div>
            </div>

            <div className="pl-2.5 my-0">
              <div className="w-0.5 h-3 bg-slate-200"></div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-[#ff5500] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xs">location_on</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-[#ff5500] uppercase tracking-wider block">
                  DROP DESTINATION
                </span>
                <p className="font-bold text-xs text-slate-900 leading-snug">
                  {dropAddress}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
              DISTANCE
            </span>
            <span className="text-sm font-black text-slate-800 block mt-0.5">
              {distanceKm}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
              EST. TIME
            </span>
            <span className="text-sm font-black text-[#15803d] block mt-0.5">
              {estTime}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
              PACKAGES
            </span>
            <span className="text-sm font-black text-slate-800 block mt-0.5">
              {packages}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
              PAYMENT
            </span>
            <span className="text-sm font-black text-slate-800 block mt-0.5">
              {paymentMethod}
            </span>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#15803d] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-lg">local_shipping</span>
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
              VEHICLE REQUIRED
            </span>
            <span className="text-xs font-bold text-slate-900 block">
              {vehicleName}
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Actions */}
      <footer className="fixed bottom-0 left-0 w-full z-40 bg-white border-t border-slate-200/80 p-3.5 shadow-lg">
        <div className="max-w-md mx-auto flex gap-2.5">
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Reject Job
          </button>

          <button
            onClick={handleAccept}
            disabled={actionLoading}
            className="flex-1 py-3 bg-[#15803d] hover:bg-[#166534] text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors disabled:opacity-60"
          >
            {actionLoading ? 'Accepting…' : 'Accept Shipment'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default NewJobRequest;

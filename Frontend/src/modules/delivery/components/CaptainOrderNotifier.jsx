import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import IncomingGigModal from './IncomingGigModal';
import { captainService } from '../../../services/authService';
import { transportService } from '../../../services/transportService';
import { markJobAsDismissed, isJobDismissed } from '../utils/jobDismissal';

/**
 * CaptainOrderNotifier
 * Global background listener for Delivery Captains.
 * Polls for newly assigned delivery jobs/orders and transport requests across ANY captain page.
 * When a new order/delivery arrives, triggers ringing with /DeliveryAppRing.mpeg and pops up IncomingGigModal.
 */
const CaptainOrderNotifier = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [incomingJob, setIncomingJob] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const isDashboard = location.pathname === '/captain/dashboard';

  const checkIncomingGigs = useCallback(async () => {
    // Only check if captain token is present
    const captainToken = localStorage.getItem('sathiseller_captain_token');
    const isOnline = localStorage.getItem('sathiseller_captain_online') !== 'false';
    if (!captainToken || !isOnline) return;
    // Don't poll in a background tab, or while the captain is busy on an active delivery screen
    if (document.hidden || location.pathname.startsWith('/captain/active-delivery')) return;

    // If currently on dashboard, CaptainDashboard handles its own modal rendering
    if (isDashboard) {
      if (incomingJob) setIncomingJob(null);
      return;
    }

    try {
      const res = await captainService.getDashboardStats();
      if (res && res.success) {
        const orders = res.pendingOrders || [];
        const tRequests = res.transportRequests || [];

        // Check for new transport requests
        const newTransport = tRequests.find((t) => !isJobDismissed(t));
        if (newTransport && (!incomingJob || incomingJob._id !== newTransport._id)) {
          setIncomingJob({ ...newTransport, isTransport: true });
          return;
        }

        // Check for newly assigned e-commerce orders
        const newAssignedOrder = orders.find(
          (o) => o.captainStatus === 'Assigned' && !isJobDismissed(o)
        );
        if (newAssignedOrder && (!incomingJob || incomingJob._id !== newAssignedOrder._id)) {
          setIncomingJob({ ...newAssignedOrder, isTransport: false });
          return;
        }

        // If active incoming job is no longer pending/assigned
        if (incomingJob) {
          const stillActive = incomingJob.isTransport
            ? tRequests.some((t) => (t._id === incomingJob._id || t.bookingId === incomingJob.bookingId))
            : orders.some((o) => (o._id === incomingJob._id || o.orderId === incomingJob.orderId) && o.captainStatus === 'Assigned');
          if (!stillActive) {
            setIncomingJob(null);
          }
        }
      }
    } catch (err) {
      // Background poll silent catch
    }
  }, [isDashboard, incomingJob, location.pathname]);

  useEffect(() => {
    checkIncomingGigs();
    const interval = setInterval(checkIncomingGigs, 8000);
    return () => clearInterval(interval);
  }, [checkIncomingGigs]);

  const handleAcceptJob = async (job) => {
    if (!job) return;
    setActionLoading(true);
    try {
      markJobAsDismissed(job);
      if (job.isTransport) {
        const bookingId = job.bookingId || job._id;
        await transportService.captainAcceptRequest(bookingId);
      } else {
        const orderId = job.orderId || job._id;
        await captainService.acceptJob(orderId);
      }
      setIncomingJob(null);
      if (job.isTransport) {
        navigate(`/captain/active-delivery?type=transport&bookingId=${job.bookingId || job._id}`);
      } else {
        navigate(`/captain/active-delivery?type=order&orderId=${job.orderId || job._id}`);
      }
    } catch (err) {
      console.error('Accept job error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to accept delivery.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectJob = async (job) => {
    if (!job) return;
    markJobAsDismissed(job);
    setIncomingJob(null);
    setActionLoading(true);
    try {
      const id = job.bookingId || job.orderId || job._id;
      if (job.isTransport) {
        await transportService.captainRejectRequest(id);
      } else {
        await captainService.rejectJob(id);
      }
    } catch (err) {
      console.error('Reject job error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissModal = (job) => {
    if (job) markJobAsDismissed(job);
    setIncomingJob(null);
  };

  // If on dashboard, CaptainDashboard handles modal; otherwise CaptainOrderNotifier handles it
  if (isDashboard || !incomingJob) return null;

  return (
    <IncomingGigModal
      job={incomingJob}
      onAccept={handleAcceptJob}
      onReject={handleRejectJob}
      onClose={() => handleDismissModal(incomingJob)}
      actionLoading={actionLoading}
    />
  );
};

export default CaptainOrderNotifier;

/**
 * jobDismissal.js
 * Persistent storage utility (localStorage) for captain dismissed / accepted / rejected job IDs.
 * Ensures popups NEVER reappear on any screen once a job is accepted, rejected, or closed.
 */

const DISMISSED_JOBS_STORAGE_KEY = 'sathiseller_captain_dismissed_jobs';

export const getDismissedJobIds = () => {
  try {
    const raw = localStorage.getItem(DISMISSED_JOBS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
};

const offerKey = (jobOrId) => {
  if (!jobOrId) return '';
  if (typeof jobOrId === 'string') return jobOrId;
  const id = String(jobOrId.orderId || jobOrId.bookingId || jobOrId._id || '');
  const stamp = jobOrId.captainAssignedAt || jobOrId.assignedAt || '';
  if (!stamp) return id;
  const when = new Date(stamp);
  return Number.isNaN(when.getTime()) ? id : `${id}@${when.toISOString()}`;
};

export const markJobAsDismissed = (jobOrId) => {
  if (!jobOrId) return;
  try {
    const set = getDismissedJobIds();
    set.add(offerKey(jobOrId));
    localStorage.setItem(DISMISSED_JOBS_STORAGE_KEY, JSON.stringify([...set]));
  } catch (e) {
    console.error('Error saving dismissed job:', e);
  }
};

export const isJobDismissed = (jobOrId) => {
  if (!jobOrId) return true;
  return getDismissedJobIds().has(offerKey(jobOrId));
};

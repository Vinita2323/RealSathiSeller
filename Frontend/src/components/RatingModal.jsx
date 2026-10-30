import React, { useState } from 'react';
import { Star, X, Check, Loader2, Sparkles, ThumbsUp, ThumbsDown, User } from 'lucide-react';
import ratingService from '../services/ratingService';

const POSITIVE_TAGS = [
  'Smooth Driving',
  'Polite Captain',
  'Clean Vehicle',
  'On Time',
  'Safe Ride',
  'Great Navigation',
];

const CRITICAL_TAGS = [
  'Late Arrival',
  'Rash Driving',
  'Vehicle Cleanliness',
  'Route Issue',
  'Rude Behavior',
  'Payment Issue',
];

const RATING_DESCRIPTIONS = {
  5: { label: 'Great ride! 🌟', color: 'text-amber-500 bg-amber-50 border-amber-200' },
  4: { label: 'Good ride 👍', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  3: { label: 'Average ride 😐', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  2: { label: 'Could be better 😕', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  1: { label: 'Poor experience 😞', color: 'text-rose-600 bg-rose-50 border-rose-200' },
};

const RatingModal = ({
  isOpen,
  onClose,
  ride,
  role = 'user', // 'user' rating captain OR 'captain' rating user
  onSuccess,
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !ride) return null;

  const isUserRatingCaptain = role === 'user';

  // Target Information
  const targetName = isUserRatingCaptain
    ? ride.captainId?.name || ride.captainName || 'Captain Partner'
    : ride.user?.name || ride.customerName || 'Customer';

  const targetPhoto = isUserRatingCaptain
    ? ride.captainId?.documents?.profilePhoto || ride.captainPhoto
    : ride.userPhoto;

  const vehicleInfo = isUserRatingCaptain
    ? ride.vehicleSnapshot?.name || ride.captainId?.vehicleType || 'Transport Vehicle'
    : `Trip #${ride.bookingId || ride.orderId || ''}`;

  const fareAmount =
    ride.fareBreakdown?.totalFare ??
    ride.totalFare ??
    ride.captainEarnings ??
    ride.fare ??
    0;

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!rating || rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const rideId = ride.bookingId || ride.orderId || ride._id;
      const res = await ratingService.submitRating({
        rideId,
        rating,
        review: review.trim(),
        feedbackTags: selectedTags,
      });

      if (onSuccess) {
        onSuccess(res);
      }
      onClose();
    } catch (err) {
      console.error('Submit rating error:', err);
      setError(err?.message || 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeRating = hoverRating || rating;
  const activeDesc = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];
  const currentTags = activeRating >= 4 ? POSITIVE_TAGS : CRITICAL_TAGS;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle for mobile drag visual */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        {/* Modal Header */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          {/* Paid Fare Pill (Uber/Rapido style) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
            <Check size={13} strokeWidth={3} className="text-emerald-600" />
            <span>Paid ₹{fareAmount}</span>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors border-none"
            title="Skip rating"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-2 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden">
          {/* Avatar & Target Info */}
          <div className="flex flex-col items-center text-center space-y-2 pt-1">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-emerald-50 bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white text-2xl font-black shadow-md overflow-hidden">
                {targetPhoto ? (
                  <img src={targetPhoto} alt={targetName} className="w-full h-full object-cover" />
                ) : (
                  <span>{targetName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-xs">
                <Sparkles size={12} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                How was your ride with {targetName}?
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{vehicleInfo}</p>
            </div>
          </div>

          {/* 5 Interactive Rating Stars */}
          <div className="flex flex-col items-center space-y-2 py-1">
            <div className="flex items-center gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 rounded-xl transition-all transform hover:scale-125 active:scale-95 border-none bg-transparent cursor-pointer"
                  >
                    <Star
                      size={36}
                      className={`transition-colors duration-150 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)]'
                          : 'fill-slate-100 text-slate-300'
                      }`}
                      strokeWidth={1.5}
                    />
                  </button>
                );
              })}
            </div>

            {/* Rating Descriptor Badge */}
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all duration-200 ${activeDesc.color}`}
            >
              {activeDesc.label}
            </div>
          </div>

          {/* Contextual Feedback Chips */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              {activeRating >= 4 ? 'What did you like most?' : 'What could be improved?'}
            </span>

            <div className="flex flex-wrap justify-center gap-2">
              {currentTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-[1.02]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Review Textarea */}
          <div className="pt-1">
            <textarea
              rows={2}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Leave additional comments (optional)..."
              maxLength={500}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-center text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
              {error}
            </p>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 px-6 border-t border-slate-100 space-y-2 bg-white shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 border-none disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Submitting Rating...</span>
              </>
            ) : (
              <span>Done / Submit Rating</span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full py-2 bg-transparent text-slate-400 hover:text-slate-600 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors text-center"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;

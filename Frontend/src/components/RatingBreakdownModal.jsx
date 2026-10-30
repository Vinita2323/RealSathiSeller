import React, { useState, useEffect } from 'react';
import { Star, X, Loader2, Award, Calendar, MessageSquare, Tag } from 'lucide-react';
import ratingService from '../services/ratingService';

const RatingBreakdownModal = ({ isOpen, onClose, targetId, targetType = 'captain', targetName = 'Partner' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !targetId) return;

    const fetchBreakdown = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await ratingService.getRatingBreakdown(targetType, targetId);
        setData(res);
      } catch (err) {
        console.error('Fetch breakdown error:', err);
        setError('Failed to load rating statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [isOpen, targetId, targetType]);

  if (!isOpen) return null;

  const stats = data?.stats || {
    ratingAverage: 0,
    ratingCount: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    topTags: [],
  };

  const total = stats.ratingCount || 0;
  const avg = stats.ratingAverage || 0;
  const recentReviews = data?.recentReviews || [];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[88vh] animate-in fade-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle visual */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-emerald-600" />
            <h3 className="text-sm font-black text-slate-900 capitalize">
              {targetName}'s Ratings & Reviews
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer border-none transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={28} className="animate-spin text-emerald-600" />
              <span className="text-xs font-semibold">Loading ratings & reviews...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-slate-500 text-xs">{error}</div>
          ) : (
            <>
              {/* Overall Score Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    Overall Rating
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-4xl font-black tracking-tight">{avg > 0 ? avg.toFixed(1) : '—'}</span>
                    <span className="text-sm font-bold text-slate-400">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= Math.round(avg) ? 'fill-amber-400' : 'fill-slate-700 text-slate-700'}
                      />
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    Total Ratings
                  </span>
                  <span className="text-2xl font-black text-emerald-400 mt-0.5 block">{total}</span>
                  <span className="text-[11px] text-slate-400 font-medium">Verified trips</span>
                </div>
              </div>

              {/* Star Breakdown Progress Bars */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                <span className="text-xs font-extrabold text-slate-800 block mb-2">Rating Breakdown</span>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.breakdown[star] || 0;
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-8 font-bold text-slate-600 flex items-center gap-0.5 shrink-0">
                        <span>{star}</span> <Star size={11} className="fill-amber-400 text-amber-400 inline" />
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="w-12 text-right text-[11px] font-semibold text-slate-500 shrink-0">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Top Compliments / Feedback Tags */}
              {stats.topTags && stats.topTags.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Tag size={13} className="text-emerald-600" />
                    <span>Top Feedback Received</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {stats.topTags.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>{item.tag}</span>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded-full">
                          {item.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Reviews List */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-emerald-600" />
                  <span>Recent Customer Reviews</span>
                </span>

                {recentReviews.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No detailed written reviews yet.
                  </div>
                ) : (
                  recentReviews.map((r) => (
                    <div
                      key={r._id}
                      className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{r.reviewerName}</span>
                        <div className="flex items-center gap-1 text-amber-400">
                          <span className="text-xs font-extrabold text-slate-800 mr-1">{r.rating}</span>
                          {[...Array(r.rating)].map((_, i) => (
                            <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>

                      {r.review && <p className="text-xs text-slate-600 m-0 leading-relaxed">{r.review}</p>}

                      {r.feedbackTags && r.feedbackTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {r.feedbackTags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                        <Calendar size={10} />
                        {new Date(r.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl border-none cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingBreakdownModal;

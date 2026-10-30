import React from 'react';

export const PageSkeleton = () => {
  return (
    <div className="w-full min-h-[100dvh] bg-white p-4 sm:p-6 max-w-7xl mx-auto animate-pulse space-y-6 select-none">
      {/* Header Bar Skeleton */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-xl" />
          <div className="space-y-1.5">
            <div className="w-32 h-4 bg-slate-200 rounded-md" />
            <div className="w-20 h-3 bg-slate-100 rounded-md" />
          </div>
        </div>
        <div className="w-24 h-9 bg-slate-200 rounded-xl" />
      </div>

      {/* Hero / Banner Skeleton */}
      <div className="w-full h-40 sm:h-56 bg-slate-200 rounded-2xl" />

      {/* Grid Content Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 space-y-3 shadow-2xs">
            <div className="w-full aspect-square bg-slate-200 rounded-xl" />
            <div className="space-y-1.5">
              <div className="w-3/4 h-3.5 bg-slate-200 rounded" />
              <div className="w-1/2 h-3 bg-slate-100 rounded" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="w-14 h-4 bg-slate-200 rounded" />
              <div className="w-8 h-8 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PageSkeleton;

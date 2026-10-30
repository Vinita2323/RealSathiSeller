import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService } from '../../../services/authService';

const CaptainServiceAreas = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [captainCity, setCaptainCity] = useState('');

  useEffect(() => {
    fetchServiceAreas();
  }, []);

  const fetchServiceAreas = async () => {
    setLoading(true);
    try {
      const res = await captainService.getServiceAreas();
      if (res.success) {
        setSellers(res.sellers || []);
        setCaptainCity(res.captainCity || '');
      }
    } catch (err) {
      console.error('Fetch service areas error:', err);
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sellers.filter((s) => {
    if (filter === 'IN RANGE') return s.status === 'IN RANGE';
    if (filter === 'OUT') return s.status === 'OUT OF RANGE';
    return true;
  });

  const inRangeCount = sellers.filter((s) => s.status === 'IN RANGE').length;

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen pb-24">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-sm border-b border-outline-variant/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl text-on-surface-variant">arrow_back</span>
            </button>
            <div>
              <h1 className="font-bold text-sm text-primary leading-tight">Sellers in Your Area</h1>
              <p className="text-[10px] text-on-surface-variant">
                {captainCity ? `Showing sellers in ${captainCity}` : 'Stores that include your location'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchServiceAreas}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-lg text-on-surface-variant ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </header>

      <main className="pt-20 px-3.5 max-w-2xl mx-auto space-y-3 mt-2">

        {/* Summary Banner */}
        <div className="glass-panel rounded-2xl p-3.5 flex items-center gap-3 border border-white/60">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-secondary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-xl">location_on</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-primary">Active Service Areas</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              You are currently in <span className="font-semibold text-primary">{inRangeCount}</span> seller{inRangeCount !== 1 ? 's' : ''} service radius
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse inline-block"></span>
            <span className="text-lg font-extrabold text-secondary leading-none">{inRangeCount}</span>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['ALL', 'IN RANGE', 'OUT'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                filter === tab
                  ? 'bg-secondary text-white border-secondary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:border-secondary/40'
              }`}
            >
              {tab === 'OUT' ? 'OUT OF RANGE' : tab}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-5xl text-secondary animate-spin">sync</span>
            <p className="text-sm text-on-surface-variant font-semibold">Finding sellers nearby…</p>
          </div>
        )}

        {/* Seller Cards */}
        {!loading && (
          <div className="space-y-2.5">
            {filtered.map((seller) => (
              <div
                key={seller._id || seller.name}
                className="glass-panel rounded-2xl p-4 border border-white/60 hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-primary">{seller.name}</span>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          seller.status === 'IN RANGE'
                            ? 'bg-secondary/15 text-secondary'
                            : 'bg-error/10 text-error'
                        }`}
                      >
                        {seller.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-on-surface-variant text-xs">location_on</span>
                      <span className="text-[11px] text-on-surface-variant truncate">{seller.address}{seller.city ? `, ${seller.city}` : ''}</span>
                    </div>
                  </div>

                  <div className="w-10 h-10 shrink-0 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary text-xl">storefront</span>
                  </div>
                </div>

                <div className="flex gap-6 border-t border-outline-variant/20 pt-2.5">
                  <div>
                    <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider">Distance</p>
                    <p className="font-extrabold text-sm text-primary mt-0.5">{seller.distance}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider">Service Radius</p>
                    <p className="font-extrabold text-sm text-primary mt-0.5">{seller.serviceRadius}</p>
                  </div>
                  {seller.status === 'IN RANGE' && (
                    <div className="ml-auto flex items-center">
                      <span className="text-[9px] font-black text-secondary uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse inline-block"></span>
                        ACTIVE
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filtered.length === 0 && !loading && (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-2 block">location_off</span>
                <p className="text-sm font-semibold">
                  {sellers.length === 0 ? 'No sellers found in your area' : 'No sellers match this filter.'}
                </p>
                {sellers.length === 0 && (
                  <p className="text-xs mt-1">Make sure your working area is set in your profile.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <CaptainBottomNav />
    </div>
  );
};

export default CaptainServiceAreas;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Wrench, ShieldCheck, Truck, BadgeCheck } from 'lucide-react';
import repairService, { DEFAULT_REPAIR_HERO } from '../../../../services/repairService';
import {
  RepairCategoryIcon, RepairStatusChip, RepairPageHeader, formatRupees, formatDateTime,
} from '../../../../components/repair/RepairUi';

const FINAL = ['DELIVERED', 'CANCELLED'];
const HERO_ICONS = [Truck, BadgeCheck, ShieldCheck, Wrench];

const RepairHome = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [hero, setHero] = useState(DEFAULT_REPAIR_HERO);
  const [tab, setTab] = useState('book'); // book | active | history
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cat, bk] = await Promise.all([
          repairService.getCatalog(),
          repairService.getMyBookings().catch(() => ({ bookings: [] })),
        ]);
        if (cancelled) return;
        setCategories(cat?.categories || []);
        if (cat?.content?.hero) setHero({ ...DEFAULT_REPAIR_HERO, ...cat.content.hero, features: cat.content.hero.features || [] });
        setBookings(bk?.bookings || []);
      } catch {
        /* handled by empty state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const active = bookings.filter((b) => !FINAL.includes(b.status));
  const history = bookings.filter((b) => FINAL.includes(b.status));

  const BookingRow = ({ b }) => (
    <button
      type="button"
      onClick={() => navigate(`/repair/booking/${b._id}`)}
      className="w-full text-left bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-orange-200 transition-colors"
    >
      <div className="min-w-0 flex flex-col gap-1">
        <span className="text-[13px] font-extrabold text-[#1e1b4b] truncate">
          {b.brand} {b.model} · {b.categoryName}
        </span>
        <span className="text-[11px] font-medium text-slate-500 truncate">{b.problem}</span>
        <div className="flex items-center gap-2 flex-wrap">
          <RepairStatusChip status={b.status} />
          <span className="text-[10px] font-semibold text-slate-400">#{b.bookingId} · {formatDateTime(b.createdAt)}</span>
        </div>
        {b.status === 'QUOTATION_SENT' && (
          <span className="text-[11px] font-bold text-amber-700">Quotation {formatRupees(b.quotation?.total)} waiting for your approval</span>
        )}
      </div>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );

  const tabs = [
    { id: 'book', label: 'Book Repair' },
    { id: 'active', label: `Tracking${active.length ? ` (${active.length})` : ''}` },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans w-full max-w-[480px] md:max-w-3xl mx-auto">
      <RepairPageHeader title="Repair & Services" subtitle="Pickup · Repair · Delivery" onBack={() => navigate('/')} />

      <div className="px-4 pt-4 space-y-4">
        <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer transition-colors ${
                tab === t.id ? 'bg-[#ff5500] text-white' : 'bg-transparent text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'book' && (
          <>
            {hero.enabled && (
              <div className="bg-gradient-to-r from-[#ff5500] to-[#ff8a3d] rounded-xl px-3 py-2.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Wrench size={15} className="shrink-0" />
                  <h2 className="text-[13px] font-extrabold m-0 leading-tight">{hero.title}</h2>
                </div>
                {hero.subtitle && (
                  <p className="text-[11px] font-medium m-0 mt-0.5 opacity-95 leading-snug line-clamp-2">{hero.subtitle}</p>
                )}
                {hero.features.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] font-bold">
                    {hero.features.map((text, i) => {
                      const Icon = HERO_ICONS[i % HERO_ICONS.length];
                      return <span key={`${text}-${i}`} className="flex items-center gap-1 whitespace-nowrap"><Icon size={11} /> {text}</span>;
                    })}
                  </div>
                )}
              </div>
            )}

            <h3 className="text-[14px] font-extrabold text-[#1e1b4b] m-0">What do you need repaired?</h3>
            {loading ? (
              <p className="text-[12px] text-slate-400">Loading…</p>
            ) : categories.length === 0 ? (
              <p className="text-[12px] text-slate-400">Repair services are not available right now.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {categories.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => navigate(`/repair/book?category=${c._id}`)}
                    className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex flex-col items-start gap-2 cursor-pointer hover:border-orange-200 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ea580c] overflow-hidden">
                      <RepairCategoryIcon name={c.icon} image={c.image} />
                    </div>
                    <span className="text-[13px] font-extrabold text-[#1e1b4b]">{c.name}</span>
                    <span className="text-[10px] font-semibold text-slate-400">Diagnosis from {formatRupees(c.diagnosisFee)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'active' && (
          active.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-10">No repairs in progress.</p>
          ) : (
            <div className="space-y-3">{active.map((b) => <BookingRow key={b._id} b={b} />)}</div>
          )
        )}

        {tab === 'history' && (
          history.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-10">No completed repairs yet.</p>
          ) : (
            <div className="space-y-3">{history.map((b) => <BookingRow key={b._id} b={b} />)}</div>
          )
        )}
      </div>
    </div>
  );
};

export default RepairHome;

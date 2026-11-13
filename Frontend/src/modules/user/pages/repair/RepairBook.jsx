import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, X, MapPin, Plus, Check, Loader2 } from 'lucide-react';
import repairService, { repairErrorMessage } from '../../../../services/repairService';
import { addressService } from '../../../../services/authService';
import { RepairCategoryIcon, RepairPageHeader, formatRupees } from '../../../../components/repair/RepairUi';

const TIME_SLOTS = ['09:00 AM - 11:00 AM', '11:00 AM - 01:00 PM', '01:00 PM - 03:00 PM', '03:00 PM - 05:00 PM', '05:00 PM - 07:00 PM'];
const STEP_TITLES = ['Select item', 'Brand & model', 'Select problem', 'Describe & photos', 'Pickup address', 'Pickup date & time', 'Confirm booking'];

const pad = (n) => String(n).padStart(2, '0');
const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const next7Days = () => {
  const days = [];
  const base = new Date();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    days.push({
      iso: toIsoDate(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      sub: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }
  return days;
};

const RepairBook = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCategory = params.get('category');

  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [otherBrand, setOtherBrand] = useState(false); // customer types their own brand/model
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    categoryId: '',
    brand: '',
    model: '',
    problem: '',
    description: '',
    photos: [],
    addressId: '',
    date: '',
    timeSlot: '',
  });
  const set = (patch) => { setError(''); setForm((f) => ({ ...f, ...patch })); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cat, addr] = await Promise.all([
          repairService.getCatalog(),
          addressService.getAddresses().catch(() => ({ addresses: [] })),
        ]);
        if (cancelled) return;
        const list = cat?.categories || [];
        setCategories(list);
        const addrList = addr?.addresses || [];
        setAddresses(addrList);
        const defaultAddr = addrList.find((a) => a.isDefault) || addrList[0];
        const preset = list.find((c) => c._id === presetCategory);
        setForm((f) => ({
          ...f,
          categoryId: preset ? preset._id : f.categoryId,
          addressId: defaultAddr ? defaultAddr._id : f.addressId,
        }));
        if (preset) setStep(1);
      } catch (err) {
        if (!cancelled) setError(repairErrorMessage(err, 'Could not load repair services.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [presetCategory]);

  const category = useMemo(() => categories.find((c) => c._id === form.categoryId), [categories, form.categoryId]);
  const brand = useMemo(() => category?.brands?.find((b) => b.name === form.brand), [category, form.brand]);
  const address = useMemo(() => addresses.find((a) => a._id === form.addressId), [addresses, form.addressId]);
  const days = useMemo(() => next7Days(), []);

  const validate = () => {
    if (step === 0 && !form.categoryId) return 'Please select what you want to repair.';
    if (step === 1 && (!form.brand.trim() || !form.model.trim())) {
      return otherBrand ? 'Please enter the brand name and model.' : 'Please select brand and model.';
    }
    if (step === 2 && !form.problem) return 'Please select the problem.';
    if (step === 3 && !form.description.trim()) return 'Please describe the issue.';
    if (step === 4 && !address) return 'Please select a pickup address.';
    if (step === 5 && (!form.date || !form.timeSlot)) return 'Please select pickup date and time.';
    return '';
  };

  const goNext = () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError('');
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };
  const goBack = () => {
    setError('');
    if (step === 0) navigate('/repair');
    else setStep((s) => s - 1);
  };

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - form.photos.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const urls = [];
      for (const file of files) {
        const url = await repairService.uploadPhoto(file);
        if (url) urls.push(url);
      }
      set({ photos: [...form.photos, ...urls] });
    } catch (err) {
      setError(repairErrorMessage(err, 'Photo upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await repairService.createBooking({
        categoryId: form.categoryId,
        brand: form.brand,
        model: form.model,
        problem: form.problem,
        description: form.description,
        photos: form.photos,
        pickupDate: form.date,
        pickupTimeSlot: form.timeSlot,
        pickupAddress: {
          fullName: address.fullName,
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          lat: address.location?.coordinates?.[1],
          lng: address.location?.coordinates?.[0],
        },
      });
      if (res?.success) navigate(`/repair/booking/${res.booking._id}`, { replace: true });
    } catch (err) {
      setError(repairErrorMessage(err, 'Could not place your repair booking.'));
    } finally {
      setSubmitting(false);
    }
  };

  const optionCls = (selected) =>
    `w-full text-left px-3.5 py-3 rounded-xl border text-[13px] font-bold cursor-pointer transition-colors ${
      selected ? 'border-[#ff5500] bg-orange-50 text-[#ea580c]' : 'border-slate-100 bg-white text-[#1e1b4b]'
    }`;
  const isLast = step === STEP_TITLES.length - 1;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-28 font-sans w-full max-w-[480px] md:max-w-3xl mx-auto">
      <RepairPageHeader title="Book a Repair" subtitle={`Step ${step + 1} of ${STEP_TITLES.length} · ${STEP_TITLES[step]}`} onBack={goBack} />
      <div className="h-1 bg-slate-100">
        <div className="h-1 bg-[#ff5500] transition-all" style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }} />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading && <p className="text-[12px] text-slate-400">Loading…</p>}

        {!loading && step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {categories.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => { setOtherBrand(false); set({ categoryId: c._id, brand: '', model: '', problem: '' }); }}
                className={`rounded-2xl p-3.5 border flex flex-col items-start gap-2 cursor-pointer text-left ${
                  form.categoryId === c._id ? 'border-[#ff5500] bg-orange-50' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ea580c] overflow-hidden">
                  <RepairCategoryIcon name={c.icon} image={c.image} />
                </div>
                <span className="text-[13px] font-extrabold text-[#1e1b4b]">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && step === 1 && category && (
          <>
            <p className="text-[12px] font-bold text-slate-500 m-0">Brand</p>
            <div className="space-y-2">
              {category.brands.map((b) => (
                <button key={b.name} type="button" className={optionCls(!otherBrand && form.brand === b.name)} onClick={() => { setOtherBrand(false); set({ brand: b.name, model: '' }); }}>
                  {b.name}
                </button>
              ))}
              <button type="button" className={optionCls(otherBrand)} onClick={() => { setOtherBrand(true); set({ brand: '', model: '' }); }}>
                Other (type brand name)
              </button>
            </div>
            {otherBrand && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Enter brand name (e.g. Realme, Nothing, Motorola)"
                  value={form.brand}
                  onChange={(e) => set({ brand: e.target.value })}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#ff5500] bg-white"
                />
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Enter model name / number"
                  value={form.model}
                  onChange={(e) => set({ model: e.target.value })}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#ff5500] bg-white"
                />
              </div>
            )}
            {!otherBrand && brand && (
              <>
                <p className="text-[12px] font-bold text-slate-500 m-0 pt-2">Model</p>
                <div className="space-y-2">
                  {brand.models.map((m) => (
                    <button key={m} type="button" className={optionCls(form.model === m)} onClick={() => set({ model: m })}>
                      {m}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Model not listed? Type it here"
                    value={brand.models.includes(form.model) ? '' : form.model}
                    onChange={(e) => set({ model: e.target.value })}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#ff5500]"
                  />
                </div>
              </>
            )}
          </>
        )}

        {!loading && step === 2 && category && (
          <div className="space-y-2">
            {category.problems.map((p) => (
              <button key={p.name} type="button" className={optionCls(form.problem === p.name)} onClick={() => set({ problem: p.name })}>
                <div className="flex justify-between gap-2">
                  <span>{p.name}</span>
                  {p.estimateMax > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                      Est. {formatRupees(p.estimateMin)} – {formatRupees(p.estimateMax)}
                    </span>
                  )}
                </div>
              </button>
            ))}
            <p className="text-[10px] text-slate-400 m-0 pt-1">
              Estimates are indicative only. You will get a final quotation after diagnosis and pay only if you approve it.
            </p>
          </div>
        )}

        {!loading && step === 3 && (
          <>
            <textarea
              rows={4}
              maxLength={800}
              placeholder="Describe the issue in detail (when it started, what happens, any damage…)"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#ff5500] resize-none bg-white"
            />
            <p className="text-[12px] font-bold text-slate-500 m-0">Photos of the item ({form.photos.length}/6)</p>
            <div className="flex gap-2 flex-wrap">
              {form.photos.map((url, i) => (
                <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                  <img src={url} alt={`Item ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set({ photos: form.photos.filter((p) => p !== url) })}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center border-none cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {form.photos.length < 6 && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center gap-1 bg-white cursor-pointer disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  <span className="text-[10px] font-bold">{uploading ? 'Uploading' : 'Add photo'}</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
          </>
        )}

        {!loading && step === 4 && (
          <>
            {addresses.length === 0 && (
              <p className="text-[12px] text-slate-500 m-0">You have no saved address yet. Add one to continue.</p>
            )}
            <div className="space-y-2">
              {addresses.map((a) => (
                <button key={a._id} type="button" className={optionCls(form.addressId === a._id)} onClick={() => set({ addressId: a._id })}>
                  <div className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-extrabold">{a.fullName} · {a.addressType || 'Home'}</div>
                      <div className="text-[11px] font-medium text-slate-500 whitespace-normal">
                        {[a.addressLine1, a.addressLine2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                      </div>
                      <div className="text-[11px] font-medium text-slate-400">{a.phone}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/saved-addresses')}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-slate-300 text-[12px] font-bold text-slate-500 bg-white cursor-pointer"
            >
              <Plus size={14} /> Add / manage addresses
            </button>
          </>
        )}

        {!loading && step === 5 && (
          <>
            <p className="text-[12px] font-bold text-slate-500 m-0">Pickup date</p>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => set({ date: d.iso })}
                  className={`shrink-0 w-[68px] py-2.5 rounded-xl border text-center cursor-pointer ${
                    form.date === d.iso ? 'border-[#ff5500] bg-orange-50 text-[#ea580c]' : 'border-slate-100 bg-white text-[#1e1b4b]'
                  }`}
                >
                  <div className="text-[11px] font-extrabold">{d.label}</div>
                  <div className="text-[10px] font-semibold text-slate-400">{d.sub}</div>
                </button>
              ))}
            </div>
            <p className="text-[12px] font-bold text-slate-500 m-0 pt-2">Pickup time</p>
            <div className="grid grid-cols-1 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button key={slot} type="button" className={optionCls(form.timeSlot === slot)} onClick={() => set({ timeSlot: slot })}>
                  {slot}
                </button>
              ))}
            </div>
          </>
        )}

        {!loading && step === 6 && category && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2.5 text-[12px]">
            {[
              ['Item', `${category.name} — ${form.brand} ${form.model}`],
              ['Problem', form.problem],
              ['Details', form.description],
              ['Pickup', address ? [address.addressLine1, address.city, address.pincode].filter(Boolean).join(', ') : ''],
              ['When', `${new Date(`${form.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${form.timeSlot}`],
              ['Diagnosis fee', `${formatRupees(category.diagnosisFee)} (adjusted in the bill if you approve the repair)`],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="w-24 shrink-0 font-bold text-slate-400">{k}</span>
                <span className="font-semibold text-[#1e1b4b] break-words min-w-0">{v}</span>
              </div>
            ))}
            {form.photos.length > 0 && (
              <div className="flex gap-2 pt-1">
                {form.photos.map((p) => <img key={p} src={p} alt="Item" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />)}
              </div>
            )}
            <p className="text-[10px] text-slate-400 m-0 pt-1">
              A rider will collect your item using a pickup OTP. A quotation is shared after diagnosis and nothing is charged until you approve it.
            </p>
          </div>
        )}

        {error && <p className="text-[12px] font-bold text-rose-600 m-0">{error}</p>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-3xl bg-white border-t border-slate-100 px-4 py-3 z-40">
        <button
          type="button"
          disabled={submitting || uploading || loading}
          onClick={isLast ? submit : goNext}
          className="w-full py-3 rounded-xl bg-[#ff5500] text-white text-[14px] font-extrabold border-none cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : isLast ? <Check size={16} /> : null}
          {isLast ? (submitting ? 'Booking…' : 'Confirm Booking') : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default RepairBook;

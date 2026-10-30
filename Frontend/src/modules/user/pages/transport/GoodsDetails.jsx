import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Package, Weight, Info, Tag, Sparkles } from 'lucide-react';
import { useTransport } from '../../context/TransportContext';

const standardCategories = ['Furniture', 'Electronics', 'Groceries', 'Textiles', 'Hardware', 'Other'];

const GoodsDetails = () => {
  const navigate = useNavigate();
  const { updateActiveBooking, activeBooking } = useTransport();

  const savedCategory = activeBooking.goods?.category || '';
  const isStandard = standardCategories.slice(0, 5).includes(savedCategory);

  const [category, setCategory] = useState(
    savedCategory ? (isStandard ? savedCategory : 'Other') : ''
  );
  const [customCategory, setCustomCategory] = useState(
    activeBooking.goods?.customCategory || (!isStandard && savedCategory !== 'Other' ? savedCategory : '')
  );
  const [weight, setWeight] = useState(activeBooking.goods?.weight || '');
  const [packages, setPackages] = useState(activeBooking.goods?.packages || '');
  const [instructions, setInstructions] = useState(activeBooking.goods?.instructions || '');

  const handleSelectCategory = (cat) => {
    setCategory(cat);
    if (cat !== 'Other') {
      setCustomCategory('');
    }
  };

  const isFormValid =
    category &&
    (category !== 'Other' || customCategory.trim().length > 0) &&
    weight &&
    parseFloat(weight) > 0 &&
    packages &&
    parseInt(packages) > 0;

  const handleNext = () => {
    if (!isFormValid) return;

    const finalCategory = category === 'Other' ? customCategory.trim() : category;

    updateActiveBooking('goods', {
      category: finalCategory,
      customCategory: category === 'Other' ? customCategory.trim() : '',
      weight,
      packages,
      instructions,
    });
    navigate('/transport/vehicle');
  };

  return (
    <div className="h-[100dvh] bg-slate-50 font-sans text-slate-800 relative max-w-[480px] mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center py-4 px-4 bg-white z-10 sticky top-0 border-b border-slate-100">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} className="text-slate-700" />
        </button>
        <h2 className="text-[16px] font-bold tracking-tight m-0 text-slate-800 ml-3">Goods Details</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-[100px] [&::-webkit-scrollbar]:hidden">
        
        {/* Category Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[14px] font-bold text-slate-700 flex items-center gap-2">
              <Package size={18} className="text-[#047857]" /> 
              Goods Category
            </label>
            {category === 'Other' && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles size={12} /> Custom Type
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {standardCategories.map((cat) => (
              <button 
                type="button"
                key={cat}
                className={`px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer border transition-all ${
                  category === cat 
                    ? 'bg-[#047857] text-white border-[#047857] shadow-sm scale-[1.02]' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
                onClick={() => handleSelectCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* ✍️ Custom Category Input Box (shows when 'Other' is selected) */}
          {category === 'Other' && (
            <div className="mt-3 p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
              <label className="text-[12px] font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                <Tag size={14} className="text-[#047857]" />
                Type Category Name <span className="text-red-500">*</span>
              </label>
              <div className="bg-white border border-emerald-300/80 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl px-3 py-2 transition-all flex items-center shadow-xs">
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Books, Spare Parts, Medical Equipment, Plastics..."
                  className="w-full bg-transparent border-none outline-none text-[14px] font-medium text-slate-800 placeholder:text-slate-400"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  maxLength={50}
                />
              </div>
              <p className="text-[11px] text-emerald-700/80 mt-1.5 ml-0.5">
                Drivers and system dispatchers will see this specific category for loading precautions.
              </p>
            </div>
          )}
        </div>

        {/* Weight & Packages */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 flex flex-col gap-2">
             <label className="text-[13px] font-bold text-slate-600 flex items-center gap-1.5">
               <Weight size={16} /> Total Weight
             </label>
             <div className="bg-white border border-slate-200 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl p-1 pr-3 flex items-center shadow-sm transition-all">
                <input 
                  type="number" 
                  min="0.1"
                  step="any"
                  placeholder="0" 
                  className="w-full bg-transparent border-none outline-none text-[15px] font-bold text-slate-800 px-3 py-2"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <span className="text-[13px] font-bold text-slate-400">KG</span>
             </div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
             <label className="text-[13px] font-bold text-slate-600 flex items-center gap-1.5">
               <Package size={16} /> Total Packages
             </label>
             <div className="bg-white border border-slate-200 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl p-1 flex items-center shadow-sm transition-all">
                <input 
                  type="number" 
                  min="1"
                  step="1"
                  placeholder="0" 
                  className="w-full bg-transparent border-none outline-none text-[15px] font-bold text-slate-800 px-3 py-2 text-center"
                  value={packages}
                  onChange={(e) => setPackages(e.target.value)}
                />
             </div>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="mb-6">
           <label className="text-[13px] font-bold text-slate-600 mb-2 block flex items-center gap-1.5">
             <Info size={16} /> Special Instructions (Optional)
           </label>
           <textarea 
             className="w-full bg-white border border-slate-200 focus:border-[#047857] focus:ring-2 focus:ring-emerald-500/20 rounded-xl p-3 outline-none text-[14px] text-slate-700 shadow-sm resize-none min-h-[100px] transition-all placeholder:text-slate-400"
             placeholder="E.g. Fragile items, keep upright..."
             value={instructions}
             onChange={(e) => setInstructions(e.target.value)}
             maxLength={300}
           ></textarea>
        </div>

      </div>

      {/* Next Button */}
      <div className="absolute bottom-0 left-0 w-full py-4 px-5 pb-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-[90]">
        <button 
          className={`w-full rounded-xl py-3.5 px-8 text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
            isFormValid 
              ? 'bg-[#047857] text-white shadow-[0_4px_12px_rgba(4,120,87,0.2)] active:scale-[0.98] hover:bg-[#036348]' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
          onClick={handleNext}
          disabled={!isFormValid}
        >
          Select Vehicle
        </button>
      </div>

    </div>
  );
};

export default GoodsDetails;

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Home, 
  LayoutGrid, 
  Star, 
  Layout, 
  Layers, 
  Store, 
  Image, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  Download, 
  Smartphone, 
  Monitor, 
  Copy, 
  Save, 
  Send,
  Zap,
  Tag
} from 'lucide-react';
import { bannerService, productService, adminService } from '../../../services/authService';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';
import { 
  initialPromotionStats, 
  initialHomeSections, 
  initialCategoryProducts, 
  initialBestsellers, 
  initialPromoStrips, 
  initialLowestPrices, 
  initialFeaturedStores, 
  initialBanners 
} from '../mock/promotionMockData';

/* =========================================================================
   1. PROMOTION DASHBOARD COMPONENT
   ========================================================================= */
export const PromotionDashboard = () => {
  const [stats] = useState(initialPromotionStats);

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/50 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-64 h-64 bg-[#ff661a]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ff661a]/20 text-[#ff661a] border border-[#ff661a]/30 uppercase tracking-widest">CMS Engine</span>
            <span className="text-xs text-slate-400 font-mono">v2.4 Live Sync</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Promotion Control Center</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">Configure, test, and broadcast visual promo elements across the Sathi Seller User App homepage in real time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => alert('Publishing Live Homepage CMS Changes...')} className="px-4 py-2.5 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl shadow-lg border-none cursor-pointer flex items-center gap-2 transition-all active:scale-95">
            <Send size={15} /> Broadcast Homepage
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Active Campaigns</span>
            <Zap size={16} className="text-[#ff661a]" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{stats.activeCampaigns}</h3>
          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">↑ +3 this week</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Scheduled Promos</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{stats.scheduledPromos}</h3>
          <p className="text-[10px] text-slate-500 font-medium">Next launch tomorrow</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Total Impressions</span>
            <Eye size={16} className="text-purple-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{stats.totalImpressions}</h3>
          <p className="text-[10px] text-emerald-600 font-bold">↑ +14.2% vs last week</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">CTR Conversion</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{stats.conversionRate}</h3>
          <p className="text-[10px] text-emerald-600 font-bold">↑ +0.8% optimal</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Promo Revenue</span>
            <Tag size={16} className="text-amber-500" />
          </div>
          <h3 className="text-2xl font-black font-mono text-[#ff661a]">{stats.revenueGenerated}</h3>
          <p className="text-[10px] text-slate-400 font-medium">Attributed sales</p>
        </div>
      </div>

      {/* Active Homepage Sections List (Matching User App Home Screen Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900">Active Homepage Screen Sections & Cards</h3>
            <p className="text-xs text-slate-500">Live cards currently visible on the User App Home screen</p>
          </div>
          <span className="text-xs text-[#ff661a] font-bold cursor-pointer hover:underline">Manage Sections</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Hero Promotional Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 hover:border-[#ff661a]/40 transition-all shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff661a]/10 text-[#ff661a]">Hero Banner</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Live</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">BIG SAVINGS on Bulk Orders (Up to 25% OFF)</h4>
            <div className="h-16 bg-slate-900 rounded-lg p-2 text-white flex items-center justify-between text-[10px]">
              <div>
                <p className="font-extrabold text-[#ff661a]">BIG SAVINGS</p>
                <p className="text-[9px] text-slate-300">Shop Now CTA</p>
              </div>
              <span className="bg-[#ff661a] px-1.5 py-0.5 rounded text-[8px] font-bold">25% OFF</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 flex justify-between">
              <span>Priority: #1</span>
              <span>1 Banner Item</span>
            </div>
          </div>

          {/* Card 2: Shop Categories Grid */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 hover:border-[#ff661a]/40 transition-all shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">Category Grid</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Live</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Shop Categories Grid (Grains, Oil, Spices...)</h4>
            <div className="h-16 bg-white rounded-lg p-1.5 border border-slate-200 grid grid-cols-4 gap-1">
              <div className="bg-slate-100 rounded flex items-center justify-center text-[8px] font-bold text-slate-600">Grains</div>
              <div className="bg-slate-100 rounded flex items-center justify-center text-[8px] font-bold text-slate-600">Oil</div>
              <div className="bg-slate-100 rounded flex items-center justify-center text-[8px] font-bold text-slate-600">Spices</div>
              <div className="bg-slate-100 rounded flex items-center justify-center text-[8px] font-bold text-slate-600">Sugar</div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 flex justify-between">
              <span>Priority: #2</span>
              <span>8 Categories</span>
            </div>
          </div>

          {/* Card 3: Flash Deals Timer Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 hover:border-[#ff661a]/40 transition-all shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">Product Carousel</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Live</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Flash Deals (Basmati Rice, Sunflower Oil, Toor Dal)</h4>
            <div className="h-16 bg-orange-50/60 rounded-lg p-2 border border-orange-200/60 flex items-center justify-between text-[10px]">
              <div>
                <span className="font-extrabold text-[#ff661a] text-[11px]">Flash Deals</span>
                <p className="text-[9px] text-slate-500 font-mono">Timer 02:45:30</p>
              </div>
              <span className="text-[10px] font-bold text-slate-900">21% OFF</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 flex justify-between">
              <span>Priority: #3</span>
              <span>3 Products</span>
            </div>
          </div>

          {/* Card 4: Best Selling Products Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 hover:border-[#ff661a]/40 transition-all shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600">Product Grid</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Live</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Best Selling Products (Atta, Iodized Salt...)</h4>
            <div className="h-16 bg-white rounded-lg p-1.5 border border-slate-200 flex items-center justify-around">
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-800">Wheat Atta</p>
                <span className="text-[9px] font-black text-[#ff661a]">₹250</span>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-800">Iodized Salt</p>
                <span className="text-[9px] font-black text-[#ff661a]">₹24</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 flex justify-between">
              <span>Priority: #4</span>
              <span>4 Products</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. HOME SECTION (DRAG & DROP BUILDER & PREVIEW)
   ========================================================================= */
export const PromoHomeSection = () => {
  const [sections, setSections] = useState(initialHomeSections);
  const [previewMode, setPreviewMode] = useState('mobile');

  // Add Block Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockType, setNewBlockType] = useState('Product Grid');
  const [newBlockItemsCount, setNewBlockItemsCount] = useState('4');

  const handleToggleVisibility = (id) => {
    setSections(sections.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newArr = [...sections];
    const temp = newArr[index];
    newArr[index] = newArr[index - 1];
    newArr[index - 1] = temp;
    setSections(newArr.map((item, idx) => ({ ...item, priority: idx + 1 })));
  };

  const handleMoveDown = (index) => {
    if (index === sections.length - 1) return;
    const newArr = [...sections];
    const temp = newArr[index];
    newArr[index] = newArr[index + 1];
    newArr[index + 1] = temp;
    setSections(newArr.map((item, idx) => ({ ...item, priority: idx + 1 })));
  };

  const handleDuplicate = (sec) => {
    const dup = {
      ...sec,
      id: `sec-${Date.now().toString().slice(-4)}`,
      name: `${sec.name} (Copy)`,
      priority: sections.length + 1
    };
    setSections([...sections, dup]);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this section layout block from homepage?')) {
      const updated = sections.filter(s => s.id !== id);
      setSections(updated.map((item, idx) => ({ ...item, priority: idx + 1 })));
    }
  };

  const handleAddBlockSubmit = (e) => {
    e.preventDefault();
    if (!newBlockName.trim()) {
      alert('Please enter a section block name.');
      return;
    }

    const newSec = {
      id: `sec-${Date.now().toString().slice(-4)}`,
      name: newBlockName,
      type: newBlockType,
      priority: sections.length + 1,
      isVisible: true,
      itemsCount: parseInt(newBlockItemsCount) || 4,
      updatedAt: new Date().toISOString().slice(0, 10),
      badge: 'Active'
    };

    setSections([...sections, newSec]);
    setNewBlockName('');
    setNewBlockType('Product Grid');
    setNewBlockItemsCount('4');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">Home Section Layout Builder</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff661a]/10 text-[#ff661a] border border-[#ff661a]/20">Visual CMS</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Drag, reorder, show/hide, and preview the exact User App Home Screen layout live</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsAddModalOpen(true)} className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
            <Plus size={14} /> Add Block
          </button>
          <button onClick={() => alert('Draft Saved!')} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer">
            <Save size={14} /> Save Draft
          </button>
          <button onClick={() => alert('Published to Live User App!')} className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
            <Send size={14} /> Publish Live
          </button>
        </div>
      </div>

      {/* Grid: Reorder Controls (Left) & Realtime Phone Frame Simulator (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Reorder & Block Controls */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Layout Sequence ({sections.length} Blocks)</span>
            <span className="text-[11px] text-slate-500">Use Arrow controls to reorder sequence</span>
          </div>

          {sections.map((sec, idx) => (
            <div 
              key={sec.id} 
              className={`bg-white p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                sec.isVisible ? 'border-slate-200 shadow-sm hover:border-[#ff661a]/40 hover:shadow-md' : 'border-slate-200 bg-slate-50/70 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3.5">
                {/* Up/Down Arrow Stack */}
                <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                  <button 
                    onClick={() => handleMoveUp(idx)} 
                    disabled={idx === 0} 
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30 border-none cursor-pointer transition-colors"
                    title="Move Up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button 
                    onClick={() => handleMoveDown(idx)} 
                    disabled={idx === sections.length - 1} 
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30 border-none cursor-pointer transition-colors"
                    title="Move Down"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                {/* Priority Badge */}
                <div className="w-9 h-9 rounded-xl bg-[#ff661a]/10 text-[#ff661a] font-mono font-black text-xs flex items-center justify-center border border-[#ff661a]/20 shrink-0">
                  #{sec.priority}
                </div>

                {/* Section Title & Info */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {sec.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    Type: <span className="font-semibold text-slate-700">{sec.type}</span> • <span className="font-mono">{sec.itemsCount} items</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleToggleVisibility(sec.id)} 
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                    sec.isVisible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {sec.isVisible ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {sec.isVisible ? 'Live' : 'Hidden'}
                </button>
                <button 
                  onClick={() => handleDuplicate(sec)} 
                  className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 cursor-pointer transition-colors" 
                  title="Duplicate Block"
                >
                  <Copy size={13} />
                </button>
                <button 
                  onClick={() => handleDelete(sec.id)} 
                  className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl border border-rose-200 cursor-pointer transition-colors" 
                  title="Delete Block"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Clean & Simple Live Preview Panel */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Homepage Layout Preview</h3>
              <p className="text-[11px] text-slate-400">Order of active blocks on the User App</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">Live Sync</span>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {sections.filter(s => s.isVisible).map(sec => (
              <div key={sec.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 transition-all hover:border-[#ff661a]/30">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-[#ff661a] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    Priority #{sec.priority} • {sec.type}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Visible</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">{sec.name}</h4>
                <p className="text-[11px] text-slate-500 font-medium">Contains {sec.itemsCount} promotional items</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Add Block Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="bg-[#ff661a] px-5 py-3.5 flex justify-between items-center text-white">
              <h3 className="text-sm font-bold tracking-wide">Add New Section Block</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-white hover:bg-white/20 p-1 rounded-lg border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBlockSubmit} className="p-5 space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Block Section Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Organic Snacks & Beverages"
                  value={newBlockName}
                  onChange={(e) => setNewBlockName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff661a]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Block Layout Type</label>
                <select 
                  value={newBlockType}
                  onChange={(e) => setNewBlockType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                >
                  <option value="Product Grid">Product Grid</option>
                  <option value="Product Carousel">Product Carousel</option>
                  <option value="Category Grid">Category Grid</option>
                  <option value="Hero Banner">Hero Banner</option>
                  <option value="Promo Banner Strip">Promo Banner Strip</option>
                  <option value="Store List">Store List</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Items Count</label>
                <input 
                  type="number" 
                  min="1"
                  max="50"
                  value={newBlockItemsCount}
                  onChange={(e) => setNewBlockItemsCount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm"
                >
                  Add Block Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   3. CATEGORY PRODUCTS COMPONENT
   ========================================================================= */
export const PromoCategoryProducts = () => {
  const [categories, setCategories] = useState([
    { id: 'CAT-1', name: 'Fresh Produce & Fruits', totalProducts: 1420, priority: 1, status: 'Active', badge: 'Fresh Harvest' },
    { id: 'CAT-2', name: 'Dairy & Refrigerated', totalProducts: 850, priority: 2, status: 'Active', badge: 'Daily Essential' },
    { id: 'CAT-3', name: 'Beverages & Soft Drinks', totalProducts: 2100, priority: 3, status: 'Active', badge: 'Summer Chill' },
    { id: 'CAT-4', name: 'Dry Grains & Wholesale Staples', totalProducts: 3400, priority: 4, status: 'Active', badge: 'Popular' },
    { id: 'CAT-5', name: 'Frozen Goods & Meat', totalProducts: 980, priority: 5, status: 'Active', badge: 'Cold Storage' },
    { id: 'CAT-6', name: 'Snacks & Confectionery', totalProducts: 1120, priority: 6, status: 'Active', badge: 'Munchies' },
    { id: 'CAT-7', name: 'Personal Care & Hygiene', totalProducts: 640, priority: 7, status: 'Active', badge: 'Wellness' },
    { id: 'CAT-8', name: 'Household & Cleaning Essentials', totalProducts: 910, priority: 8, status: 'Active', badge: 'Home Care' }
  ]);
  const [search, setSearch] = useState('');

  // Modal & Form State for Adding / Editing Category Block
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [catName, setCatName] = useState('');
  const [catPriority, setCatPriority] = useState(1);
  const [badgeLabel, setBadgeLabel] = useState('Featured');
  const [catStatus, setCatStatus] = useState('Active');

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.badge.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.priority - b.priority);

  const handlePriorityChange = (id, newPriority) => {
    const val = parseInt(newPriority);
    if (isNaN(val) || val < 1) return;
    setCategories(prev => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      const filteredList = prev.filter(c => c.id !== id);
      filteredList.splice(Math.min(val - 1, filteredList.length), 0, target);
      return filteredList.map((item, idx) => ({ ...item, priority: idx + 1 }));
    });
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newArr = [...categories];
    const temp = newArr[index];
    newArr[index] = newArr[index - 1];
    newArr[index - 1] = temp;
    setCategories(newArr.map((item, idx) => ({ ...item, priority: idx + 1 })));
  };

  const handleMoveDown = (index) => {
    if (index === categories.length - 1) return;
    const newArr = [...categories];
    const temp = newArr[index];
    newArr[index] = newArr[index + 1];
    newArr[index + 1] = temp;
    setCategories(newArr.map((item, idx) => ({ ...item, priority: idx + 1 })));
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setCatName('');
    setCatPriority(categories.length + 1);
    setBadgeLabel('Featured');
    setCatStatus('Active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingId(item.id);
    setCatName(item.name);
    setCatPriority(item.priority);
    setBadgeLabel(item.badge);
    setCatStatus(item.status);
    setIsModalOpen(true);
  };

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert('Please enter category name.');
      return;
    }

    if (editingId) {
      setCategories(categories.map(c => c.id === editingId ? {
        ...c,
        name: catName,
        priority: parseInt(catPriority),
        badge: badgeLabel,
        status: catStatus
      } : c).sort((a, b) => a.priority - b.priority).map((item, idx) => ({ ...item, priority: idx + 1 })));
    } else {
      const newCat = {
        id: `CAT-${categories.length + 1}`,
        name: catName,
        totalProducts: 100,
        priority: parseInt(catPriority) || categories.length + 1,
        status: catStatus,
        badge: badgeLabel
      };
      const newArr = [...categories, newCat];
      setCategories(newArr.sort((a, b) => a.priority - b.priority).map((item, idx) => ({ ...item, priority: idx + 1 })));
    }

    setIsModalOpen(false);
  };

  const handleDeleteCategory = (id) => {
    if (window.confirm('Delete this category from homepage list?')) {
      const updated = categories.filter(c => c.id !== id);
      setCategories(updated.map((c, idx) => ({ ...c, priority: idx + 1 })));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">Category Ordering & Display Management</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ff661a]/10 text-[#ff661a] border border-[#ff661a]/20">Sequence CMS</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Control which category appears at which position number on the User App homepage</p>
        </div>
        <button 
          onClick={handleOpenAddModal} 
          className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={15} /> Add Category
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        {/* Search & Counter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search category or badge..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#ff661a]" 
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Total Categories: <span className="font-bold text-slate-900">{categories.length}</span>
          </div>
        </div>

        {/* Category Table with Interactive Position Change Controls */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 w-28 text-center">Display Position #</th>
                <th className="py-3.5 px-4">Category Name</th>
                <th className="py-3.5 px-4">Badge Label</th>
                <th className="py-3.5 px-4">Total Products</th>
                <th className="py-3.5 px-4">Reorder Sequence</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filtered.length > 0 ? (
                filtered.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    {/* Position Number Selector */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[11px] font-bold text-slate-400">Position</span>
                        <select 
                          value={c.priority}
                          onChange={(e) => handlePriorityChange(c.id, e.target.value)}
                          className="bg-orange-50 border border-orange-200 text-[#ff661a] font-mono font-black text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
                        >
                          {categories.map((_, i) => (
                            <option key={i + 1} value={i + 1}>#{i + 1}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#ff661a] border border-orange-200">
                        {c.badge}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{c.totalProducts} items</td>
                    
                    {/* Reorder Up/Down Buttons */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleMoveUp(idx)} 
                          disabled={idx === 0} 
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border-none cursor-pointer disabled:opacity-30 transition-colors"
                          title="Move Up in List"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button 
                          onClick={() => handleMoveDown(idx)} 
                          disabled={idx === filtered.length - 1} 
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border-none cursor-pointer disabled:opacity-30 transition-colors"
                          title="Move Down in List"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenEditModal(c)} 
                        className="p-1.5 bg-slate-100 hover:bg-[#ff661a] hover:text-white rounded-lg border-none cursor-pointer transition-colors"
                        title="Edit Category Details"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(c.id)} 
                        className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg border-none cursor-pointer transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400 italic">
                    No categories found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="bg-[#ff661a] px-5 py-3.5 flex justify-between items-center text-white">
              <h3 className="text-sm font-bold tracking-wide">{editingId ? 'Edit Category Position' : 'Add New Category'}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/20 p-1 rounded-lg border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Category Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Organic Farm Fresh Vegetables"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff661a]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Display Position Number</label>
                  <select 
                    value={catPriority}
                    onChange={(e) => setCatPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                  >
                    {categories.map((_, i) => (
                      <option key={i + 1} value={i + 1}>Position #{i + 1}</option>
                    ))}
                    <option value={categories.length + 1}>Position #{categories.length + 1}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Badge Label</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Popular"
                    value={badgeLabel}
                    onChange={(e) => setBadgeLabel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Status</label>
                <select 
                  value={catStatus}
                  onChange={(e) => setCatStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm"
                >
                  {editingId ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   4. BESTSELLER CARDS COMPONENT
   ========================================================================= */
export const PromoBestseller = () => {
  const [bestsellers, setBestsellers] = useState(initialBestsellers);

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bestseller Cards Management</h2>
          <p className="text-xs text-slate-500">Configure top selling featured product cards with special promo badges</p>
        </div>
        <button onClick={() => alert('Add Bestseller Product')} className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
          <Plus size={15} /> Add Bestseller Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {bestsellers.map(b => (
          <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
            <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff661a] text-white">
              {b.badge}
            </span>
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold">Priority #{b.priority}</span>
              <h4 className="text-sm font-bold text-slate-900">{b.name}</h4>
            </div>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-base font-black text-[#ff661a]">{b.promoPrice}</span>
              <span className="text-xs text-slate-400 line-through">{b.originalPrice}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Sales: {b.salesCount}</span>
              <div className="flex gap-1">
                <button onClick={() => alert('Edit Bestseller')} className="p-1 hover:bg-slate-100 rounded text-slate-700 border-none cursor-pointer"><Edit3 size={13} /></button>
                <button onClick={() => setBestsellers(bestsellers.filter(item => item.id !== b.id))} className="p-1 hover:bg-rose-50 text-rose-600 rounded border-none cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   5. PROMO STRIP COMPONENT
   ========================================================================= */
export const PromoStrip = () => {
  const [strips, setStrips] = useState(initialPromoStrips);

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Promo Strip Banners</h2>
          <p className="text-xs text-slate-500">Manage full-width promotional announcement banners and discount strips</p>
        </div>
        <button onClick={() => alert('Create New Promo Strip')} className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
          <Plus size={15} /> Create Strip
        </button>
      </div>

      <div className="space-y-4">
        {strips.map(s => (
          <div key={s.id} className={`p-5 rounded-2xl bg-gradient-to-r ${s.bgGradient} text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
            <div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase">{s.status} • Priority #{s.priority}</span>
              <h3 className="text-lg font-bold mt-1">{s.title}</h3>
              <p className="text-xs opacity-90">{s.subtitle}</p>
              <div className="text-[10px] opacity-75 font-mono mt-2">Validity: {s.startDate} to {s.endDate}</div>
            </div>
            <button onClick={() => alert(`Redirecting to ${s.redirectUrl}`)} className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold rounded-xl border-none cursor-pointer shadow">
              {s.ctaText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   6. LOWEST PRICES COMPONENT
   ========================================================================= */
export const PromoLowestPrices = () => {
  const [items, setItems] = useState(initialLowestPrices);

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lowest Prices Guarantee Section</h2>
          <p className="text-xs text-slate-500">Configure products with price drop badges & automated deal matchers</p>
        </div>
        <button onClick={() => alert('Add Product to Lowest Price Guarantee')} className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
          <Plus size={15} /> Add Lowest Price Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">{item.badge}</span>
              <span className="text-[10px] text-slate-400 font-mono">{item.mode} Mode</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">{item.productName}</h4>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-lg font-black text-[#ff661a]">{item.lowestPrice}</span>
              <span className="text-xs text-slate-400 line-through">{item.marketPrice}</span>
              <span className="text-xs font-bold text-emerald-600">({item.discountPercent})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   7. SHOP BY STORE COMPONENT
   ========================================================================= */
export const PromoShopByStore = () => {
  const [stores, setStores] = useState(initialFeaturedStores);

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shop By Store Showcase</h2>
          <p className="text-xs text-slate-500">Feature top seller stores on user homepage slider</p>
        </div>
        <button onClick={() => alert('Feature New Store')} className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
          <Plus size={15} /> Add Featured Store
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
            <div className="h-28 bg-slate-200 relative">
              <img 
                src={getImageUrl(s.banner, s.storeName)} 
                alt={s.storeName} 
                className="w-full h-full object-cover" 
                onError={(e) => handleImageError(e, s.storeName)}
              />
              <img 
                src={getImageUrl(s.logo, s.storeName)} 
                alt={s.storeName} 
                className="w-14 h-14 rounded-full border-2 border-white absolute bottom-[-16px] left-4 object-cover shadow" 
                onError={(e) => handleImageError(e, s.storeName)}
              />
            </div>
            <div className="p-4 pt-4 space-y-1">
              <span className="text-[10px] font-bold text-[#ff661a] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">{s.tag}</span>
              <h4 className="text-base font-bold text-slate-900 pt-1">{s.storeName}</h4>
              <p className="text-xs text-slate-500">Owner: {s.owner}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   8. HOME BANNERS COMPONENT
   ========================================================================= */
export const PromoHomeBanners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [discountBadge, setDiscountBadge] = useState('');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [redirectUrl, setRedirectUrl] = useState('/categories');
  const [imageUrl, setImageUrl] = useState('/promo_banner_bg.png');
  const [position, setPosition] = useState('Hero Banner');
  const [status, setStatus] = useState('Active');
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      const data = await bannerService.uploadImage(formData);
      if (data.success && data.imageUrl) {
        setImageUrl(data.imageUrl);
      }
    } catch (err) {
      alert('Failed to upload image: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await bannerService.getBanners();
      if (res.success) {
        setBanners(res.banners);
      }
    } catch (err) {
      console.error('Failed to fetch banners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setDiscountBadge('');
    setCtaText('Shop Now');
    setRedirectUrl('/categories');
    setImageUrl('/promo_banner_bg.png');
    setPosition('Hero Banner');
    setStatus('Active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b) => {
    setEditingId(b._id || b.id);
    setTitle(b.title || '');
    setSubtitle(b.subtitle || '');
    setDiscountBadge(b.discountBadge || '');
    setCtaText(b.ctaText || 'Shop Now');
    setRedirectUrl(b.redirectUrl || '/categories');
    setImageUrl(b.imageUrl || '/promo_banner_bg.png');
    setPosition(b.position || 'Hero Banner');
    setStatus(b.status || 'Active');
    setIsModalOpen(true);
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    try {
      const bannerData = {
        title,
        subtitle,
        discountBadge,
        ctaText,
        redirectUrl,
        imageUrl,
        position,
        status,
      };

      if (editingId) {
        await bannerService.updateBanner(editingId, bannerData);
      } else {
        await bannerService.createBanner(bannerData);
      }
      setIsModalOpen(false);
      fetchBanners();
    } catch (err) {
      alert('Failed to save banner: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteBanner = async (id) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      try {
        await bannerService.deleteBanner(id);
        fetchBanners();
      } catch (err) {
        alert('Failed to delete banner');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Home Banners CMS</h2>
          <p className="text-xs text-slate-500">Manage hero promotional banners dynamically visible on the User App Homepage</p>
        </div>
        <button onClick={handleOpenAddModal} className="px-3.5 py-2 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm">
          <Plus size={15} /> Upload Banner
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium">Loading live banners...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map(b => (
            <div key={b._id || b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">{b.position || 'Hero Banner'}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  b.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>{b.status}</span>
              </div>

              {/* Live Preview Card */}
              <div className="rounded-xl overflow-hidden shadow-sm relative h-[90px] w-full border border-slate-200 bg-slate-100">
                <img 
                  src={getImageUrl(b.imageUrl, '/promo_banner_bg.png')} 
                  alt={b.title} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/promo_banner_bg.png';
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                <span>Route: <strong className="text-slate-800 font-mono">{b.redirectUrl || '/categories'}</strong></span>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEditModal(b)} className="px-2.5 py-1 bg-slate-100 hover:bg-[#ff661a] hover:text-white rounded-lg border-none cursor-pointer font-bold text-xs transition-colors">Edit</button>
                  <button onClick={() => handleDeleteBanner(b._id || b.id)} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg border-none cursor-pointer font-bold text-xs transition-colors">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="bg-[#ff661a] px-5 py-3.5 flex justify-between items-center text-white">
              <h3 className="text-sm font-bold tracking-wide">{editingId ? 'Edit Home Banner' : 'Create New Home Banner'}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/20 p-1 rounded-lg border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="p-5 space-y-3.5 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Banner Name (Internal Use)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Summer Sale"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Banner Image (Upload Device File)</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  {imageUrl && (
                    <img 
                      src={getImageUrl(imageUrl, '/promo_banner_bg.png')} 
                      alt="Banner Preview" 
                      className="w-12 h-12 object-cover rounded-lg border border-slate-300 shrink-0" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/promo_banner_bg.png';
                      }}
                    />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ff661a] file:text-white hover:file:bg-[#e65200] file:cursor-pointer cursor-pointer"
                    />
                    {uploading && <p className="text-[10px] text-[#ff661a] font-bold mt-1">Uploading image...</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Redirect Route</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /categories"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#ff661a]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#ff661a] hover:bg-[#e65200] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm"
                >
                  {editingId ? 'Update Banner' : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   9. FLASH SALE SECTION MANAGEMENT PAGE
   ========================================================================= */
export const PromoFlashSale = () => {
  const [flashTitle, setFlashTitle] = useState('Flash Deals');
  const [flashSubtitle, setFlashSubtitle] = useState('Super Saver Limited-Time Offers');
  const [isLive, setIsLive] = useState(true);
  const [timerHours, setTimerHours] = useState('02');
  const [timerMinutes, setTimerMinutes] = useState('45');
  const [timerSeconds, setTimerSeconds] = useState('30');
  const [toastMessage, setToastMessage] = useState('');

  // Sample Flash Deals Products List
  const [flashProducts, setFlashProducts] = useState([
    {
      id: 'fp-1',
      name: 'Basmati Rice',
      unit: '1kg',
      originalPrice: 95,
      salePrice: 75,
      discount: 21,
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&q=80',
      stock: 45,
      status: 'Active',
      priority: 1
    },
    {
      id: 'fp-2',
      name: 'Sunflower Oil',
      unit: '1L',
      originalPrice: 140,
      salePrice: 110,
      discount: 21,
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&q=80',
      stock: 30,
      status: 'Active',
      priority: 2
    },
    {
      id: 'fp-3',
      name: 'Toor Dal',
      unit: '1kg',
      originalPrice: 150,
      salePrice: 120,
      discount: 20,
      image: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=300&q=80',
      stock: 60,
      status: 'Active',
      priority: 3
    }
  ]);

  useEffect(() => {
    const fetchLiveFlashProducts = async () => {
      try {
        const res = await productService.getProducts({ section: 'flash_sale', admin: 'true' });
        if (res && res.products && Array.isArray(res.products) && res.products.length > 0) {
          const formatted = res.products.map((p, idx) => ({
            _id: p._id,
            id: p._id,
            name: p.name,
            unit: p.unit || `${p.unitValue || 1} ${p.unitType || 'kg'}`,
            originalPrice: p.mrp || p.salePrice || 0,
            salePrice: p.salePrice || 0,
            discount: (p.mrp && p.mrp > p.salePrice) ? Math.round(((p.mrp - p.salePrice) / p.mrp) * 100) : 0,
            image: p.mainImage || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80',
            stock: p.stock !== undefined ? p.stock : 50,
            status: p.status || 'Active',
            priority: idx + 1
          }));
          setFlashProducts(formatted);
        }
      } catch (err) {
        console.warn('Flash sale promotion fetch fallback:', err.message);
      }
    };
    fetchLiveFlashProducts();
  }, []);

  // Modal State for Adding/Editing Product
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: '1kg',
    originalPrice: '',
    salePrice: '',
    discount: '',
    image: '',
    stock: 50,
    status: 'Active'
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      unit: '1kg',
      originalPrice: '',
      salePrice: '',
      discount: '',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80',
      stock: 50,
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingId(item.id || item._id);
    setFormData({
      name: item.name,
      unit: item.unit,
      originalPrice: item.originalPrice,
      salePrice: item.salePrice,
      discount: item.discount,
      image: item.image,
      stock: item.stock,
      status: item.status
    });
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to remove this product from Flash Sale?')) {
      try {
        await productService.updateProduct(id, { homeSections: [] });
      } catch (err) {}
      setFlashProducts(prev => prev.filter(p => p.id !== id && p._id !== id));
      showToast('Product removed from Flash Sale.');
    }
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const orig = Number(formData.originalPrice) || 100;
    const sale = Number(formData.salePrice) || 80;
    const computedDiscount = formData.discount ? Number(formData.discount) : Math.round(((orig - sale) / orig) * 100);

    const payload = {
      name: formData.name,
      unit: formData.unit,
      mrp: orig,
      salePrice: sale,
      stock: Number(formData.stock),
      mainImage: formData.image,
      homeSections: ['flash_sale'],
      status: formData.status === 'Active' ? 'Published' : 'Draft'
    };

    let res = null;
    try {
      // Attach an approved seller so storefront eligibility can show the product (#88)
      if (!editingId) {
        try {
          const sellersRes = await adminService.getSellers(true);
          const sellers = sellersRes?.sellers || [];
          const approved = sellers.find(
            (s) => String(s.accountStatus || s.status || '').toLowerCase() === 'approved'
          );
          if (approved) {
            payload.sellerId = approved._id || approved.id;
            payload.seller = approved.businessName || approved.ownerName || 'Sathi Seller Seller';
          }
        } catch (_) {
          /* non-blocking */
        }
      }
      if (editingId) {
        res = await productService.updateProduct(editingId, payload);
      } else {
        res = await productService.createProduct(payload);
      }
    } catch (err) {
      console.warn('Save flash sale product API error:', err.message);
    }

    if (editingId) {
      setFlashProducts(prev => prev.map(p => (p.id === editingId || p._id === editingId) ? {
        ...p,
        name: formData.name,
        unit: formData.unit,
        originalPrice: orig,
        salePrice: sale,
        discount: computedDiscount,
        image: formData.image || p.image,
        stock: Number(formData.stock),
        status: formData.status
      } : p));
      showToast('Flash Sale Product updated successfully!');
    } else {
      const dbId = res?.product?._id;
      const newProduct = {
        _id: dbId,
        id: dbId || `fp-${Date.now()}`,
        name: formData.name,
        unit: formData.unit,
        originalPrice: orig,
        salePrice: sale,
        discount: computedDiscount,
        image: formData.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80',
        stock: Number(formData.stock),
        status: formData.status,
        priority: flashProducts.length + 1
      };
      setFlashProducts(prev => [newProduct, ...prev]);
      showToast('New product added to Flash Sale!');
    }
    setIsModalOpen(false);
  };

  const handleSaveCampaign = () => {
    showToast('Flash Sale settings saved and broadcasted to Homepage!');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-slate-900 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white uppercase tracking-wider backdrop-blur-md">PROMOTION ENGINE</span>
            <span className="text-sm text-orange-200 font-mono">Homepage Widget</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-2.5">
            <Zap className="text-yellow-300 fill-yellow-300" size={26} /> Flash Sale Section Management
          </h2>
          <p className="text-sm text-orange-100 mt-1.5 max-w-xl font-normal">Configure countdown timers, discounts, and feature limited-time products directly on the Customer App Homepage.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSaveCampaign} 
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold rounded-xl shadow-md cursor-pointer flex items-center gap-2 transition-all active:scale-95 border-none"
          >
            <Send size={16} className="text-[#ff5500]" /> Broadcast Live Changes
          </button>
        </div>
      </div>

      {/* Campaign Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Section Info & Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Tag size={18} className="text-[#ff5500]" /> Campaign Details & Visibility
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Live Status:</span>
              <button 
                onClick={() => setIsLive(!isLive)}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-none transition-all ${
                  isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isLive ? '● LIVE ON APP' : '○ INACTIVE'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Flash Sale Header Title</label>
              <input 
                type="text" 
                value={flashTitle}
                onChange={(e) => setFlashTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tagline / Subtitle</label>
              <input 
                type="text" 
                value={flashSubtitle}
                onChange={(e) => setFlashSubtitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-normal text-slate-800 focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Countdown Timer Setup */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-[#ff5500]" /> Countdown Timer Settings
            </h3>
            <span className="text-xs font-medium text-slate-400 font-mono">HH : MM : SS</span>
          </div>

          <div className="grid grid-cols-3 gap-4 my-auto">
            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 text-center">
              <label className="block text-xs font-medium uppercase text-slate-500 mb-1.5">Hours</label>
              <input 
                type="text" 
                maxLength={2}
                value={timerHours}
                onChange={(e) => setTimerHours(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 text-center text-xl font-semibold text-[#ff5500] focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 text-center">
              <label className="block text-xs font-medium uppercase text-slate-500 mb-1.5">Minutes</label>
              <input 
                type="text" 
                maxLength={2}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 text-center text-xl font-semibold text-[#ff5500] focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 text-center">
              <label className="block text-xs font-medium uppercase text-slate-500 mb-1.5">Seconds</label>
              <input 
                type="text" 
                maxLength={2}
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 text-center text-xl font-semibold text-[#ff5500] focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Flash Sale Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Featured Flash Sale Products</h3>
            <p className="text-sm font-normal text-slate-500 mt-0.5">Manage items currently listed under the Flash Deals section.</p>
          </div>
          <button 
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#ff5500] hover:bg-[#e64d00] text-white text-sm font-semibold rounded-xl border-none cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus size={18} /> Add Product to Flash Sale
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Product Details</th>
                <th className="py-3.5 px-4">Original Price</th>
                <th className="py-3.5 px-4">Sale Price</th>
                <th className="py-3.5 px-4">Discount</th>
                <th className="py-3.5 px-4">Stock</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {flashProducts.map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4 font-mono font-medium text-slate-400">#{idx + 1}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getImageUrl(p.image, p.name)} 
                        alt={p.name} 
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200" 
                        onError={(e) => handleImageError(e, p.name)}
                      />
                      <div>
                        <p className="font-semibold text-slate-900 text-sm m-0">{p.name}</p>
                        <span className="text-xs text-slate-400 font-mono">{p.unit}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-400 line-through">₹{p.originalPrice}</td>
                  <td className="py-4 px-4 font-mono font-semibold text-slate-900">₹{p.salePrice}</td>
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      {p.discount}% OFF
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-700">{p.stock} units</td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenEditModal(p)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors border-none bg-transparent"
                      >
                        <Edit3 size={17} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border-none bg-transparent"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Flash Sale Item' : 'Add Product to Flash Sale'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Basmati Rice"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit / Weight</label>
                  <input 
                    type="text" 
                    placeholder="1kg / 1L"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Available Stock</label>
                  <input 
                    type="number" 
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Original (₹)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="95"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale Price (₹)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="75"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label>
                  <input 
                    type="number" 
                    placeholder="Auto"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#ff5500] hover:bg-[#e64d00] text-white text-sm font-semibold rounded-xl border-none cursor-pointer shadow-sm"
                >
                  {editingId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


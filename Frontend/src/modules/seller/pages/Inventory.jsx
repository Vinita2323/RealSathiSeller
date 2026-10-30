import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Search, Download, ChevronDown, FileText, FileSpreadsheet, RefreshCw, Box, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { productService, authService } from '../../../services/authService';
import { getEffectiveStock } from '../../../utils/productStock';

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesList, setCategoriesList] = useState(['Grains & Flours', 'Oil & Ghee', 'Spices & Masala', 'Groceries']);

  // Stock Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'deduct'
  const [adjusting, setAdjusting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    let apiProducts = [];
    try {
      let sellerData = null;
      try {
        const cached = localStorage.getItem('sathiseller_seller_data');
        if (cached) sellerData = JSON.parse(cached);
      } catch (e) {}

      if (!sellerData?._id) {
        const profRes = await authService.getSellerProfile().catch(() => null);
        if (profRes?.seller) sellerData = profRes.seller;
      }

      const sellerId = sellerData?._id || sellerData?.id;
      const sellerName = sellerData?.businessName || sellerData?.ownerName;

      const params = {};
      if (sellerId) params.sellerId = sellerId;
      if (sellerName) params.seller = sellerName;

      const res = await productService.getProducts(params);
      if (res && res.products && Array.isArray(res.products)) {
        apiProducts = res.products;
      }
    } catch (err) {
      console.warn('Error fetching inventory products from API:', err.message);
    }

    const formattedApi = apiProducts.map(ap => {
      const stockVal = getEffectiveStock(ap);
      const minLimit = Number(ap.minStockLimit || 10);
      let st = 'In Stock';
      if (stockVal === 0) st = 'Out of Stock';
      else if (stockVal <= minLimit) st = 'Low Stock';

      return {
        id: ap._id || ap.id || ap.sku,
        _id: ap._id,
        name: ap.name,
        category: ap.category || 'General',
        available: stockVal,
        reserved: Math.floor(stockVal * 0.05), // Estimated reserved
        unit: ap.unitType || 'kg',
        threshold: minLimit,
        status: st,
        rawProduct: ap
      };
    });

    // Collect dynamic category names
    const cats = Array.from(new Set(formattedApi.map(i => i.category))).filter(Boolean);
    if (cats.length > 0) setCategoriesList(cats);

    setInventory(formattedApi);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Filtered inventory calculation
  const filtered = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const lowStockCount = inventory.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock').length;

  const handleAdjustStockSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModalItem || !adjustAmount) return;

    const amountNum = Math.abs(Number(adjustAmount));
    if (isNaN(amountNum) || amountNum === 0) return;

    setAdjusting(true);
    const delta = adjustType === 'add' ? amountNum : -amountNum;
    const newAvailable = Math.max(0, adjustModalItem.available + delta);

    let newStatus = 'In Stock';
    if (newAvailable === 0) newStatus = 'Out of Stock';
    else if (newAvailable <= adjustModalItem.threshold) newStatus = 'Low Stock';

    // Update state locally
    setInventory(prev => prev.map(item => {
      if (item.id === adjustModalItem.id) {
        return {
          ...item,
          available: newAvailable,
          status: newStatus
        };
      }
      return item;
    }));

    // Update in backend API if _id exists
    if (adjustModalItem._id) {
      try {
        await productService.updateProduct(adjustModalItem._id, {
          stock: newAvailable,
          status: newStatus === 'Out of Stock' ? 'Draft' : 'Published'
        });
      } catch (err) {
        console.warn('Backend stock update warning:', err.message);
      }
    }

    // Update in localStorage custom products
    const localProds = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
    const updatedLocal = localProds.map(p => {
      if ((p._id || p.id) === adjustModalItem.id || p.name === adjustModalItem.name) {
        return { ...p, stock: newAvailable };
      }
      return p;
    });
    localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));

    setAdjusting(false);
    setAdjustModalItem(null);
    setAdjustAmount('');
  };

  const handleQuickAdjust = async (item, delta) => {
    const newAvailable = Math.max(0, item.available + delta);
    let newStatus = 'In Stock';
    if (newAvailable === 0) newStatus = 'Out of Stock';
    else if (newAvailable <= item.threshold) newStatus = 'Low Stock';

    setInventory(prev => prev.map(i => {
      if (i.id === item.id) {
        return { ...i, available: newAvailable, status: newStatus };
      }
      return i;
    }));

    if (item._id) {
      try {
        await productService.updateProduct(item._id, { stock: newAvailable });
      } catch (e) {}
    }

    const localProds = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
    const updatedLocal = localProds.map(p => {
      if ((p._id || p.id) === item.id || p.name === item.name) {
        return { ...p, stock: newAvailable };
      }
      return p;
    });
    localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));
  };

  const exportInventory = (format = 'csv') => {
    if (filtered.length === 0) {
      alert('No inventory data available to export.');
      return;
    }

    const headers = ['Inventory ID', 'Item Name', 'Category', 'Available Stock', 'Reserved Stock', 'Status'];
    const rows = filtered.map(item => [
      `"${item.id}"`,
      `"${item.name}"`,
      `"${item.category}"`,
      `"${item.available} ${item.unit}"`,
      `"${item.reserved} ${item.unit}"`,
      `"${item.status}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Inventory_Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Warehouse Inventory & Stock</h1>
          <p className="text-sm font-normal text-slate-500 mt-1">Real-time stock audit and stock refill alerts.</p>
        </div>
        <button 
          onClick={() => {
            if (inventory.length > 0) {
              setAdjustModalItem(inventory[0]);
              setAdjustAmount('50');
              setAdjustType('add');
            }
          }}
          className="bg-[#ff7526] hover:bg-[#e65507] text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-2 text-sm"
        >
          <Plus size={18} strokeWidth={2} />
          Adjust Stock Level
        </button>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="bg-orange-50/80 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ff7526] text-white rounded-lg flex items-center justify-center font-bold shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Low Stock Alert</h4>
              <p className="text-xs text-slate-600 font-normal">{lowStockCount} items are currently below safety threshold. Restock recommended to prevent order fulfillment delays.</p>
            </div>
          </div>
          <button 
            onClick={() => setStatusFilter('Low Stock')}
            className="px-3.5 py-1.5 bg-[#ff7526] hover:bg-[#e65507] text-white font-medium text-xs rounded-lg border-none cursor-pointer transition-colors shadow-xs"
          >
            Restock Now
          </button>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Box size={18} className="text-[#ff7526]" /> Adjust Item Stock
              </h3>
              <button 
                type="button" 
                onClick={() => setAdjustModalItem(null)} 
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 m-0">SELECTED PRODUCT</p>
              <h4 className="text-sm font-bold text-slate-900 m-0 mt-0.5">{adjustModalItem.name}</h4>
              <p className="text-xs text-slate-500 m-0 mt-0.5">Current Stock: <span className="font-bold text-slate-800">{adjustModalItem.available} {adjustModalItem.unit}</span></p>
            </div>

            <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                      adjustType === 'add' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-bold' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <ArrowUpRight size={14} /> Add Stock (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                      adjustType === 'deduct' 
                        ? 'bg-red-50 text-red-700 border-red-300 shadow-2xs font-bold' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <ArrowDownRight size={14} /> Deduct Stock (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Quantity to {adjustType === 'add' ? 'Add' : 'Deduct'} *</label>
                <input 
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 50"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff7526]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-5 py-2 bg-[#ff7526] hover:bg-[#e65507] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm"
                >
                  {adjusting ? 'Saving...' : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Unified Card Container */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        
        {/* Light Orange Header Title Banner */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg tracking-wide">View Inventory & Stock List</h2>
            <button
              onClick={fetchInventory}
              className="p-1 text-white/80 hover:text-white rounded-md bg-white/10 hover:bg-white/20 transition-all border-none cursor-pointer flex items-center gap-1 text-xs"
              title="Refresh Inventory"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <span className="text-white/90 text-xs font-medium">Total Items: {filtered.length}</span>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm font-normal text-slate-700">
          
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Filter By Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal transition-all"
            >
              <option value="All">All Category</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal transition-all"
            >
              <option value="All">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>

          {/* Page Size Dropdown */}
          <div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Search Field */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Search:</span>
            <input
              type="text"
              placeholder="Search item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:border-[#ff7526] text-sm font-normal w-48 sm:w-64 transition-all"
            />
          </div>

          {/* Export Button & Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-[#ff7526] hover:bg-[#e65507] text-white font-medium py-1.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-1.5 text-sm"
            >
              <Download size={15} />
              Export
              <ChevronDown size={15} />
            </button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => exportInventory('csv')}
                  className="w-full px-4 py-2.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileText size={16} className="text-[#ff7526]" />
                  Export as CSV
                </button>
                <button
                  onClick={() => exportInventory('excel')}
                  className="w-full px-4 py-2.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  Export as Excel (.csv)
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4 font-semibold">Item Name</th>
                <th className="px-6 py-4 font-semibold">Available Stock</th>
                <th className="px-6 py-4 font-semibold">Reserved</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Quick Stock Audit</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-normal text-slate-700 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-[#ff7526]" />
                      Loading inventory records...
                    </div>
                  </td>
                </tr>
              ) : filtered.slice(0, pageSize).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    <div>
                      {item.name}
                      <span className="block text-xs font-normal text-slate-400 mt-0.5">{item.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${item.available === 0 ? 'text-red-600' : item.available <= item.threshold ? 'text-amber-600' : 'text-slate-900'}`}>
                      {item.available} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-normal text-sm">{item.reserved} {item.unit}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleQuickAdjust(item, 50)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-medium text-xs border border-emerald-200 cursor-pointer transition-colors"
                        title="Add 50 stock"
                      >
                        + Add 50
                      </button>
                      <button 
                        onClick={() => handleQuickAdjust(item, -50)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-md font-medium text-xs border border-red-200 cursor-pointer transition-colors"
                        title="Deduct 50 stock"
                      >
                        - Deduct 50
                      </button>
                      <button
                        onClick={() => {
                          setAdjustModalItem(item);
                          setAdjustAmount('50');
                          setAdjustType('add');
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-xs border border-slate-200 cursor-pointer transition-colors"
                        title="Custom stock level adjustment"
                      >
                        Custom
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-sm font-normal">
                    No inventory items match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  let style = 'bg-slate-100 text-slate-700 border border-slate-200';
  if (status === 'In Stock') style = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (status === 'Low Stock') style = 'bg-amber-50 text-amber-700 border border-amber-200';
  if (status === 'Out of Stock') style = 'bg-red-50 text-red-700 border border-red-200';
  return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${style}`}>{status}</span>;
};

export default Inventory;

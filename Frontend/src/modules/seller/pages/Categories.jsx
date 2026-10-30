import React, { useState, useEffect } from 'react';
import { Search, Download, ChevronDown, FolderTree, CheckCircle2, XCircle, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { categoryService } from '../../../services/authService';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';

const fallbackCategories = [
  { id: 'CAT-01', name: 'Grains & Flours', slug: 'grains-flours', subcategoriesCount: 6, productsCount: 42, status: 'Active', icon: '🌾' },
  { id: 'CAT-02', name: 'Edible Oils & Ghee', slug: 'oils-ghee', subcategoriesCount: 4, productsCount: 28, status: 'Active', icon: '🛢️' },
  { id: 'CAT-03', name: 'Spices & Masala', slug: 'spices-masala', subcategoriesCount: 12, productsCount: 95, status: 'Active', icon: '🌶️' },
  { id: 'CAT-04', name: 'Pulses & Rice', slug: 'pulses-rice', subcategoriesCount: 5, productsCount: 34, status: 'Active', icon: '🍚' },
  { id: 'CAT-05', name: 'Dry Fruits & Nuts', slug: 'dry-fruits', subcategoriesCount: 8, productsCount: 19, status: 'Inactive', icon: '🥜' },
  { id: 'CAT-06', name: 'Packaged Snacks', slug: 'packaged-snacks', subcategoriesCount: 10, productsCount: 60, status: 'Active', icon: '📦' },
];

const Categories = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await categoryService.getCategories();
      if (res && res.success && Array.isArray(res.categories) && res.categories.length > 0) {
        const formatted = res.categories.map((c, index) => ({
          id: c._id || c.id || `CAT-${index + 1}`,
          name: c.name,
          slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          subcategoriesCount: c.subcategoriesCount || (Array.isArray(c.subcategories) ? c.subcategories.length : 0),
          productsCount: c.productsCount || 0,
          status: c.status || 'Active',
          icon: c.icon && typeof c.icon === 'string' && c.icon.length <= 3 ? c.icon : (c.image ? '🖼️' : '📦'),
          image: c.image
        }));
        setCategories(formatted);
      } else {
        setCategories(fallbackCategories);
      }
    } catch (err) {
      console.error('Failed to fetch dynamic categories from Admin Panel API:', err);
      setCategories(fallbackCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportCategories = (format = 'csv') => {
    if (filteredCategories.length === 0) {
      alert('No category data available to export.');
      return;
    }

    const headers = ['Category ID', 'Category Name', 'Slug', 'Sub-Categories', 'Products Count', 'Status'];
    const rows = filteredCategories.map(c => [
      `"${c.id}"`,
      `"${c.name}"`,
      `"${c.slug}"`,
      `"${c.subcategoriesCount} Sub-types"`,
      `"${c.productsCount} Items"`,
      `"${c.status}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Category_List_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Unified Single Card Container */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        
        {/* Light Orange Header Title Banner */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg tracking-wide">View Category List</h2>
            <button
              onClick={fetchCategories}
              className="p-1 text-white/80 hover:text-white rounded-md bg-white/10 hover:bg-white/20 transition-all border-none cursor-pointer flex items-center gap-1 text-xs"
              title="Refresh from Admin Panel"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <span className="text-white/90 text-xs font-medium">
            Total Items: {filteredCategories.length}
          </span>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm font-normal text-slate-700">
          
          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal transition-all"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
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
              placeholder="Search by category name or slug..."
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
                  onClick={() => exportCategories('csv')}
                  className="w-full px-4 py-2.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileText size={16} className="text-[#ff7526]" />
                  Export as CSV
                </button>
                <button
                  onClick={() => exportCategories('excel')}
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
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Slug</th>
                <th className="px-6 py-4 font-semibold">Sub-Categories</th>
                <th className="px-6 py-4 font-semibold">Products</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-normal text-slate-700 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-[#ff7526]" />
                      Loading categories from Admin Panel...
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.slice(0, pageSize).map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                        <img 
                          src={getImageUrl(cat.image, cat.name)} 
                          alt={cat.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => handleImageError(e, cat.name)} 
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{cat.name}</span>
                        <span className="text-[13px] text-slate-400 font-normal">{cat.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{cat.slug}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-700 font-normal text-sm">
                      <FolderTree size={16} className="text-slate-400" />
                      {cat.subcategoriesCount} Sub-types
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{cat.productsCount} Items</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${cat.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {cat.status === 'Active' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {cat.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-sm font-normal">
                    No categories match your search criteria.
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

export default Categories;

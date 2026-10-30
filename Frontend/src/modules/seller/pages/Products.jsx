import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Download, ChevronDown, Edit, Trash2, Eye, FileText, 
  FileSpreadsheet, CheckCircle2, RefreshCw, Package, X, Upload, CheckCircle, 
  AlertCircle, ExternalLink, ArrowRight, Layers, DollarSign, Tag, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService, authService, categoryService } from '../../../services/authService';
import { getImageUrl, handleImageError, getInitialSvgDataUrl, compressAndResizeImage, uploadFileViaApi } from '../../../utils/imageUtils';
import { getEffectiveStock } from '../../../utils/productStock';

const Products = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [dynamicCategoryMap, setDynamicCategoryMap] = useState({});

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    subCategory: '',
    sku: '',
    salePrice: '',
    mrp: '',
    stock: '',
    status: 'Published',
    image: '',
    description: '',
    unitValue: '1',
    unitType: 'kg'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // View modal state
  const [viewingProduct, setViewingProduct] = useState(null);

  // Toast notification state
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Fetch Categories and Subcategories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await categoryService.getCategories();
        if (res?.categories && res.categories.length > 0) {
          const flat = res.categories;
          const map = {};
          const idToName = {};

          flat.forEach(c => {
            idToName[c._id] = c.name;
            if (!c.parent) {
              map[c.name] = [];
            }
          });

          flat.forEach(c => {
            if (c.parent && idToName[c.parent] && map[idToName[c.parent]]) {
              map[idToName[c.parent]].push(c.name);
            }
          });

          setDynamicCategoryMap(map);
          const keys = Object.keys(map);
          if (keys.length > 0) {
            setCategoriesList(prev => Array.from(new Set([...prev, ...keys])));
          }
        }
      } catch (err) {
        console.warn('Failed to load categories:', err.message);
      }
    };
    fetchCats();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    let apiProds = [];
    try {
      // 1. Get logged-in seller info
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

      // Pass sellerId so backend only returns products belonging to this seller
      const params = {};
      if (sellerId) params.sellerId = sellerId;
      if (sellerName) params.seller = sellerName;

      const res = await productService.getProducts(params);
      if (res && res.products && Array.isArray(res.products)) {
        apiProds = res.products;
      }
    } catch (err) {
      console.warn('Error fetching products from API:', err.message);
    }

    const formattedApi = apiProds.map(ap => ({
      ...ap,
      id: ap._id || ap.id || ap.sku,
      _id: ap._id,
      name: ap.name,
      sku: ap.sku || ap.id || 'SKU-001',
      category: ap.category || 'General',
      subCategory: ap.subCategory || '',
      price: Number(ap.salePrice || ap.mrp || ap.price || 0),
      salePrice: Number(ap.salePrice || ap.mrp || ap.price || 0),
      mrp: Number(ap.mrp || ap.salePrice || ap.price || 0),
      status: ap.status || 'Published',
      image: ap.mainImage || ap.image || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100&auto=format&fit=crop&q=80',
      description: ap.description || '',
      brand: ap.brand || '',
      unitValue: ap.unitValue || (ap.unit ? ap.unit.split(' ')[0] : '1'),
      unitType: ap.unitType || (ap.unit ? ap.unit.split(' ')[1] : 'kg'),
      unit: ap.unit || '1 kg',
      minStockLimit: ap.minStockLimit !== undefined ? ap.minStockLimit : 10,
      returnPolicy: ap.returnPolicy || '7 Days Returnable / Replacement',
      hasVariants: Boolean(ap.hasVariants || (Array.isArray(ap.variants) && ap.variants.length > 0)),
      variantOptions: ap.variantOptions || [],
      variants: ap.variants || [],
      // Variant products: show sum of active variant stocks (not a stale root field)
      stock: getEffectiveStock(ap),
    }));

    // Populate category dropdown from loaded products
    const cats = Array.from(new Set(formattedApi.map(p => p.category))).filter(Boolean);
    setCategoriesList(prev => Array.from(new Set([...prev, ...cats])));

    setProducts(formattedApi);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    if (product._id) {
      try {
        await productService.deleteProduct(product._id);
      } catch (e) {}
    }
    const localProds = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
    const updatedLocal = localProds.filter(p => (p._id || p.id) !== product.id && p.name !== product.name);
    localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));
    showToast(`Product "${product.name}" deleted successfully!`);
    fetchProducts();
  };

  // Open Edit Modal
  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name || '',
      category: product.category || 'Groceries & Grains',
      subCategory: product.subCategory || '',
      sku: product.sku || product.id || '',
      salePrice: product.salePrice !== undefined ? String(product.salePrice) : (product.price !== undefined ? String(product.price) : ''),
      mrp: product.mrp !== undefined ? String(product.mrp) : '',
      stock: String(getEffectiveStock(product)),
      status: product.status || 'Published',
      image: product.image || product.mainImage || '',
      description: product.description || '',
      unitValue: product.unitValue || '1',
      unitType: product.unitType || 'kg'
    });
  };

  const handleEditCategoryChange = (newCategory) => {
    const subs = dynamicCategoryMap[newCategory] || [];
    setEditFormData(prev => ({
      ...prev,
      category: newCategory,
      subCategory: subs.length > 0 ? subs[0] : ''
    }));
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressAndResizeImage(file, 1000, 1000, 0.75);
      if (compressed) {
        setEditFormData(prev => ({
          ...prev,
          image: compressed.dataUrl
        }));
        showToast(`Image "${file.name}" compressed and loaded!`);
        
        // Background direct upload if available
        uploadFileViaApi(compressed.file || file, 'products').then(uploadedUrl => {
          if (uploadedUrl) {
            setEditFormData(prev => ({
              ...prev,
              image: uploadedUrl
            }));
          }
        }).catch(() => {});
      }
    }
  };

  const handleSaveEditProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSavingEdit(true);

    const targetId = editingProduct._id || editingProduct.id;
    const cleanMainImage = (typeof editFormData.image === 'string' && editFormData.image.length > 1500000)
      ? 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80'
      : editFormData.image;

    const updatePayload = {
      name: editFormData.name.trim(),
      category: editFormData.category,
      subCategory: editFormData.subCategory,
      sku: editFormData.sku,
      salePrice: Number(editFormData.salePrice || 0),
      mrp: Number(editFormData.mrp || editFormData.salePrice || 0),
      stock: Number(editFormData.stock || 0),
      status: editFormData.status,
      mainImage: cleanMainImage,
      description: editFormData.description,
      unitValue: editFormData.unitValue,
      unitType: editFormData.unitType,
      unit: `${editFormData.unitValue || '1'} ${editFormData.unitType || 'kg'}`
    };

    try {
      if (editingProduct._id) {
        await productService.updateProduct(editingProduct._id, updatePayload);
      } else {
        await productService.updateProduct(targetId, updatePayload).catch(() => {});
      }

      // Update local storage if present
      const localProds = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
      const updatedLocal = localProds.map(p => 
        ((p._id && p._id === targetId) || p.id === targetId || p.sku === editFormData.sku)
          ? { ...p, ...updatePayload, id: p.id || targetId }
          : p
      );
      localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));

      // Update local state in products array
      setProducts(prev => prev.map(p => 
        (p.id === targetId || p._id === targetId)
          ? {
              ...p,
              name: editFormData.name,
              category: editFormData.category,
              subCategory: editFormData.subCategory,
              sku: editFormData.sku,
              price: Number(editFormData.salePrice || 0),
              salePrice: Number(editFormData.salePrice || 0),
              mrp: Number(editFormData.mrp || 0),
              stock: Number(editFormData.stock || 0),
              status: editFormData.status,
              image: cleanMainImage,
              description: editFormData.description
            }
          : p
      ));

      showToast(`Product "${editFormData.name}" updated successfully!`, 'success');
      setEditingProduct(null);
    } catch (err) {
      console.error('Error updating product:', err);
      showToast(`Update failed: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const exportProducts = (format = 'csv') => {
    if (filteredProducts.length === 0) {
      alert('No product data available to export.');
      return;
    }

    const headers = ['Product ID', 'Product Name', 'SKU', 'Category', 'Price (INR)', 'Stock', 'Status'];
    const rows = filteredProducts.map(p => [
      `"${p.id}"`,
      `"${p.name}"`,
      `"${p.sku}"`,
      `"${p.category}"`,
      `"${Number(p.price).toFixed(2)}"`,
      `"${p.stock} units"`,
      `"${p.status}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Products_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          {toastType === 'success' ? (
            <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Products</h1>
          <p className="text-sm font-normal text-slate-500 mt-1">Manage your store product catalog and inventory details.</p>
        </div>
        <button 
          onClick={() => navigate('/seller/product/add')}
          className="bg-[#ff7526] hover:bg-[#e65507] text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-2 text-sm"
        >
          <Plus size={18} strokeWidth={2} />
          Add New Product
        </button>
      </div>

      {/* Main Unified Card Container */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        
        {/* Light Orange Header Title Banner */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg tracking-wide">View Product List</h2>
            <button
              onClick={fetchProducts}
              className="p-1 text-white/80 hover:text-white rounded-md bg-white/10 hover:bg-white/20 transition-all border-none cursor-pointer flex items-center gap-1 text-xs"
              title="Refresh Products List"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <span className="text-white/90 text-xs font-medium">Total Items: {filteredProducts.length}</span>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm font-normal text-slate-700">
          
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal transition-all"
            >
              <option value="All">All Categories</option>
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
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
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
              placeholder="Search product name or SKU..."
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
                  onClick={() => exportProducts('csv')}
                  className="w-full px-4 py-2.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileText size={16} className="text-[#ff7526]" />
                  Export as CSV
                </button>
                <button
                  onClick={() => exportProducts('excel')}
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
                <th className="px-5 py-4 font-semibold w-10">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0} 
                    className="rounded text-[#ff7526] focus:ring-[#ff7526] cursor-pointer" 
                  />
                </th>
                <th className="px-5 py-4 font-semibold">Product Details</th>
                <th className="px-5 py-4 font-semibold">Category</th>
                <th className="px-5 py-4 font-semibold">Price (₹)</th>
                <th className="px-5 py-4 font-semibold">Stock</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-normal text-slate-700 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-[#ff7526]" />
                      Loading product catalog...
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.slice(0, pageSize).map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(product.id)}
                      onChange={() => handleSelectOne(product.id)}
                      className="rounded text-[#ff7526] focus:ring-[#ff7526] cursor-pointer" 
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                        <img 
                          src={getImageUrl(product.image, product.name)} 
                          alt={product.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => handleImageError(e, product.name)}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 leading-tight">{product.name}</span>
                        <span className="text-[13px] text-slate-400 font-normal">{product.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-normal text-slate-600">
                    <div>{product.category}</div>
                    {product.subCategory && (
                      <div className="text-[12px] text-slate-400">{product.subCategory}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    ₹{Number(product.price).toFixed(2)}
                    {product.mrp && product.mrp > product.price && (
                      <span className="text-xs text-slate-400 line-through ml-1.5 font-normal">
                        ₹{Number(product.mrp).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <span className={`font-semibold ${product.stock === 0 ? 'text-red-600' : product.stock < (product.minStockLimit || 10) ? 'text-orange-600' : 'text-slate-900'}`}>
                      {product.stock} units
                      {product.hasVariants ? (
                        <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                          Across {(product.variants || []).filter((v) => v && v.active !== false).length} variants
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setViewingProduct(product)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 bg-white rounded-md border border-slate-200 shadow-xs cursor-pointer transition-colors" 
                        title="View Product Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleOpenEditModal(product)}
                        className="p-1.5 text-slate-500 hover:text-[#ff7526] bg-white rounded-md border border-slate-200 shadow-xs cursor-pointer transition-colors" 
                        title="Edit Product Information"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product)}
                        className="p-1.5 text-slate-500 hover:text-red-600 bg-white rounded-md border border-slate-200 shadow-xs cursor-pointer transition-colors" 
                        title="Delete Product"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm font-normal">
                    No products found in database. Click "+ Add New Product" to create your first item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* QUICK EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ff7526]/10 text-[#ff7526] flex items-center justify-center">
                  <Edit size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Edit Product Information</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 font-mono">SKU: {editingProduct.sku || editingProduct.id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = editingProduct._id || editingProduct.id;
                    setEditingProduct(null);
                    navigate(`/seller/product/edit/${id}`);
                  }}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-[#ff7526] hover:text-[#e65507] bg-[#ff7526]/10 hover:bg-[#ff7526]/20 px-2.5 py-1.5 rounded-lg border border-[#ff7526]/20 transition-all cursor-pointer"
                  title="Open in full dedicated edit page"
                >
                  <span>Full Editor</span>
                  <ExternalLink size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Form Body */}
            <form onSubmit={handleSaveEditProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {editingProduct?.hasVariants && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>This product has <strong>{editingProduct.variants?.length || 0} variant combinations</strong> (sizes, colors, etc.).</span>
                  <button
                    type="button"
                    onClick={() => {
                      const id = editingProduct._id || editingProduct.id;
                      setEditingProduct(null);
                      navigate(`/seller/product/edit/${id}`);
                    }}
                    className="font-bold text-[#ff7526] hover:underline bg-transparent border-none cursor-pointer p-0 shrink-0 text-left sm:text-right"
                  >
                    Open Full Variant Editor &rarr;
                  </button>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g. Premium Organics Basmati Rice"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all font-medium"
                />
              </div>

              {/* Category & SubCategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => handleEditCategoryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all cursor-pointer"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Subcategory
                  </label>
                  <select
                    value={editFormData.subCategory}
                    onChange={(e) => setEditFormData({ ...editFormData, subCategory: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all cursor-pointer"
                  >
                    <option value="">General / None</option>
                    {(dynamicCategoryMap[editFormData.category] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {editFormData.subCategory && !(dynamicCategoryMap[editFormData.category] || []).includes(editFormData.subCategory) && (
                      <option value={editFormData.subCategory}>{editFormData.subCategory}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Price, MRP, and Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sale Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editFormData.salePrice}
                    onChange={(e) => setEditFormData({ ...editFormData, salePrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    MRP Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editFormData.mrp}
                    onChange={(e) => setEditFormData({ ...editFormData, mrp: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editFormData.stock}
                    onChange={(e) => setEditFormData({ ...editFormData, stock: e.target.value })}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all font-semibold"
                  />
                </div>
              </div>

              {/* SKU & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    placeholder="e.g. SKU-1049"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-[#ff7526] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all cursor-pointer"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              {/* Product Image */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Main Image
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    <img 
                      src={getImageUrl(editFormData.image, editFormData.name || 'Product')} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      onError={(e) => handleImageError(e, editFormData.name || 'Product')}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Paste image URL here..."
                      value={editFormData.image}
                      onChange={(e) => setEditFormData({ ...editFormData, image: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#ff7526]"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors">
                        <Upload size={12} />
                        <span>Upload from device</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">JPG, PNG, or WebP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Short Description
                </label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Provide a brief description of the product features, quality, specifications..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#ff7526] transition-all resize-none"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const id = editingProduct._id || editingProduct.id;
                    setEditingProduct(null);
                    navigate(`/seller/product/edit/${id}`);
                  }}
                  className="text-xs font-semibold text-[#ff7526] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                >
                  <span>Advanced Settings & Gallery</span>
                  <ArrowRight size={13} />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 bg-[#ff7526] hover:bg-[#e65507] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VIEW PRODUCT DETAILS MODAL */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-[#ff7526]" />
                <h3 className="text-base font-bold text-slate-900">Product Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  <img 
                    src={getImageUrl(viewingProduct.image, viewingProduct.name)} 
                    alt={viewingProduct.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => handleImageError(e, viewingProduct.name)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={viewingProduct.status} />
                    <span className="text-xs font-mono text-slate-400">{viewingProduct.sku}</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-1">{viewingProduct.name}</h4>
                  <p className="text-xs text-slate-500">{viewingProduct.category} {viewingProduct.subCategory ? `• ${viewingProduct.subCategory}` : ''}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-lg font-extrabold text-[#ff7526]">₹{Number(viewingProduct.price || viewingProduct.salePrice || 0).toFixed(2)}</span>
                    {viewingProduct.mrp && viewingProduct.mrp > (viewingProduct.price || viewingProduct.salePrice) && (
                      <span className="text-xs text-slate-400 line-through">₹{Number(viewingProduct.mrp).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400">Available Stock:</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {getEffectiveStock(viewingProduct)} units
                    {viewingProduct.hasVariants ? (
                      <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                        Sum of active variants
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Unit Type:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{viewingProduct.unit || '1 kg'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Return Policy:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{viewingProduct.returnPolicy || '7 Days Returnable'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Seller:</span>
                  <div className="font-bold text-slate-800 mt-0.5 truncate">{viewingProduct.seller || 'Current Seller'}</div>
                </div>
              </div>

              {viewingProduct.description && (
                <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-800 block mb-1">Description:</span>
                  <p className="m-0 leading-relaxed text-slate-600">{viewingProduct.description}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const prod = viewingProduct;
                  setViewingProduct(null);
                  handleOpenEditModal(prod);
                }}
                className="px-4 py-2 bg-[#ff7526] hover:bg-[#e65507] text-white text-xs font-semibold rounded-xl border-none cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Edit size={14} />
                <span>Edit This Product</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

const StatusBadge = ({ status }) => {
  let style = 'bg-slate-100 text-slate-700 border border-slate-200';
  if (status === 'Published' || status === 'In Stock') style = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (status === 'Low Stock') style = 'bg-amber-50 text-amber-700 border border-amber-200';
  if (status === 'Out of Stock' || status === 'Draft') style = 'bg-red-50 text-red-700 border border-red-200';
  return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${style}`}>{status}</span>;
};

export default Products;

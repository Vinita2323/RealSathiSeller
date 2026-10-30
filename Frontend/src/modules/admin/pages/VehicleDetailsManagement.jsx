import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Truck, 
  Bike, 
  Car, 
  Plus, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  XCircle, 
  Package, 
  Ruler, 
  Box, 
  Download, 
  ChevronRight, 
  Check, 
  X,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Zap,
  Gauge,
  IndianRupee,
  MoreVertical,
  CheckCircle2
} from 'lucide-react';
import { vehicleService } from '../../../services/authService';

export const VehicleDetailsManagement = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [toastMessage, setToastMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentVehicleId, setCurrentVehicleId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Form State
  const initialForm = {
    name: '',
    slug: '',
    vehicleCategory: '3_wheeler',
    capacityKg: 500,
    dimensions: '',
    suitableFor: '',
    description: '',
    baseFare: 60,
    perKmFare: 14,
    minimumFare: 120,
    platformFee: 15,
    speedKmH: 30,
    icon: 'auto',
    sortOrder: 1,
    isActive: true,
  };

  const [formData, setFormData] = useState(initialForm);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vehicleService.getAllVehiclesAdmin();
      if (res && res.success && Array.isArray(res.vehicles)) {
        setVehicles(res.vehicles);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      console.error('Failed to fetch vehicle types:', err);
      showToast('Error loading vehicle details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentVehicleId(null);
    setFormData({
      ...initialForm,
      sortOrder: vehicles.length + 1,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (v) => {
    setIsEditing(true);
    setCurrentVehicleId(v._id || v.id);
    setFormData({
      name: v.name || '',
      slug: v.slug || '',
      vehicleCategory: v.vehicleCategory || (v.capacityKg <= 50 ? '2_wheeler' : (v.capacityKg <= 600 ? '3_wheeler' : (v.capacityKg <= 1500 ? '4_wheeler' : 'heavy_truck'))),
      capacityKg: v.capacityKg || 50,
      dimensions: v.dimensions || '',
      suitableFor: v.suitableFor || '',
      description: v.description || '',
      baseFare: v.baseFare !== undefined ? v.baseFare : 40,
      perKmFare: v.perKmFare !== undefined ? v.perKmFare : 10,
      minimumFare: v.minimumFare !== undefined ? v.minimumFare : 60,
      platformFee: v.platformFee !== undefined ? v.platformFee : 10,
      speedKmH: v.speedKmH || 30,
      icon: v.icon || 'truck',
      sortOrder: v.sortOrder || 0,
      isActive: v.isActive !== undefined ? v.isActive : true,
    });
    setIsModalOpen(true);
  };

  // Submit Create / Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a valid vehicle name.');
      return;
    }

    try {
      setModalLoading(true);
      if (isEditing && currentVehicleId) {
        const res = await vehicleService.updateVehicle(currentVehicleId, formData);
        if (res && res.success) {
          showToast(`✓ "${formData.name}" updated successfully!`);
          setIsModalOpen(false);
          fetchVehicles();
        } else {
          alert(res?.message || 'Failed to update vehicle');
        }
      } else {
        const res = await vehicleService.createVehicle(formData);
        if (res && res.success) {
          showToast(`✓ New vehicle "${formData.name}" added successfully!`);
          setIsModalOpen(false);
          fetchVehicles();
        } else {
          alert(res?.message || 'Failed to create vehicle');
        }
      }
    } catch (err) {
      console.error('Error saving vehicle:', err);
      alert(err.response?.data?.message || err.message || 'Error saving vehicle details');
    } finally {
      setModalLoading(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (v) => {
    const targetStatus = !v.isActive;
    try {
      const res = await vehicleService.toggleStatus(v._id || v.id, targetStatus);
      if (res && res.success) {
        setVehicles(prev => prev.map(item => (item._id === v._id ? { ...item, isActive: targetStatus } : item)));
        showToast(`Vehicle status set to ${targetStatus ? 'Active' : 'Inactive'}`);
      }
    } catch (err) {
      console.error('Error toggling vehicle status:', err);
      showToast('Failed to update status');
    }
  };

  // Delete Vehicle
  const handleDeleteVehicle = async (v) => {
    if (!window.confirm(`Are you sure you want to delete "${v.name}"? This vehicle will be removed from customer booking choices.`)) {
      return;
    }
    try {
      const res = await vehicleService.deleteVehicle(v._id || v.id);
      if (res && res.success) {
        setVehicles(prev => prev.filter(item => item._id !== v._id));
        showToast(`✓ "${v.name}" deleted successfully.`);
      } else {
        alert(res?.message || 'Failed to delete vehicle');
      }
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert(err.response?.data?.message || err.message || 'Error deleting vehicle');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Vehicle Name', 'Slug', 'Category', 'Capacity (Kg)', 'Dimensions', 'Suitable Cargo', 'Base Fare (INR)', 'Per KM Fare (INR)', 'Min Fare (INR)', 'Platform Fee (INR)', 'Status'];
    const rows = vehicles.map(v => [
      `"${v.name}"`,
      `"${v.slug}"`,
      `"${v.vehicleCategory || 'General'}"`,
      `"${v.capacityKg}"`,
      `"${v.dimensions || '-'}"`,
      `"${v.suitableFor || '-'}"`,
      `"₹${v.baseFare}"`,
      `"₹${v.perKmFare}/km"`,
      `"₹${v.minimumFare}"`,
      `"₹${v.platformFee}"`,
      `"${v.isActive ? 'Active' : 'Inactive'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sathiseller_vehicles_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Filtered Vehicles
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return vehicles.filter(v => {
      const matchSearch = !q || (
        v.name?.toLowerCase().includes(q) ||
        v.slug?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.suitableFor?.toLowerCase().includes(q) ||
        v.dimensions?.toLowerCase().includes(q)
      );

      const matchCat = selectedCategory === 'ALL' || v.vehicleCategory === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || (selectedStatus === 'ACTIVE' ? v.isActive : !v.isActive);

      return matchSearch && matchCat && matchStatus;
    });
  }, [vehicles, searchQuery, selectedCategory, selectedStatus]);

  // Vehicle Icon Component Renderer
  const renderVehicleIcon = (iconName, className = 'w-5 h-5') => {
    switch (iconName) {
      case 'bike':
        return <Bike className={className} />;
      case 'auto':
        return <Truck className={className} />;
      case 'pickup':
        return <Truck className={className} />;
      case 'car':
        return <Car className={className} />;
      default:
        return <Truck className={className} />;
    }
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case '2_wheeler':
        return { label: '2-Wheeler', bg: 'bg-slate-100 text-slate-700' };
      case '3_wheeler':
        return { label: '3-Wheeler', bg: 'bg-slate-100 text-slate-700' };
      case '4_wheeler':
        return { label: '4-Wheeler', bg: 'bg-slate-100 text-slate-700' };
      case 'heavy_truck':
        return { label: 'Heavy Truck', bg: 'bg-slate-100 text-slate-700' };
      default:
        return { label: 'Commercial', bg: 'bg-slate-100 text-slate-700' };
    }
  };

  // Stats summary calculation
  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.isActive).length;
    const twoWheelers = vehicles.filter(v => v.vehicleCategory === '2_wheeler' || v.capacityKg <= 50).length;
    const threeWheelers = vehicles.filter(v => v.vehicleCategory === '3_wheeler' || (v.capacityKg > 50 && v.capacityKg <= 600)).length;
    const fourWheelers = vehicles.filter(v => v.vehicleCategory === '4_wheeler' || v.vehicleCategory === 'heavy_truck' || v.capacityKg > 600).length;
    return { total, active, twoWheelers, threeWheelers, fourWheelers };
  }, [vehicles]);

  return (
    <div className="space-y-5 font-sans text-slate-800 pb-16 animate-fadeIn max-w-7xl mx-auto">
      {/* ── Minimalist Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mb-1">
            <span>Admin</span>
            <ChevronRight size={12} />
            <span>Transport & Logistics</span>
            <ChevronRight size={12} />
            <span className="text-slate-700">Vehicle Details</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Vehicle Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {vehicles.length} {vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure transport vehicle specifications, payload limits, cargo dimensions, and dynamic pricing rates.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVehicles}
            disabled={loading}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            title="Refresh Fleet"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-slate-400' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <Download size={13} className="text-slate-500" />
            <span>Export</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#ea4e00] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all border-none"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* ── Compact Key Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500">Total Fleet</span>
            <p className="text-lg font-bold text-slate-900 leading-none mt-1">{stats.total}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Truck size={16} />
          </div>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500">Active Fleet</span>
            <p className="text-lg font-bold text-emerald-600 leading-none mt-1">{stats.active}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500">2 & 3 Wheelers</span>
            <p className="text-lg font-bold text-slate-900 leading-none mt-1">{stats.twoWheelers + stats.threeWheelers}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Bike size={16} />
          </div>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500">4-W & Heavy Trucks</span>
            <p className="text-lg font-bold text-slate-900 leading-none mt-1">{stats.fourWheelers}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Package size={16} />
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {[
            { id: 'ALL', label: 'All Fleet' },
            { id: '2_wheeler', label: '2-Wheeler' },
            { id: '3_wheeler', label: '3-Wheeler' },
            { id: '4_wheeler', label: '4-Wheeler' },
            { id: 'heavy_truck', label: 'Heavy Truck' },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Right Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Select */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/70 text-xs font-medium text-slate-700 outline-none focus:border-slate-400 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Search Input */}
          <div className="relative flex items-center bg-slate-50/70 border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-slate-400 focus-within:bg-white transition-colors w-48 sm:w-56">
            <Search size={13} className="text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md cursor-pointer transition-all border-none ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'bg-transparent text-slate-500 hover:text-slate-800'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md cursor-pointer transition-all border-none ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'bg-transparent text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <TableIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200/80 shadow-2xs">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-[#ff5500] rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs font-semibold text-slate-700 m-0">Loading vehicle details...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200/80 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 border border-slate-100 text-slate-400">
            <Truck size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 m-0">No Vehicles Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
              ? 'No vehicle specifications match your search or filter.'
              : 'There are currently no transport vehicles registered in the system.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-3.5 px-3.5 py-1.5 bg-[#ff5500] hover:bg-[#ea4e00] text-white text-xs font-semibold rounded-lg border-none cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
          >
            <Plus size={13} /> Add First Vehicle
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* ── CLEAN CARD GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((v) => {
            const catBadge = getCategoryBadge(v.vehicleCategory);

            return (
              <div
                key={v._id || v.id}
                className={`bg-white rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-300 ${
                  v.isActive ? 'border-slate-200/90' : 'border-slate-200/60 bg-slate-50/40 opacity-75'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-700">
                        {renderVehicleIcon(v.icon, 'w-5 h-5 text-slate-700')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 m-0">{v.name}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${catBadge.bg}`}>
                            {catBadge.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 block mt-0.5">slug: {v.slug}</span>
                      </div>
                    </div>

                    {/* Status Pill Toggle */}
                    <button
                      onClick={() => handleToggleStatus(v)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border cursor-pointer transition-colors ${
                        v.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Click to toggle status"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${v.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      {v.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {/* Description if any */}
                  {v.description && (
                    <p className="px-4 pt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed m-0 font-normal">
                      {v.description}
                    </p>
                  )}

                  {/* Vehicle Key Specifications */}
                  <div className="p-4 space-y-3">
                    {/* Capacity & Dimensions Matrix */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                          Capacity
                        </span>
                        <p className="text-xs font-bold text-slate-900 m-0 mt-0.5">{v.capacityKg} kg</p>
                      </div>

                      <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                          Cargo Box
                        </span>
                        <p className="text-xs font-medium text-slate-800 m-0 mt-0.5 truncate" title={v.dimensions || 'Standard'}>
                          {v.dimensions || 'Standard'}
                        </p>
                      </div>
                    </div>

                    {/* Suitable For Goods */}
                    {v.suitableFor && (
                      <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-2.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                          Suitable Cargo
                        </span>
                        <p className="text-xs font-normal text-slate-700 m-0 mt-0.5 line-clamp-2 leading-relaxed">
                          {v.suitableFor}
                        </p>
                      </div>
                    )}

                    {/* Minimalist Fare Strip */}
                    <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pb-2 border-b border-slate-200/60 mb-2">
                        <span>Fare Structure</span>
                        <span className="text-slate-800 font-bold">Min: ₹{v.minimumFare}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Base Fare</span>
                          <span className="text-xs font-bold text-slate-900">₹{v.baseFare}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Per KM</span>
                          <span className="text-xs font-bold text-slate-900">₹{v.perKmFare}/km</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Platform</span>
                          <span className="text-xs font-bold text-slate-900">₹{v.platformFee}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Sort Order: #{v.sortOrder || 0}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(v)}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Edit3 size={12} className="text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(v)}
                      className="p-1 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-lg shadow-2xs cursor-pointer transition-colors"
                      title="Delete Vehicle"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── CLEAN TABLE VIEW ── */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider select-none">
                  <th className="py-3 px-3.5 text-center">#</th>
                  <th className="py-3 px-3.5">Vehicle</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">Payload</th>
                  <th className="py-3 px-3.5">Dimensions</th>
                  <th className="py-3 px-3.5">Suitable Cargo</th>
                  <th className="py-3 px-3.5">Base</th>
                  <th className="py-3 px-3.5">Per KM</th>
                  <th className="py-3 px-3.5">Min Fare</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVehicles.map((v, idx) => {
                  const catBadge = getCategoryBadge(v.vehicleCategory);
                  return (
                    <tr key={v._id || v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 text-center text-slate-400 font-medium">{v.sortOrder || idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                            {renderVehicleIcon(v.icon, 'w-3.5 h-3.5 text-slate-600')}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 m-0">{v.name}</p>
                            <span className="text-[10px] font-mono text-slate-400">slug: {v.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${catBadge.bg}`}>
                          {catBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">{v.capacityKg} kg</td>
                      <td className="py-3 px-3.5 text-slate-600 font-normal">{v.dimensions || '-'}</td>
                      <td className="py-3 px-3.5 text-slate-600 font-normal max-w-xs truncate" title={v.suitableFor}>
                        {v.suitableFor || '-'}
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">₹{v.baseFare}</td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">₹{v.perKmFare}/km</td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">₹{v.minimumFare}</td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(v)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-colors ${
                            v.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {v.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md border-none bg-transparent cursor-pointer transition-colors"
                            title="Edit Vehicle"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border-none bg-transparent cursor-pointer transition-colors"
                            title="Delete Vehicle"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MINIMAL CREATE / EDIT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  {isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}
                </h3>
                <p className="text-xs text-slate-500 m-0 mt-0.5">
                  Set vehicle dimensions, payload limit, and transport fare rates.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 border-none bg-transparent cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Vehicle Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tata Ace, Bike, Auto"
                    value={formData.name}
                    onChange={(e) => {
                      const nameVal = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        name: nameVal,
                        slug: isEditing ? prev.slug : nameVal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-slate-400 outline-none font-medium bg-slate-50/50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Slug (Identifier) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. mini-truck"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '') }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-slate-400 outline-none font-mono bg-slate-50/50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Category, Capacity & Dimensions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={formData.vehicleCategory}
                    onChange={(e) => setFormData(prev => ({ ...prev, vehicleCategory: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-slate-400 outline-none bg-slate-50/50 focus:bg-white cursor-pointer"
                  >
                    <option value="2_wheeler">2-Wheeler (Bike)</option>
                    <option value="3_wheeler">3-Wheeler (Auto)</option>
                    <option value="4_wheeler">4-Wheeler (Pickup / Mini)</option>
                    <option value="heavy_truck">Heavy Truck (14ft+)</option>
                    <option value="other">Other Commercial</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Payload (kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="500"
                    value={formData.capacityKg}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacityKg: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-slate-400 outline-none font-semibold bg-slate-50/50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cargo Dimensions</label>
                  <input
                    type="text"
                    placeholder="e.g. 5.5 x 4 x 4 ft"
                    value={formData.dimensions}
                    onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-slate-400 outline-none font-medium bg-slate-50/50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Suitable For & Description */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Suitable Cargo / Goods</label>
                  <input
                    type="text"
                    placeholder="e.g. Boxes, Electronics, Furniture, Documents"
                    value={formData.suitableFor}
                    onChange={(e) => setFormData(prev => ({ ...prev, suitableFor: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-slate-400 outline-none font-medium bg-slate-50/50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
                  <textarea
                    rows="2"
                    placeholder="Short description for customer booking screen..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:border-slate-400 outline-none font-medium bg-slate-50/50 focus:bg-white resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Fare & Pricing */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
                <span className="text-xs font-semibold text-slate-800 block">Pricing & Fare Rates (₹ INR)</span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Base Fare (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.baseFare}
                      onChange={(e) => setFormData(prev => ({ ...prev, baseFare: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold bg-white focus:border-slate-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Per KM (₹/km)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.perKmFare}
                      onChange={(e) => setFormData(prev => ({ ...prev, perKmFare: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold bg-white focus:border-slate-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Min Fare (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.minimumFare}
                      onChange={(e) => setFormData(prev => ({ ...prev, minimumFare: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold bg-white focus:border-slate-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Platform (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.platformFee}
                      onChange={(e) => setFormData(prev => ({ ...prev, platformFee: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold bg-white focus:border-slate-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Icon, Order, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Icon Type</label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-slate-400 outline-none bg-slate-50/50 focus:bg-white cursor-pointer"
                  >
                    <option value="bike">Bike / Two-Wheeler</option>
                    <option value="auto">Auto (3-Wheeler)</option>
                    <option value="truck">Mini Truck</option>
                    <option value="pickup">Pickup</option>
                    <option value="car">Car / Van</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-slate-400 outline-none font-semibold bg-slate-50/50 focus:bg-white"
                  />
                </div>

                <div className="pt-4 flex items-center">
                  <label className="text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-[#ff5500] rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Active for Booking</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium text-xs bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-lg bg-[#ff5500] hover:bg-[#ea4e00] text-white font-semibold text-xs shadow-xs cursor-pointer transition-all flex items-center gap-1.5 border-none"
                >
                  {modalLoading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>{isEditing ? 'Save Changes' : 'Register Vehicle'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-medium py-2 px-3.5 rounded-lg shadow-lg flex items-center gap-2 animate-slideUp">
          <CheckCircle size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default VehicleDetailsManagement;

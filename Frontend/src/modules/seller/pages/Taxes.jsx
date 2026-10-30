import React, { useState } from 'react';
import { Plus, Percent, Edit, Trash2, CheckCircle2, X } from 'lucide-react';

const initialTaxes = [
  { id: 'TAX-01', name: 'GST 5% (Essential Food Grains)', rate: '5%', hsnCode: '1001', type: 'Percentage', status: 'Active' },
  { id: 'TAX-02', name: 'GST 12% (Processed Edibles)', rate: '12%', hsnCode: '1512', type: 'Percentage', status: 'Active' },
  { id: 'TAX-03', name: 'GST 18% (Packaged Luxury Snacks)', rate: '18%', hsnCode: '2106', type: 'Percentage', status: 'Active' },
  { id: 'TAX-04', name: 'Exempted Items (0%)', rate: '0%', hsnCode: '0000', type: 'Exempt', status: 'Active' },
];

const Taxes = () => {
  const [taxes, setTaxes] = useState(initialTaxes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    rate: '',
    hsnCode: '',
    type: 'Percentage',
    status: 'Active',
  });

  const handleOpenAddModal = () => {
    setEditingTax(null);
    setFormData({ name: '', rate: '', hsnCode: '', type: 'Percentage', status: 'Active' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tax) => {
    setEditingTax(tax);
    setFormData({ name: tax.name, rate: tax.rate, hsnCode: tax.hsnCode, type: tax.type, status: tax.status });
    setIsModalOpen(true);
  };

  const handleDeleteTax = (id) => {
    if (confirm('Are you sure you want to delete this tax slab?')) {
      setTaxes(taxes.filter(t => t.id !== id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.rate) {
      alert('Please fill out Tax Slab Name and Rate');
      return;
    }

    if (editingTax) {
      setTaxes(taxes.map(t => t.id === editingTax.id ? { ...t, ...formData } : t));
    } else {
      const newTax = {
        id: `TAX-0${taxes.length + 1}`,
        ...formData,
        rate: formData.rate.includes('%') ? formData.rate : `${formData.rate}%`
      };
      setTaxes([...taxes, newTax]);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Page Title & Add Button Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Taxes & HSN Management</h1>
          <p className="text-sm font-normal text-slate-500 mt-1">Configure GST tax rates and HSN codes for product categories.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-[#ff7526] hover:bg-[#e65507] text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-2 text-sm"
        >
          <Plus size={18} strokeWidth={2} />
          Add Tax Rate
        </button>
      </div>

      {/* Main Card Container with Orange Title Banner */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        
        {/* Light Orange Banner Header */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <h2 className="text-white font-semibold text-lg tracking-wide">View Tax & HSN List</h2>
          <span className="text-white/90 text-xs font-medium">Total Items: {taxes.length}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4 font-semibold">Tax Slab Name</th>
                <th className="px-6 py-4 font-semibold">Rate</th>
                <th className="px-6 py-4 font-semibold">HSN Code</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-normal text-slate-700 divide-y divide-slate-100">
              {taxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-2">
                    <Percent size={16} className="text-[#ff7526]" />
                    {tax.name}
                  </td>
                  <td className="px-6 py-4 font-semibold text-[#ff7526]">{tax.rate}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{tax.hsnCode}</td>
                  <td className="px-6 py-4 font-normal text-slate-600">{tax.type}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${tax.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      <CheckCircle2 size={13} />
                      {tax.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {/* Action buttons visible all the time */}
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenEditModal(tax)}
                        className="p-1.5 text-slate-500 hover:text-[#ff7526] bg-white rounded-md border border-slate-200 shadow-xs cursor-pointer transition-colors" 
                        title="Edit Tax Rate"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTax(tax.id)}
                        className="p-1.5 text-slate-500 hover:text-red-600 bg-white rounded-md border border-slate-200 shadow-xs cursor-pointer transition-colors" 
                        title="Delete Tax Rate"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {taxes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 text-sm font-normal">
                    No tax slabs available. Click "Add Tax Rate" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Tax Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#ff7526] px-5 py-4 flex justify-between items-center text-white">
              <h3 className="font-semibold text-lg">{editingTax ? 'Edit Tax Rate' : 'Add New Tax Rate'}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white bg-transparent border-none cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Tax Slab Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GST 28% (Automobiles)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-sm font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Rate (%) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="28%"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-sm font-normal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">HSN Code</label>
                  <input
                    type="text"
                    placeholder="8703"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-sm font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Tax Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-sm font-normal bg-white cursor-pointer"
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Exempt">Exempt</option>
                    <option value="Flat">Flat Amount</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-sm font-normal bg-white cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ff7526] hover:bg-[#e65507] text-white rounded-lg font-medium text-sm cursor-pointer border-none shadow-sm"
                >
                  {editingTax ? 'Update Tax Rate' : 'Save Tax Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Taxes;

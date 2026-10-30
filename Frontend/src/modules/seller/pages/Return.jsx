import React, { useState, useEffect } from 'react';
import { 
  Download, ChevronDown, FileText, FileSpreadsheet, CheckCircle2, 
  AlertCircle, XCircle, RefreshCw, RotateCcw, Truck, User, 
  ShieldCheck, AlertTriangle, Eye, X, Loader2, Check, PackageCheck 
} from 'lucide-react';
import { returnService } from '../../../services/authService';

const Return = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected Return Detail / Action Modal
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Quality Verification Checklist State
  const [verificationData, setVerificationData] = useState({
    correctItem: true,
    undamaged: true,
    originalTagsPresent: true,
    packagingIntact: true,
    failureReason: '',
    verifierNotes: '',
  });

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await returnService.getSellerReturns({
        status: statusFilter === 'All' ? '' : statusFilter,
      });
      if (res && res.success && Array.isArray(res.returns)) {
        setReturns(res.returns);
      } else {
        setReturns([]);
      }
    } catch (e) {
      console.error('Fetch seller returns error:', e);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetailModal = (ret) => {
    setSelectedReturn(ret);
    setVerificationData({
      correctItem: true,
      undamaged: true,
      originalTagsPresent: true,
      packagingIntact: true,
      failureReason: '',
      verifierNotes: '',
    });
    setActionError('');
    setActionSuccess('');
    setIsDetailModalOpen(true);
  };

  // Seller approves or rejects initial request
  const handleApproveOrReject = async (action, rejectionReason = '') => {
    if (!selectedReturn) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await returnService.sellerApproveReturn(selectedReturn._id || selectedReturn.returnId, action, rejectionReason);
      if (res && res.success) {
        setActionSuccess(`Return request ${action === 'APPROVE' ? 'Approved & Assigned to Captain pickup' : 'Rejected'}.`);
        setTimeout(() => {
          setIsDetailModalOpen(false);
          fetchReturns();
        }, 1500);
      } else {
        setActionError(res?.message || 'Failed to update return request.');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Error processing request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Seller marks returned item received
  const handleMarkReceived = async () => {
    if (!selectedReturn) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await returnService.sellerReceiveReturn(selectedReturn._id || selectedReturn.returnId);
      if (res && res.success) {
        setActionSuccess('Product marked as received! You can now complete quality verification.');
        setSelectedReturn(res.returnRequest);
        fetchReturns();
      } else {
        setActionError(res?.message || 'Failed to mark product as received.');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Error updating receiving status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Seller submits quality verification (Pass or Fail)
  const handleVerifyProduct = async (verificationPassed) => {
    if (!selectedReturn) return;
    if (!verificationPassed && !verificationData.failureReason.trim()) {
      setActionError('Please specify the reason why the product failed verification.');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const res = await returnService.sellerVerifyReturn(selectedReturn._id || selectedReturn.returnId, {
        verificationPassed,
        checklist: {
          correctItem: verificationData.correctItem,
          undamaged: verificationData.undamaged,
          originalTagsPresent: verificationData.originalTagsPresent,
          packagingIntact: verificationData.packagingIntact,
        },
        failureReason: verificationData.failureReason,
        verifierNotes: verificationData.verifierNotes,
      });

      if (res && res.success) {
        setActionSuccess(
          verificationPassed
            ? 'Verification PASSED! Refund processed, stock restored, and return completed.'
            : 'Verification FAILED. Return marked as failed inspection.'
        );
        setTimeout(() => {
          setIsDetailModalOpen(false);
          fetchReturns();
        }, 1800);
      } else {
        setActionError(res?.message || 'Failed to submit verification.');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Error submitting verification.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredReturns = returns.filter((r) => {
    const s = searchTerm.toLowerCase();
    return (
      (r.returnId || '').toLowerCase().includes(s) ||
      (r.orderId || '').toLowerCase().includes(s) ||
      (r.customerName || '').toLowerCase().includes(s) ||
      (r.productName || '').toLowerCase().includes(s) ||
      (r.reason || '').toLowerCase().includes(s)
    );
  });

  const exportReturns = (format = 'csv') => {
    if (filteredReturns.length === 0) {
      alert('No return data available to export.');
      return;
    }

    const headers = ['Return ID', 'Order ID', 'Customer', 'Product', 'Quantity', 'Refund Amount', 'Reason', 'Status', 'Date'];
    const rows = filteredReturns.map((r) => [
      `"${r.returnId}"`,
      `"${r.orderId}"`,
      `"${r.customerName}"`,
      `"${r.productName}"`,
      `"${r.quantity}"`,
      `"₹${r.refundAmount}"`,
      `"${r.reason}"`,
      `"${r.status}"`,
      `"${new Date(r.createdAt).toLocaleDateString()}"`,
    ]);

    const csvString = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Returns_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="text-[#ff7526]" size={24} /> Returns & Reverse Logistics
          </h1>
          <p className="text-sm font-normal text-slate-500 mt-0.5">
            Review item-level return requests, track Captain pickup, inspect returned items, and process refunds.
          </p>
        </div>
        <button
          onClick={fetchReturns}
          className="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 border-none cursor-pointer transition-colors shadow-2xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Returns
        </button>
      </div>

      {/* Main Unified Card Container */}
      <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200 bg-white">
        
        {/* Banner Header */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center text-white">
          <h2 className="font-bold text-base md:text-lg tracking-wide m-0 flex items-center gap-2">
            <span>📦</span> Item Returns Management
          </h2>
          <span className="text-white/90 text-xs font-semibold">Total Requests: {filteredReturns.length}</span>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-700">
          
          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-xs uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-800 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-xs font-bold transition-all"
            >
              <option value="All">All Statuses</option>
              <option value="REQUESTED">Pending Request (Action Needed)</option>
              <option value="APPROVED">Approved / In Pickup</option>
              <option value="PICKED_UP">Picked Up by Captain</option>
              <option value="UNDER_VERIFICATION">Under Quality Check</option>
              <option value="COMPLETED">Completed / Refunded</option>
              <option value="REJECTED">Rejected</option>
              <option value="VERIFICATION_FAILED">Verification Failed</option>
            </select>
          </div>

          {/* Search Field */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search Return ID, Order, Customer, Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 outline-none focus:border-[#ff7526] text-xs font-medium w-56 sm:w-72 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Export Button & Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-[#ff7526] hover:bg-[#e65507] text-white font-bold py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer border-none flex items-center gap-1.5 text-xs"
            >
              <Download size={14} />
              Export
              <ChevronDown size={14} />
            </button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => exportReturns('csv')}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileText size={15} className="text-[#ff7526]" />
                  Export as CSV
                </button>
                <button
                  onClick={() => exportReturns('excel')}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600" />
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
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                <th className="px-5 py-3.5">Return ID</th>
                <th className="px-5 py-3.5">Order ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Item & Qty</th>
                <th className="px-5 py-3.5">Est. Refund</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
              {filteredReturns.slice(0, pageSize).map((ret) => (
                <tr key={ret._id || ret.returnId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-[#ff7526] font-mono">#{ret.returnId}</td>
                  <td className="px-5 py-3.5 font-mono text-slate-500">#{ret.orderId}</td>
                  <td className="px-5 py-3.5 font-bold text-slate-900">{ret.customerName}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-slate-800 block line-clamp-1">{ret.productName}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Qty: {ret.quantity}</span>
                  </td>
                  <td className="px-5 py-3.5 font-extrabold text-[#ea580c]">₹{Number(ret.refundAmount || 0).toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-[11px] max-w-xs truncate">{ret.reason}</td>
                  <td className="px-5 py-3.5">
                    <ReturnStatusBadge status={ret.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button 
                      onClick={() => handleOpenDetailModal(ret)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-[#ff7526] border border-slate-200 hover:border-orange-200 rounded-xl font-bold text-[11px] cursor-pointer transition-all flex items-center gap-1 ml-auto"
                    >
                      <Eye size={12} />
                      {ret.status === 'REQUESTED' ? 'Review Request' : ret.status === 'RECEIVED_BY_SELLER' || ret.status === 'UNDER_VERIFICATION' ? 'Verify Quality' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredReturns.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin text-orange-500" />
                        <span>Loading return requests...</span>
                      </div>
                    ) : (
                      'No return requests match your criteria.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review / Quality Inspection Modal */}
      {isDetailModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#ea580c] flex items-center justify-center">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0">Return Request Details</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">Return #{selectedReturn.returnId} • Order #{selectedReturn.orderId}</span>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer border-none"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              
              {actionSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Status Header Bar */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Current Status</span>
                  <span className="text-sm font-extrabold text-slate-900">{selectedReturn.status.replace(/_/g, ' ')}</span>
                </div>
                <ReturnStatusBadge status={selectedReturn.status} />
              </div>

              {/* Product & Return Reason Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Item Returned</span>
                  <h4 className="text-sm font-extrabold text-slate-900 m-0">{selectedReturn.productName}</h4>
                  <p className="text-slate-600 m-0">Return Quantity: <span className="font-bold text-slate-900">{selectedReturn.quantity} unit(s)</span></p>
                  <p className="text-slate-600 m-0">Calculated Refund: <span className="font-black text-[#ea580c]">₹{Number(selectedReturn.refundAmount || 0).toFixed(2)}</span></p>
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Customer Information</span>
                  <h4 className="text-sm font-bold text-slate-900 m-0">{selectedReturn.customerName}</h4>
                  <p className="text-slate-600 m-0">📞 {selectedReturn.customerPhone || 'N/A'}</p>
                  <p className="text-slate-500 m-0 text-[11px] leading-relaxed">
                    📍 {selectedReturn.customerAddress?.addressLine1}, {selectedReturn.customerAddress?.city} - {selectedReturn.customerAddress?.pincode}
                  </p>
                </div>
              </div>

              {/* Customer Reason & Notes */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1 text-xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">Customer Return Reason</span>
                <p className="font-bold text-slate-900 m-0">{selectedReturn.reason}</p>
                {selectedReturn.customerNotes && (
                  <p className="text-slate-600 m-0 italic text-[11px]">"{selectedReturn.customerNotes}"</p>
                )}
              </div>

              {/* Captain Assignment Info if assigned */}
              {selectedReturn.captain && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <Truck size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">Assigned Captain</span>
                      <span className="font-bold text-slate-900">{selectedReturn.captain.name || 'Captain'} • {selectedReturn.captain.vehicleType || 'Partner'}</span>
                    </div>
                  </div>
                  {selectedReturn.returnOtpVerifiedAt && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-1 rounded-md border border-emerald-200">
                      ✓ OTP Verified
                    </span>
                  )}
                </div>
              )}

              {/* STAGE 1 ACTION: APPROVE / REJECT REQUEST */}
              {selectedReturn.status === 'REQUESTED' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider m-0">
                    Seller Request Decision
                  </h4>
                  <p className="text-[11px] text-slate-500 m-0">
                    Approving will automatically trigger Captain pickup assignment for doorstep item collection.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApproveOrReject('REJECT', 'Rejected by Seller')}
                      className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 cursor-pointer transition-colors"
                    >
                      Reject Return
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApproveOrReject('APPROVE')}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Approve & Dispatch Captain
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 2 ACTION: PRODUCT QUALITY VERIFICATION */}
              {(selectedReturn.status === 'RECEIVED_BY_SELLER' || selectedReturn.status === 'UNDER_VERIFICATION') && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="text-[#ff7526]" size={18} />
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider m-0">
                        Product Quality Inspection Checklist
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">Step 2 of 2</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verificationData.correctItem}
                        onChange={(e) => setVerificationData((prev) => ({ ...prev, correctItem: e.target.checked }))}
                        className="rounded text-orange-500"
                      />
                      <span className="font-semibold text-slate-800">Correct Product & Variant</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verificationData.undamaged}
                        onChange={(e) => setVerificationData((prev) => ({ ...prev, undamaged: e.target.checked }))}
                        className="rounded text-orange-500"
                      />
                      <span className="font-semibold text-slate-800">No Physical Damage</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verificationData.originalTagsPresent}
                        onChange={(e) => setVerificationData((prev) => ({ ...prev, originalTagsPresent: e.target.checked }))}
                        className="rounded text-orange-500"
                      />
                      <span className="font-semibold text-slate-800">Original Tags & Labels Intact</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verificationData.packagingIntact}
                        onChange={(e) => setVerificationData((prev) => ({ ...prev, packagingIntact: e.target.checked }))}
                        className="rounded text-orange-500"
                      />
                      <span className="font-semibold text-slate-800">Original Packaging Available</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">Inspection Notes (Optional):</label>
                    <textarea
                      value={verificationData.verifierNotes}
                      onChange={(e) => setVerificationData((prev) => ({ ...prev, verifierNotes: e.target.value }))}
                      placeholder="Notes regarding condition, packaging, or inspection..."
                      rows={2}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleVerifyProduct(false)}
                      className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 cursor-pointer transition-colors"
                    >
                      Fail Inspection
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleVerifyProduct(true)}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                      Pass Inspection & Complete Refund
                    </button>
                  </div>
                </div>
              )}

              {/* TIMELINE */}
              {selectedReturn.timeline && selectedReturn.timeline.length > 0 && (
                <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 m-0">Return Lifecycle History</h4>
                  <div className="space-y-2 divide-y divide-slate-200/60">
                    {selectedReturn.timeline.map((step, idx) => (
                      <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 block">{step.title}</span>
                          <span className="text-[11px] text-slate-500">{step.description}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

const ReturnStatusBadge = ({ status }) => {
  if (['COMPLETED', 'REFUNDED'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={12} />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }
  if (['REQUESTED', 'APPROVED', 'CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKED_UP', 'UNDER_VERIFICATION'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
        <AlertCircle size={12} />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
      <XCircle size={12} />
      {status ? status.replace(/_/g, ' ') : 'REJECTED'}
    </span>
  );
};

export default Return;

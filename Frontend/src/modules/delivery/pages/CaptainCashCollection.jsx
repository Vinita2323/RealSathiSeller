import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService } from '../../../services/authService';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0);

const CaptainCashCollection = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('collections'); // 'collections' | 'settlements'
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    outstandingCash: 0,
    totalCodCollected: 0,
    todayCollected: 0,
    pendingSettlementAmount: 0,
  });

  // Modal State
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, setRes] = await Promise.all([
        captainService.getCodCollections().catch(() => ({ success: false })),
        captainService.getCashSettlements().catch(() => ({ success: false })),
      ]);

      if (colRes.success) {
        setCollections(colRes.collections || []);
        if (colRes.summary) {
          setSummary(colRes.summary);
        }
      }

      if (setRes.success) {
        setSettlements(setRes.settlements || []);
      }
    } catch (err) {
      console.error('Fetch cash collection data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setProofImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitSettlement = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(settleAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid settlement amount.');
      return;
    }

    if (amt > summary.outstandingCash) {
      setErrorMsg(`Amount cannot exceed your outstanding COD cash of ${fmt(summary.outstandingCash)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await captainService.requestCashSettlement({
        amount: amt,
        paymentMode,
        transactionReference: transactionRef,
        proofDocument: proofImage,
        remarks,
      });

      if (res.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setShowSettleModal(false);
          setSubmitSuccess(false);
          setSettleAmount('');
          setTransactionRef('');
          setRemarks('');
          setProofImage('');
          fetchData();
        }, 1500);
      } else {
        setErrorMsg(res.message || 'Failed to submit settlement request.');
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Settlement submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            APPROVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            REJECTED
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            PENDING VERIFICATION
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-800 font-sans">
      {/* ── Top Header ── */}
      <div className="bg-[#002625] text-white pt-6 pb-12 px-4 relative overflow-hidden shadow-lg">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#0b3d3b]/40 rounded-full blur-2xl pointer-events-none"></div>
        <div className="max-w-md mx-auto relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/captain/dashboard')}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <h1 className="text-base font-bold tracking-tight">COD Cash Collection</h1>
            <button
              onClick={fetchData}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              title="Refresh"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
          </div>

          <p className="text-xs text-emerald-200/80 text-center max-w-xs mx-auto">
            Manage physical Cash on Delivery collected from customers & submit settlements to Sathi Seller.
          </p>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="max-w-md mx-auto px-4 -mt-8 space-y-4">
        {/* Outstanding Cash Hero Card */}
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-amber-500 text-sm">payments</span>
                Outstanding COD Cash
              </span>
              <h2 className="text-3xl font-black text-slate-900 mt-1 font-mono tracking-tight">
                {fmt(summary.outstandingCash)}
              </h2>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold text-lg">
              ₹
            </div>
          </div>

          <p className="text-[11.5px] text-slate-500 mt-2 leading-relaxed">
            Total cash collected in hand from completed COD orders awaiting settlement with platform.
          </p>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={() => {
                setSettleAmount(summary.outstandingCash > 0 ? String(summary.outstandingCash) : '');
                setShowSettleModal(true);
              }}
              disabled={summary.outstandingCash <= 0}
              className="flex-1 py-3 px-4 bg-[#ff5500] hover:bg-[#e04b00] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">account_balance</span>
              Settle Cash with Sathi Seller
            </button>
            <button
              onClick={() => navigate('/captain/wallet')}
              className="py-3 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer transition-colors"
              title="View Earnings Wallet"
            >
              <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            </button>
          </div>
        </div>

        {/* 3 Quick Stat Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs text-center">
            <span className="text-[10px] font-bold text-slate-400 block truncate">Today's Cash</span>
            <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">
              {fmt(summary.todayCollected)}
            </span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs text-center">
            <span className="text-[10px] font-bold text-slate-400 block truncate">Pending Settle</span>
            <span className="text-sm font-black text-amber-600 font-mono mt-0.5 block">
              {fmt(summary.pendingSettlementAmount)}
            </span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs text-center">
            <span className="text-[10px] font-bold text-slate-400 block truncate">Total Lifetime</span>
            <span className="text-sm font-black text-emerald-700 font-mono mt-0.5 block">
              {fmt(summary.totalCodCollected)}
            </span>
          </div>
        </div>

        {/* ── Tabs: Cash Collections vs Settlement Requests ── */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('collections')}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'collections'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              COD Collections ({collections.length})
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'settlements'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">history_edu</span>
              Settlements ({settlements.length})
            </button>
          </div>

          {/* Tab 1: COD Collections History */}
          {activeTab === 'collections' && (
            <div className="space-y-2.5 pt-1">
              {loading ? (
                <div className="py-12 text-center text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600 mb-2">sync</span>
                  <p className="text-xs font-semibold">Loading collection history…</p>
                </div>
              ) : collections.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <span className="material-symbols-outlined text-3xl">payments</span>
                  </div>
                  <p className="text-xs font-bold text-slate-600">No COD Cash Collected Yet</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    When you deliver Cash on Delivery orders, collected cash will automatically appear here.
                  </p>
                </div>
              ) : (
                collections.map((item) => (
                  <div
                    key={item._id || item.collectionId}
                    className="p-3.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg">local_shipping</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-slate-900">
                            Order #{item.orderId || item.order?.orderId || 'COD'}
                          </span>
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                            COLLECTED
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(item.collectedAt || item.createdAt)}
                        </p>
                        {item.order?.shippingAddress?.city && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[170px]">
                            📍 {item.order?.shippingAddress?.city}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-amber-900 font-mono block">
                        + {fmt(item.amount)}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Cash</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Settlement Requests History */}
          {activeTab === 'settlements' && (
            <div className="space-y-2.5 pt-1">
              {loading ? (
                <div className="py-12 text-center text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600 mb-2">sync</span>
                  <p className="text-xs font-semibold">Loading settlements…</p>
                </div>
              ) : settlements.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <span className="material-symbols-outlined text-3xl">history_edu</span>
                  </div>
                  <p className="text-xs font-bold text-slate-600">No Settlement Requests</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Click "Settle Cash with Sathi Seller" above to deposit and clear your collected COD cash balance.
                  </p>
                </div>
              ) : (
                settlements.map((st) => (
                  <div
                    key={st._id || st.settlementId}
                    className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block font-mono">
                          #{st.settlementId}
                        </span>
                        <span className="text-xs font-black text-slate-900">
                          {st.paymentMode?.replace('_', ' ') || 'Settlement'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 font-mono block">
                          {fmt(st.amount)}
                        </span>
                        {getStatusBadge(st.status)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Submitted: {formatDate(st.createdAt)}</span>
                      {st.transactionReference && (
                        <span className="font-mono text-slate-600">Ref: {st.transactionReference}</span>
                      )}
                    </div>

                    {st.adminRemarks && (
                      <div className="p-2 bg-white rounded-xl border border-slate-200 text-[10.5px] text-slate-600">
                        <span className="font-bold text-slate-800">Admin Note: </span>
                        {st.adminRemarks}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SETTLEMENT SUBMISSION MODAL ── */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-lg">account_balance</span>
                  Settle Cash Balance
                </h3>
                <p className="text-[10px] text-slate-400">Deposit collected COD cash to Sathi Seller</p>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Settlement Submitted!</h4>
                <p className="text-xs text-slate-500">
                  Admin will verify your payment and approve your settlement.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitSettlement} className="space-y-3.5">
                {/* Available Outstanding Note */}
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">Current Outstanding:</span>
                  <span className="text-sm font-black text-amber-900 font-mono">
                    {fmt(summary.outstandingCash)}
                  </span>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Settlement Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={summary.outstandingCash}
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full pl-8 pr-20 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setSettleAmount(String(summary.outstandingCash))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-lg hover:bg-emerald-200 cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS / RTGS)</option>
                    <option value="CASH_DEPOSIT">Cash Deposit at Sathi Seller Hub / Office</option>
                    <option value="OFFICE_PAYMENT">Office Direct Handover</option>
                  </select>
                </div>

                {/* Transaction Reference / UTR */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Transaction ID / UTR / Receipt Ref
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. 312345678901 or Hub Receipt No."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Proof Screenshot Upload */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Payment Proof / Screenshot (Optional)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {proofImage ? (
                    <div className="relative w-full h-28 rounded-xl overflow-hidden border border-emerald-300 bg-slate-100">
                      <img src={proofImage} alt="Payment Proof" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProofImage('')}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 bg-slate-50 border border-dashed border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-emerald-700">upload_file</span>
                      Attach Screenshot or Receipt
                    </button>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Any comments or reference for Admin..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 resize-none"
                  />
                </div>

                {errorMsg && (
                  <p className="text-center text-xs text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200">
                    {errorMsg}
                  </p>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettleModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-2 py-3 bg-[#002625] hover:bg-[#0b3d3b] text-white font-extrabold text-xs rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {submitting ? (
                      <span className="material-symbols-outlined animate-spin text-base">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-base">send</span>
                    )}
                    {submitting ? 'Submitting…' : 'Submit Settlement Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Captain Bottom Navigation */}
      <CaptainBottomNav />
    </div>
  );
};

export default CaptainCashCollection;

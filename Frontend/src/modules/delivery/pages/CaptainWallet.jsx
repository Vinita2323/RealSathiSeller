import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService } from '../../../services/authService';

const CaptainWallet = () => {
  const navigate = useNavigate();
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutStatus, setCashoutStatus] = useState('idle'); // 'idle' | 'transferring' | 'done'
  const [filterType, setFilterType] = useState('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [txnLoading, setTxnLoading] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchTransactions('All');
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await captainService.getWallet();
      if (res.success) setWalletData(res.wallet);
    } catch (err) {
      console.error('Fetch wallet error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (type) => {
    setTxnLoading(true);
    try {
      const res = await captainService.getTransactions(type);
      setTransactions(res.transactions || []);
    } catch (err) {
      console.error('Fetch transactions error:', err);
    } finally {
      setTxnLoading(false);
    }
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    setShowFilterDropdown(false);
    fetchTransactions(type);
  };

  const handleCashout = async () => {
    const amount = parseFloat(cashoutAmount) || walletData?.balance || 0;
    if (amount <= 0) return;
    setCashoutStatus('transferring');
    try {
      await captainService.requestWithdrawal(amount);
      setCashoutStatus('done');
      setTimeout(() => {
        setShowCashoutModal(false);
        setCashoutStatus('idle');
        setCashoutAmount('');
        fetchWallet();
        fetchTransactions(filterType);
      }, 1500);
    } catch (err) {
      alert(err?.response?.data?.message || 'Withdrawal failed. Try again.');
      setCashoutStatus('idle');
    }
  };

  const handleExport = () => {
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['Transaction ID', 'Date & Time', 'Type', 'Amount', 'Description', 'Status'];
    const csvRows = [headers.join(',')];
    transactions.forEach((trx) => {
      const amount = Number(trx.amount || 0);
      const signed = trx.type === 'CREDIT' ? amount : -amount;
      const row = [
        escapeCsv(trx.transactionId),
        escapeCsv(new Date(trx.createdAt).toLocaleString('en-IN')),
        escapeCsv(trx.type || ''),
        // Numeric amount without currency symbol so Excel/Sheets can open & sum (#67)
        escapeCsv(signed.toFixed(2)),
        escapeCsv(trx.description || ''),
        escapeCsv(trx.status || ''),
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sathiseller_captain_wallet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return `Today, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    if (diff < 172800000) return `Yesterday`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen pb-28">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-40 bg-gradient-to-r from-[#002625] to-[#0a3d16] shadow-md rounded-b-2xl px-3.5 py-2.5 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center cursor-pointer shrink-0">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline-md text-base md:text-lg font-bold text-white tracking-tight leading-none">Earnings & Wallet</h1>
              <p className="text-[9.5px] text-[#97fc43] font-medium uppercase tracking-wider mt-0.5">Real-time Payouts</p>
            </div>
          </div>
          <button onClick={handleExport} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg px-2.5 py-1 cursor-pointer flex items-center gap-1 text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px]">download</span>
            Export
          </button>
        </div>
      </header>

      <main className="pt-16 px-4 max-w-7xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined text-5xl text-secondary animate-spin">sync</span>
            <p className="text-sm text-on-surface-variant font-semibold">Loading wallet…</p>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="p-5 rounded-3xl relative overflow-hidden bg-[#002625] shadow-xl border border-emerald-900/40 text-white max-w-sm mx-auto w-full">
              <div className="absolute top-2 right-2 opacity-15">
                <span className="material-symbols-outlined text-[80px] text-[#97fc43]">account_balance_wallet</span>
              </div>
              <div className="relative z-10 space-y-3">
                <div>
                  <p className="text-[10px] font-label-sm text-[#97fc43] uppercase tracking-widest font-black">Available Balance</p>
                  <h2 className="text-3xl font-extrabold text-white mt-0.5 tracking-tight">
                    ₹{(walletData?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h2>
                </div>
                <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-200 font-medium">
                    <span className="material-symbols-outlined text-[14px] text-[#97fc43]">schedule</span>
                    Next auto-payout: {walletData?.nextPayoutDate || 'Tuesday'}
                  </div>
                  <button
                    onClick={() => { setShowCashoutModal(true); setCashoutAmount(String(walletData?.balance || '')); }}
                    disabled={(walletData?.balance || 0) <= 0}
                    className="w-full bg-[#97fc43] hover:bg-[#86e835] text-[#002625] font-black py-2.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    Request Payout
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-panel p-3.5 rounded-2xl space-y-0.5">
                <p className="text-[10.5px] font-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Total Deliveries</p>
                <p className="text-xl font-extrabold text-primary">{walletData?.totalDeliveries || transactions.filter(t => t.type === 'CREDIT').length || 0}</p>
                <span className="text-[9.5px] text-on-surface-variant/80">Completed jobs</span>
              </div>
              <div className="glass-panel p-3.5 rounded-2xl space-y-0.5">
                <p className="text-[10.5px] font-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Total Earnings</p>
                <p className="text-xl font-extrabold text-primary">₹{(walletData?.totalEarnings || (walletData?.fromTransport || 0) + (walletData?.fromDeliveries || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <span className="text-[9.5px] text-on-surface-variant/80">Gross earnings</span>
              </div>
              <div className="glass-panel p-3.5 rounded-2xl space-y-0.5">
                <p className="text-[10.5px] font-label-sm text-[#ff5500] uppercase tracking-wider font-bold">Commission</p>
                <p className="text-xl font-extrabold text-[#ff5500]">₹{(walletData?.totalCommissionDeducted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <span className="text-[9.5px] text-on-surface-variant/80">Platform cut</span>
              </div>
              <div className="glass-panel p-3.5 rounded-2xl space-y-0.5">
                <p className="text-[10.5px] font-label-sm text-secondary uppercase tracking-wider font-bold">Net Earnings</p>
                <p className="text-xl font-extrabold text-secondary">₹{(walletData?.netEarnings || walletData?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <span className="text-[9.5px] text-on-surface-variant/80">Credited to wallet</span>
              </div>
            </section>

            {/* Payout Account */}
            {walletData?.bankDetails?.bankName && (
              <div className="glass-panel p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-primary">Payout Account</h3>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined">account_balance</span>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-primary">{walletData.bankDetails.bankName}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {walletData.bankDetails.upiId
                          ? `UPI: ${walletData.bankDetails.upiId}`
                          : `A/C •••• ${(walletData.bankDetails.accountNumber || '').slice(-4)}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-full">PRIMARY</span>
                </div>
              </div>
            )}

            {/* COD Cash Collection Banner */}
            <div
              onClick={() => navigate('/captain/cash-collection')}
              className="bg-amber-50 hover:bg-amber-100/80 border border-amber-300 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-lg">
                  ₹
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    COD Cash Collection & Settlement
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">Manage</span>
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    Collected Cash in Hand: <strong className="font-mono">₹{Number(walletData?.outstandingCash || 0).toFixed(2)}</strong>
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-amber-800">chevron_right</span>
            </div>

            {/* Transaction History */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center relative">
                <h3 className="font-bold text-sm text-primary">
                  Recent Transactions {filterType !== 'All' && <span className="text-[#15803d]">({filterType})</span>}
                </h3>
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`text-xs font-bold cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${showFilterDropdown ? 'bg-[#366b00] text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    Filter
                  </button>
                  {showFilterDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-36 bg-white shadow-xl border border-slate-200 rounded-xl overflow-hidden z-20">
                      {['All', 'Earnings', 'Withdrawals'].map((type) => (
                        <button
                          key={type}
                          onClick={() => handleFilterChange(type)}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold cursor-pointer ${filterType === type ? 'text-[#15803d] bg-emerald-50' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {txnLoading ? (
                <div className="flex justify-center py-8">
                  <span className="material-symbols-outlined text-3xl text-secondary animate-spin">sync</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-2 block">receipt_long</span>
                  <p className="text-sm font-semibold">No transactions yet</p>
                  <p className="text-xs mt-1">Earnings from deliveries will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((trx) => (
                    <div key={trx._id || trx.transactionId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-surface-container-low/70 rounded-xl gap-2">
                      <div className="space-y-0.5">
                        <p className="font-bold text-xs text-primary">{trx.description || trx.type}</p>
                        <p className="text-[11px] text-on-surface-variant">{formatDate(trx.createdAt)} • {trx.transactionId}</p>
                        {trx.type === 'CREDIT' && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-600 font-medium pt-0.5">
                            {trx.grossAmount > 0 && <span>Order/Fare: <strong>₹{trx.grossAmount.toFixed(2)}</strong></span>}
                            {trx.commissionRate > 0 && <span>Commission: <strong className="text-amber-600">{trx.commissionRate}%</strong></span>}
                            {trx.commissionAmount > 0 && <span>Fee: <strong className="text-rose-600">-₹{trx.commissionAmount.toFixed(2)}</strong></span>}
                          </div>
                        )}
                      </div>
                      <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end border-t sm:border-0 border-slate-200/50 pt-1.5 sm:pt-0">
                        <p className={`font-black text-sm ${trx.type === 'CREDIT' ? 'text-secondary' : 'text-error'} m-0`}>
                          {trx.type === 'CREDIT' ? '+' : '-'}₹{trx.amount.toFixed(2)}
                        </p>
                        <span className="text-[10px] font-semibold text-outline-variant">{trx.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Cashout Modal */}
      {showCashoutModal && walletData && (
        <div className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full border-white shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-xl text-primary">Request Payout</h3>
              <p className="text-xs text-on-surface-variant">Transfer to {walletData.bankDetails?.bankName || 'your bank'} (via Super Admin Approval)</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant block">Amount to Withdraw</label>
              <input
                type="number"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                max={walletData.balance}
                min={1}
                className="w-full border border-outline-variant rounded-xl px-4 py-3 text-base font-bold text-primary focus:outline-none focus:border-secondary"
              />
              <p className="text-xs text-on-surface-variant">Available: ₹{(walletData.balance || 0).toFixed(2)}</p>
            </div>

            <div className="bg-surface-container p-3.5 rounded-xl space-y-2 text-xs border border-outline-variant/30">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Requested Amount</span>
                <span className="font-bold text-primary">₹{parseFloat(cashoutAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-outline-variant/20 pt-2 font-bold text-sm">
                <span>Net Transfer</span>
                <span className="text-secondary">₹{parseFloat(cashoutAmount || 0).toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-on-surface-variant/80 italic pt-1">
                Payout requests are reviewed and disbursed securely by platform Super Admin.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCashoutModal(false)} className="flex-1 py-3 rounded-xl border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container-high cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleCashout}
                disabled={cashoutStatus !== 'idle' || parseFloat(cashoutAmount || 0) <= 0 || parseFloat(cashoutAmount || 0) > walletData.balance}
                className="flex-1 py-3 rounded-xl bg-secondary hover:bg-secondary/90 text-white text-xs font-bold shadow-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {cashoutStatus === 'transferring' ? (
                  <><span className="material-symbols-outlined animate-spin text-sm">sync</span> Submitting...</>
                ) : cashoutStatus === 'done' ? (
                  <>Submitted for Review! <span className="material-symbols-outlined text-sm">check</span></>
                ) : 'Submit Payout Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CaptainBottomNav />
    </div>
  );
};

export default CaptainWallet;

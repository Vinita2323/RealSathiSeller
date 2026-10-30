import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, IndianRupee, ArrowUpRight, Clock, CheckCircle2, XCircle, RefreshCw, Landmark, ArrowDownLeft, Plus
} from 'lucide-react';
import { walletService } from '../../../services/authService';

const Wallet = () => {
  const [activeTab, setActiveTab] = useState('Transactions');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);

  const [walletData, setWalletData] = useState({
    availableBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    totalCommissionDeducted: 0,
    totalWithdrawn: 0,
    bankDetails: {
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      accountHolderName: '',
    },
  });

  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await walletService.getSellerWallet();
      if (res && res.success) {
        setWalletData(res.wallet || {});
        setTransactions(res.transactions || []);
        setWithdrawals(res.withdrawals || []);

        // Prefill bank details if available
        if (res.wallet?.bankDetails) {
          setBankName(res.wallet.bankDetails.bankName || '');
          setAccountNumber(res.wallet.bankDetails.accountNumber || '');
          setIfscCode(res.wallet.bankDetails.ifscCode || '');
          setAccountHolderName(res.wallet.bankDetails.accountHolderName || '');
        }
      }
    } catch (err) {
      console.error('Error fetching seller wallet:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    // Refresh wallet cards when seller orders update (delivery / settlement) — #75
    const onOrderUpdate = () => {
      fetchWallet();
    };
    window.addEventListener('seller-order-update', onOrderUpdate);
    const interval = setInterval(fetchWallet, 60000);
    return () => {
      window.removeEventListener('seller-order-update', onOrderUpdate);
      clearInterval(interval);
    };
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid withdrawal amount greater than 0.');
      return;
    }
    if (amt > walletData.availableBalance) {
      alert(`Withdrawal amount cannot exceed available balance (₹${walletData.availableBalance.toFixed(2)}).`);
      return;
    }
    if (!bankName || !accountNumber || !ifscCode) {
      alert('Please enter complete bank details (Bank Name, Account Number, and IFSC Code).');
      return;
    }

    setActionLoading(true);
    try {
      const res = await walletService.requestWithdrawal({
        amount: amt,
        bankName,
        accountNumber,
        ifscCode,
        accountHolderName,
      });

      showToast(res.message || 'Withdrawal request submitted successfully!');
      setWithdrawalModalOpen(false);
      setWithdrawAmount('');
      fetchWallet();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to submit withdrawal request.');
    } finally {
      setActionLoading(false);
    }
  };

  const isBankDetailsMissing = !walletData.bankDetails?.accountNumber || !walletData.bankDetails?.ifscCode;

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-12">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Seller Wallet & Settlement</h1>
          <p className="text-xs font-normal text-slate-500 mt-1">Manage seller balance, earnings ledger, commissions, and withdrawal payouts.</p>
        </div>
        <button
          onClick={fetchWallet}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Wallet
        </button>
      </div>

      {/* Bank Details Missing Alert Banner */}
      {isBankDetailsMissing && (
        <div className="bg-orange-50/90 border border-orange-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff7526]/10 border border-[#ff7526]/20 text-[#ff7526] flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm m-0">Bank Account Details Required</h4>
              <p className="text-xs text-slate-600 font-normal m-0 mt-0.5">Add bank account number and IFSC code to receive direct wallet payout withdrawals.</p>
            </div>
          </div>
          <button 
            onClick={() => setWithdrawalModalOpen(true)}
            className="px-4 py-2 bg-white hover:bg-orange-50 border border-orange-200 text-[#ff7526] font-extrabold text-xs rounded-xl cursor-pointer transition-colors shadow-2xs shrink-0"
          >
            Add Bank Details
          </button>
        </div>
      )}

      {/* Wallet Balance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Main Available Balance Card (Theme Orange Header) */}
        <div className="md:col-span-2 bg-gradient-to-r from-[#ff7526] via-[#ff6814] to-[#e65507] rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-4 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1 z-10">
            <span className="bg-white/20 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider backdrop-blur-xs">
              Available Wallet Balance
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white pt-2">
              ₹{Number(walletData.availableBalance || 0).toFixed(2)}
            </h2>
            <p className="text-xs text-white/90 font-normal">Ready for instant bank withdrawal settlement.</p>
          </div>

          <div className="pt-2 z-10 flex items-center gap-3">
            <button 
              disabled={walletData.availableBalance <= 0}
              onClick={() => setWithdrawalModalOpen(true)}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-[#ff7526] font-extrabold text-xs rounded-xl border-none cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowUpRight size={16} />
              Request Withdrawal
            </button>
          </div>

          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Pending Balance Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Pending Balance</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900">₹{Number(walletData.pendingBalance || 0).toFixed(2)}</h3>
            <p className="text-xs text-slate-500 font-normal">Locked pending customer order delivery completion.</p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Commission Rate:</span>
            <span className="font-extrabold text-slate-900">Applied per Order</span>
          </div>
        </div>

      </div>

      {/* Secondary Financial Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Orders</span>
          <p className="text-xl font-black text-slate-900 m-0">{transactions.filter(t => t.type === 'CREDIT').length}</p>
          <span className="text-[10px] text-slate-400">Completed order deliveries</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Sales</span>
          <p className="text-xl font-black text-slate-900 m-0">
            ₹{Number((walletData.totalEarnings || 0) + (walletData.totalCommissionDeducted || 0)).toFixed(2)}
          </p>
          <span className="text-[10px] text-slate-400">Gross customer sales</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase text-[#ff7526] tracking-wider">Commission</span>
          <p className="text-xl font-black text-[#ff7526] m-0">₹{Number(walletData.totalCommissionDeducted || 0).toFixed(2)}</p>
          <span className="text-[10px] text-slate-400">Platform commission</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase text-emerald-600 tracking-wider">Net Earnings</span>
          <p className="text-xl font-black text-emerald-600 m-0">₹{Number(walletData.totalEarnings || 0).toFixed(2)}</p>
          <span className="text-[10px] text-slate-400">Net credited revenue</span>
        </div>
      </div>

      {/* Tabs & Data Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          {['Transactions', 'Withdrawals', 'Commissions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3.5 px-6 font-extrabold text-xs cursor-pointer transition-colors border-b-2 uppercase tracking-wider ${
                activeTab === tab
                  ? 'border-[#ff7526] text-[#ff7526] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          
          {/* 1. TRANSACTIONS TAB */}
          {activeTab === 'Transactions' && (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div 
                  key={txn._id || txn.transactionId} 
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm font-mono">
                        {txn.transactionId}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Order #{txn.orderId}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                        txn.type === 'CREDIT'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : txn.type === 'WITHDRAWAL'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {txn.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-normal m-0">{txn.description}</p>
                    <p className="text-[11px] text-slate-400 font-mono m-0">
                      {new Date(txn.createdAt).toLocaleString()} | Balance: ₹{Number(txn.balanceBefore || 0).toFixed(2)} &rarr; <strong className="text-slate-900 font-bold">₹{Number(txn.balanceAfter || 0).toFixed(2)}</strong>
                    </p>
                  </div>

                  <div className={`font-black text-lg text-right shrink-0 ${txn.netAmount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {txn.netAmount > 0 ? `+₹${Number(txn.netAmount).toFixed(2)}` : `-₹${Math.abs(Number(txn.netAmount)).toFixed(2)}`}
                  </div>
                </div>
              ))}

              {!loading && transactions.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm font-normal">
                  No wallet transactions recorded yet.
                </div>
              )}
            </div>
          )}

          {/* 2. WITHDRAWALS TAB */}
          {activeTab === 'Withdrawals' && (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div 
                  key={w._id || w.withdrawalId} 
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-base m-0">₹{Number(w.amount).toFixed(2)}</h4>
                      <span className="text-xs text-slate-400 font-mono">#{w.withdrawalId}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium m-0">
                      Bank: <strong className="font-semibold">{w.bankDetails?.bankName}</strong> ({w.bankDetails?.accountNumber}) | IFSC: {w.bankDetails?.ifscCode}
                    </p>
                    <p className="text-[11px] text-slate-400 m-0">{new Date(w.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                      w.status === 'COMPLETED' || w.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : w.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))}

              {!loading && withdrawals.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm font-normal">
                  No withdrawal requests submitted yet.
                </div>
              )}
            </div>
          )}

          {/* 3. COMMISSIONS TAB */}
          {activeTab === 'Commissions' && (
            <div className="space-y-3">
              {transactions.filter(t => t.type === 'CREDIT').map((c) => (
                <div 
                  key={c._id} 
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm m-0">Order #{c.orderId}</h4>
                      <span className="text-xs font-extrabold text-[#ff7526] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                        Commission: {c.commissionRate}%
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>Order Amount: <strong className="font-bold text-slate-900">₹{Number(c.grossAmount || c.netAmount).toFixed(2)}</strong></span>
                      <span>Commission Rate: <strong className="font-bold text-[#ff7526]">{c.commissionRate}%</strong></span>
                      <span>Commission Amount: <strong className="font-bold text-rose-600">-₹{Number(c.commissionAmount || 0).toFixed(2)}</strong></span>
                    </div>
                    <p className="text-[11px] text-slate-400 m-0">{new Date(c.createdAt).toLocaleString('en-IN')}</p>
                  </div>

                  <div className="sm:text-right bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200 shrink-0">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Your Net Earning</span>
                    <span className="text-base font-black text-emerald-600 block">₹{Number(c.netAmount).toFixed(2)}</span>
                  </div>
                </div>
              ))}

              {!loading && transactions.filter(t => t.type === 'CREDIT').length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm font-normal">
                  No commission deductions recorded yet.
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* REQUEST WITHDRAWAL MODAL DIALOG */}
      {/* ------------------------------------------------------------- */}
      {withdrawalModalOpen && (
        <div 
          onClick={() => setWithdrawalModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 my-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#ff7526] flex items-center justify-center font-bold">
                  <Landmark size={18} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 m-0">Request Payout Withdrawal</h3>
              </div>
              <button 
                type="button"
                onClick={() => setWithdrawalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Available Balance</span>
              <span className="text-lg font-black text-[#ff7526]">₹{Number(walletData.availableBalance || 0).toFixed(2)}</span>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Withdrawal Amount (₹)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  max={walletData.availableBalance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount to withdraw"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#ff7526] text-sm font-bold text-slate-900"
                />
              </div>

              <div className="space-y-3 pt-1 border-t border-slate-100">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">Payout Bank Details</span>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 block">Bank Name</label>
                  <input 
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, State Bank of India"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 block">Account Number</label>
                    <input 
                      type="text"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Account No."
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-xs font-medium text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 block">IFSC Code</label>
                    <input 
                      type="text"
                      required
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      placeholder="IFSC Code"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-xs font-medium text-slate-800 uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 block">Account Holder Name</label>
                  <input 
                    type="text"
                    required
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Account Holder Full Name"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff7526] text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWithdrawalModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#ff7526] hover:bg-[#e65507] text-white font-extrabold text-xs rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95"
                >
                  {actionLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Wallet;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight,
  RefreshCw, Loader2, Receipt, ShoppingBag, RotateCcw,
} from 'lucide-react';
import { walletService } from '../../../services/authService';

const FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'CREDIT', label: 'Credits' },
  { id: 'DEBIT', label: 'Payments' },
];

const categoryIcon = (category, type) => {
  if (category === 'REFUND') return RotateCcw;
  if (category === 'ORDER_PAYMENT' || type === 'DEBIT') return ShoppingBag;
  return type === 'CREDIT' ? ArrowDownLeft : ArrowUpRight;
};

const Wallet = () => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState({ balance: 0, totalCredited: 0, totalDebited: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [errorMsg, setErrorMsg] = useState('');
  const mountedRef = useRef(true);

  const fetchWallet = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');
    try {
      const [walletRes, txnRes] = await Promise.all([
        walletService.getUserWallet(),
        walletService.getUserWalletTransactions(filterType),
      ]);
      if (!mountedRef.current) return;
      if (walletRes?.success) {
        setWallet(walletRes.wallet || { balance: 0, totalCredited: 0, totalDebited: 0 });
        if (filterType === 'All' && Array.isArray(walletRes.transactions)) {
          setTransactions(walletRes.transactions);
        }
      }
      if (txnRes?.success && Array.isArray(txnRes.transactions)) {
        setTransactions(txnRes.transactions);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorMsg(err.response?.data?.message || 'Unable to load wallet. Pull to refresh.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filterType]);

  useEffect(() => {
    mountedRef.current = true;
    fetchWallet();
    return () => { mountedRef.current = false; };
  }, [fetchWallet]);

  // Live refresh while page is open / focused
  useEffect(() => {
    const onFocus = () => fetchWallet({ silent: true });
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => fetchWallet({ silent: true }), 12000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [fetchWallet]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) {
      return `Today, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[16px] font-extrabold text-[#1e1b4b] m-0 leading-tight">My Wallet</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider m-0">Live balance</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchWallet({ silent: true })}
          disabled={refreshing}
          className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#ea580c] cursor-pointer disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </header>

      <main className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={28} className="animate-spin text-[#ea580c]" />
            <span className="text-[13px] font-medium">Loading wallet…</span>
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#ea580c] via-[#f97316] to-[#fb923c] text-white p-5 shadow-[0_12px_40px_rgba(234,88,12,0.28)]">
              <div className="absolute -right-4 -top-4 opacity-20">
                <WalletIcon size={120} />
              </div>
              <div className="relative z-10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80 m-0">Available Balance</p>
                <h2 className="text-[34px] font-black tracking-tight mt-1 mb-0">
                  ₹{Number(wallet.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <p className="text-[11px] text-white/85 mt-2 mb-0 font-medium">
                  Refunds are credited here. Use this balance at checkout.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 m-0">Total Credited</p>
                <p className="text-[18px] font-extrabold text-[#1e1b4b] mt-1 mb-0">
                  ₹{Number(wallet.totalCredited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 m-0">Total Spent</p>
                <p className="text-[18px] font-extrabold text-[#1e1b4b] mt-1 mb-0">
                  ₹{Number(wallet.totalDebited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-[12px] font-semibold px-3 py-2.5">
                {errorMsg}
              </div>
            )}

            <div className="bg-white rounded-[20px] border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-[#ea580c]" />
                  <h3 className="text-[14px] font-extrabold text-[#1e1b4b] m-0">Transactions</h3>
                </div>
              </div>

              <div className="flex gap-2 mb-3 overflow-x-auto">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterType(f.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                      filterType === f.id
                        ? 'bg-[#ea580c] text-white border-[#ea580c]'
                        : 'bg-slate-50 text-slate-600 border-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <WalletIcon size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-[13px] font-semibold m-0">No transactions yet</p>
                  <p className="text-[11px] mt-1 mb-0">Refunds and wallet payments will show up here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {transactions.map((txn) => {
                    const isCredit = txn.type === 'CREDIT';
                    const Icon = categoryIcon(txn.category, txn.type);
                    return (
                      <div
                        key={txn._id || txn.transactionId}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100/80"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                          }`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#1e1b4b] m-0 truncate">
                              {txn.description || (isCredit ? 'Wallet credit' : 'Wallet payment')}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 mb-0">
                              {formatDate(txn.createdAt)}
                              {txn.orderId ? ` · ${txn.orderId}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[13px] font-extrabold m-0 ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {isCredit ? '+' : '-'}₹{Number(txn.amount || 0).toFixed(2)}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 mb-0">
                            {txn.status || 'Completed'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Wallet;

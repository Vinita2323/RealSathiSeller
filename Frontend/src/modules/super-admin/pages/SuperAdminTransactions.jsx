import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  Search,
  Filter,
  Download,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const SuperAdminTransactions = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(25);

  // Filters
  const [category, setCategory] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Selected Txn for Detail Drawer Modal
  const [selectedTxn, setSelectedTxn] = useState(null);

  const fetchTransactions = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await superAdminService.getTransactions({
          page,
          limit,
          category,
          type,
          status,
          search: debouncedSearch,
          startDate,
          endDate,
        });

        if (res.success) {
          setTransactions(res.transactions || []);
          setTotal(res.total || 0);
          setPages(res.pages || 1);
        }
      } catch (err) {
        console.error('Fetch ledger transactions error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, category, type, status, debouncedSearch, startDate, endDate]
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Category', 'Type', 'Amount', 'Party', 'Reference', 'Status', 'Date'];
    const rows = transactions.map((t) => [
      `"${t.transactionId}"`,
      `"${t.category}"`,
      `"${t.type}"`,
      t.amount,
      `"${t.entityName || t.entityType}"`,
      `"${t.referenceId || ''}"`,
      `"${t.status}"`,
      `"${new Date(t.createdAt).toLocaleString('en-IN')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sathiseller_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const categories = [
    'ALL',
    'CUSTOMER_PAYMENT',
    'SELLER_EARNING',
    'CAPTAIN_EARNING',
    'SELLER_PAYOUT',
    'CAPTAIN_PAYOUT',
    'PLATFORM_COMMISSION',
    'REFUND',
    'FINANCIAL_ADJUSTMENT',
    'MEMBERSHIP_FEE',
    'REGISTRATION_FEE',
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Central Transaction Ledger"
        subtitle="Audited record of every money movement across users, sellers, captains, and platform treasury"
        onRefresh={() => fetchTransactions(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Filters Bar */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Txn ID, Order, Party..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#ff5500]"
              />
            </div>

            {/* Category Select */}
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
            >
              <option value="ALL">All Types (Credit/Debit)</option>
              <option value="CREDIT">Credit (+)</option>
              <option value="DEBIT">Debit (-)</option>
            </select>

            {/* Start Date */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
            />

            {/* End Date */}
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="text-slate-900 font-extrabold">{transactions.length}</span> of{' '}
              <span className="text-slate-900 font-extrabold">{total}</span> ledger entries
            </span>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl border border-slate-200 cursor-pointer transition-all shadow-2xs active:scale-95"
            >
              <FileSpreadsheet size={14} className="text-[#ff5500]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                  <th className="py-3.5 px-4 font-bold">Transaction ID</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold">Party / Entity</th>
                  <th className="py-3.5 px-4 font-bold">Amount</th>
                  <th className="py-3.5 px-4 font-bold">Type</th>
                  <th className="py-3.5 px-4 font-bold">Reference</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold">Timestamp</th>
                  <th className="py-3.5 px-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      Loading central ledger entries...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      No ledger transactions found matching the applied filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#ff5500]">{txn.transactionId}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700">
                          {txn.category?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        <div className="font-bold text-slate-900">{txn.entityName || txn.entityType}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{txn.entityType}</span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-900 font-mono text-sm">
                        ₹{Number(txn.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold font-mono text-[10.5px] ${
                            txn.type === 'CREDIT'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {txn.type === 'CREDIT' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {txn.referenceId || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {txn.status || 'SUCCESS'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(txn.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedTxn(txn)}
                          className="p-1.5 bg-slate-100 hover:bg-[#002625] text-slate-600 hover:text-white rounded-lg border border-slate-200 cursor-pointer transition-all shadow-2xs"
                          title="View complete transaction breakdown"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Page <span className="text-slate-900 font-extrabold">{page}</span> of{' '}
              <span className="text-slate-900 font-extrabold">{pages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Detail Drawer Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn text-xs border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#ff5500] tracking-wider uppercase font-black">
                  CENTRAL AUDIT ENTRY
                </span>
                <h3 className="text-lg font-black text-[#002625] m-0">{selectedTxn.transactionId}</h3>
              </div>
              <button
                onClick={() => setSelectedTxn(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Category</span>
                <span className="font-extrabold text-slate-900 font-mono">{selectedTxn.category}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Type</span>
                <span
                  className={`font-extrabold font-mono px-2 py-0.5 rounded ${
                    selectedTxn.type === 'CREDIT'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {selectedTxn.type}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Amount</span>
                <span className="font-black text-slate-900 text-sm font-mono">₹{Number(selectedTxn.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Entity / Party</span>
                <span className="font-bold text-slate-800">{selectedTxn.entityName || selectedTxn.entityType} ({selectedTxn.entityType})</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Reference</span>
                <span className="font-mono text-[#ff5500] font-bold">{selectedTxn.referenceModel} #{selectedTxn.referenceId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Balance State</span>
                <span className="font-mono text-slate-700 font-semibold">
                  ₹{Number(selectedTxn.balanceBefore || 0).toFixed(2)} ➔ ₹{Number(selectedTxn.balanceAfter || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Status</span>
                <span className="font-bold text-emerald-700">{selectedTxn.status}</span>
              </div>
              <div className="py-1.5">
                <span className="text-slate-500 font-semibold block mb-1">Description / Remarks</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium m-0">
                  {selectedTxn.description || 'No additional description provided.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedTxn(null)}
              className="w-full py-2.5 bg-[#002625] hover:bg-[#003837] text-white font-extrabold rounded-xl border-none cursor-pointer mt-2 shadow-xs transition-all active:scale-95"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

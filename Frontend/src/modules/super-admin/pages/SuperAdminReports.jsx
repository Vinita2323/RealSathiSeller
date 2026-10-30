import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { FileSpreadsheet, Download, Calendar, Filter, BarChart3, Receipt, Store, Truck, DollarSign } from 'lucide-react';

export const SuperAdminReports = () => {
  const [reportType, setReportType] = useState('transactions');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getReports({
        reportType,
        startDate,
        endDate,
      });

      if (res.success) {
        if (reportType === 'transactions') setReportData(res.transactions || []);
        else if (reportType === 'seller-settlements') setReportData(res.settlements || []);
        else if (reportType === 'captain-settlements') setReportData(res.captains || []);
        else if (reportType === 'platform-revenue') setReportData(res.orders || []);
      }
    } catch (err) {
      console.error('Fetch report error:', err);
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!reportData || reportData.length === 0) return;

    let headers = [];
    let rows = [];

    if (reportType === 'transactions') {
      headers = ['Txn ID', 'Category', 'Type', 'Amount', 'Entity', 'Status', 'Date'];
      rows = reportData.map((r) => [
        `"${r.transactionId}"`,
        `"${r.category}"`,
        `"${r.type}"`,
        r.amount,
        `"${r.entityName || r.entityType}"`,
        `"${r.status}"`,
        `"${new Date(r.createdAt).toLocaleString('en-IN')}"`,
      ]);
    } else if (reportType === 'seller-settlements') {
      headers = ['Order ID', 'Seller', 'Total Gross', 'Commission Rate', 'Commission Amount', 'Net Seller', 'Status', 'Date'];
      rows = reportData.map((r) => [
        `"${r.orderId}"`,
        `"${r.sellerName}"`,
        r.totalAmount,
        r.commissionRate,
        r.commissionAmount,
        r.netSellerAmount,
        `"${r.settlementStatus}"`,
        `"${new Date(r.createdAt).toLocaleString('en-IN')}"`,
      ]);
    } else if (reportType === 'captain-settlements') {
      headers = ['Captain Name', 'Phone', 'Vehicle', 'Wallet Balance', 'Cash Collected'];
      rows = reportData.map((r) => [
        `"${r.name}"`,
        `"${r.phone}"`,
        `"${r.vehicleType}"`,
        r.walletBalance,
        r.cashCollected,
      ]);
    } else if (reportType === 'platform-revenue') {
      headers = ['Date', 'Gross Volume', 'Items Total', 'Shipping Revenue', 'Order Count'];
      rows = reportData.map((r) => [
        `"${r._id}"`,
        r.grossVolume,
        r.itemsTotal,
        r.shippingRevenue,
        r.orderCount,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sathiseller_${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reportTabs = [
    { id: 'transactions', label: 'Transaction Report', icon: Receipt },
    { id: 'seller-settlements', label: 'Seller Settlement Report', icon: Store },
    { id: 'captain-settlements', label: 'Captain Settlement Report', icon: Truck },
    { id: 'platform-revenue', label: 'Platform Revenue Report', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Financial Reports & Exports"
        subtitle="Generate, filter, and export comprehensive transaction, settlement, and revenue reports"
        onRefresh={fetchReport}
        refreshing={loading}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Report Types Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = reportType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? 'bg-[#002625] border-[#002625] text-white shadow-md'
                    : 'bg-white border-slate-200/80 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl ${
                    isSelected ? 'bg-white/10 text-[#ff5500]' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon size={20} />
                </div>
                <div>
                  <h4 className={`text-xs font-bold m-0 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{tab.label}</h4>
                  <p className={`text-[10.5px] m-0 ${isSelected ? 'text-teal-200/80' : 'text-slate-400'}`}>Audited dataset export</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Date Filter & Export Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all font-medium"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#ff5500] hover:bg-[#ea4e00] disabled:opacity-40 text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow-sm transition-all"
          >
            <Download size={15} />
            <span>Export CSV Report ({reportData.length} records)</span>
          </button>
        </div>

        {/* Report Preview Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Live Report Preview: {reportType?.replace(/-/g, ' ').toUpperCase()}
            </span>
            <span className="text-xs text-[#002625] font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {reportData.length} rows loaded
            </span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10.5px] sticky top-0">
                  {reportType === 'transactions' && (
                    <>
                      <th className="py-3 px-4 font-bold">Txn ID</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Type</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">Entity</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Date</th>
                    </>
                  )}
                  {reportType === 'seller-settlements' && (
                    <>
                      <th className="py-3 px-4 font-bold">Order ID</th>
                      <th className="py-3 px-4 font-bold">Seller Store</th>
                      <th className="py-3 px-4 font-bold">Gross Sales</th>
                      <th className="py-3 px-4 font-bold">Commission</th>
                      <th className="py-3 px-4 font-bold">Net Seller Amount</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                    </>
                  )}
                  {reportType === 'captain-settlements' && (
                    <>
                      <th className="py-3 px-4 font-bold">Captain Name</th>
                      <th className="py-3 px-4 font-bold">Mobile</th>
                      <th className="py-3 px-4 font-bold">Vehicle</th>
                      <th className="py-3 px-4 font-bold">Wallet Balance</th>
                      <th className="py-3 px-4 font-bold">COD Cash Collected</th>
                    </>
                  )}
                  {reportType === 'platform-revenue' && (
                    <>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Gross Volume</th>
                      <th className="py-3 px-4 font-bold">Items Total</th>
                      <th className="py-3 px-4 font-bold">Shipping Revenue</th>
                      <th className="py-3 px-4 font-bold">Order Count</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">Generating report...</td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">No data found for this report and period.</td>
                  </tr>
                ) : (
                  reportData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      {reportType === 'transactions' && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-[#002625]">{item.transactionId}</td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{item.category}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{item.type}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 font-mono">₹{Number(item.amount).toFixed(2)}</td>
                          <td className="py-3 px-4 text-slate-700">{item.entityName || item.entityType}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{new Date(item.createdAt).toLocaleDateString('en-IN')}</td>
                        </>
                      )}
                      {reportType === 'seller-settlements' && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-[#002625]">#{item.orderId}</td>
                          <td className="py-3 px-4 text-slate-900 font-bold">{item.sellerName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">₹{Number(item.totalAmount || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-amber-600 font-bold">₹{Number(item.commissionAmount || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono font-black text-slate-900">₹{Number(item.netSellerAmount || 0).toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.settlementStatus}
                            </span>
                          </td>
                        </>
                      )}
                      {reportType === 'captain-settlements' && (
                        <>
                          <td className="py-3 px-4 text-slate-900 font-bold">{item.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{item.phone}</td>
                          <td className="py-3 px-4 text-slate-600">{item.vehicleType}</td>
                          <td className="py-3 px-4 font-mono font-black text-amber-600">₹{Number(item.walletBalance || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">₹{Number(item.cashCollected || 0).toFixed(2)}</td>
                        </>
                      )}
                      {reportType === 'platform-revenue' && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-[#002625]">{item._id}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">₹{Number(item.grossVolume || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">₹{Number(item.itemsTotal || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">₹{Number(item.shippingRevenue || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-600">{item.orderCount}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

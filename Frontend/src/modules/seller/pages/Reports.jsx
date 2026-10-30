import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Calendar, TrendingUp, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { orderService } from '../../../services/authService';

const Reports = () => {
  const [reportType, setReportType] = useState('sales');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await orderService.getSellerNotifications().catch(() => null);
      if (res && Array.isArray(res.notifications)) {
        const rows = res.notifications.map((n, idx) => {
          const gross = Number(n.totalAmount || 0);
          const gst = Number((gross * 0.05).toFixed(2));
          const net = Number(n.netSellerAmount || (gross - gst).toFixed(2));
          const created = n.createdAt ? new Date(n.createdAt) : null;
          return {
            id: `REP-${String(idx + 1).padStart(2, '0')}`,
            date: created ? created.toLocaleDateString('en-IN') : '—',
            dateKey: created ? created.toISOString().slice(0, 10) : '',
            orderId: n.orderId ? `#${n.orderId}` : `#ORD-${idx + 1}`,
            rawGross: gross,
            rawGst: gst,
            rawNet: net,
            status: n.settlementStatus === 'SETTLED' ? 'Settled' : (n.status === 'DELIVERED' ? 'Settled' : 'Pending'),
            orderStatus: n.status || '',
          };
        });
        setAllRows(rows);
      } else {
        setAllRows([]);
      }
    } catch (e) {
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  };

  // #79 — apply date + report type filters whenever they change
  const reportDetails = useMemo(() => {
    const from = fromDate || '1970-01-01';
    const to = toDate || '2999-12-31';
    return allRows.filter((r) => {
      if (r.dateKey && (r.dateKey < from || r.dateKey > to)) return false;
      if (reportType === 'gst') return r.rawGst > 0;
      if (reportType === 'inventory') return ['PACKED', 'ACCEPTED', 'NEW'].includes(r.orderStatus);
      if (reportType === 'buyer') return true;
      return true; // sales
    });
  }, [allRows, fromDate, toDate, reportType]);

  const totalGrossRevenue = reportDetails.reduce((sum, r) => sum + (r.rawGross || 0), 0);
  const totalGst = reportDetails.reduce((sum, r) => sum + (r.rawGst || 0), 0);

  const handleExport = () => {
    if (reportDetails.length === 0) {
      alert('No report data available to export.');
      return;
    }
    // #80 — export numeric amounts without currency symbol so Excel treats them as numbers
    const headers = ['Report ID', 'Date', 'Order ID', 'Gross Sales', 'GST Amount', 'Net Payout', 'Status'];
    const rows = reportDetails.map((r) => [
      r.id,
      r.date,
      r.orderId,
      Number(r.rawGross || 0).toFixed(2),
      Number(r.rawGst || 0).toFixed(2),
      Number(r.rawNet || 0).toFixed(2),
      r.status,
    ]);

    const csvString = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Business_Sales_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Business Reports & Analytics</h1>
          <p className="text-sm font-normal text-slate-500 mt-1">Export financial ledgers, GST reports, and warehouse turnover statement.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReports}
            className="bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border border-slate-200 flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="bg-[#ff7526] hover:bg-[#e65507] text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-2 text-sm"
          >
            <FileSpreadsheet size={16} />
            Export Excel (CSV)
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-2 text-sm"
          >
            <FileText size={16} />
            Download Report
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#ff7526]" />
            <span className="text-sm font-normal text-slate-600">Date Range:</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-lg">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-700 text-sm font-normal cursor-pointer"
            />
            <span className="text-slate-400 font-normal">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-700 text-sm font-normal cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-normal text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer"
          >
            <option value="sales">Sales & Revenue Breakdown</option>
            <option value="gst">GST Tax Summary</option>
            <option value="inventory">Inventory Aging Report</option>
            <option value="buyer">Top Retailer Ledgers</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Revenue</span>
          <h3 className="text-3xl font-semibold text-slate-900">₹{totalGrossRevenue.toFixed(2)}</h3>
          <p className="text-xs font-normal text-emerald-600 flex items-center gap-1">
            <TrendingUp size={14} /> Filtered period totals
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total GST Estimated</span>
          <h3 className="text-3xl font-semibold text-slate-900">₹{totalGst.toFixed(2)}</h3>
          <p className="text-xs font-normal text-slate-500">Ready for GSTR-1 Filing</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Orders</span>
          <h3 className="text-3xl font-semibold text-[#ff7526]">{reportDetails.length}</h3>
          <p className="text-xs font-normal text-slate-500">Matching current filters</p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <h2 className="text-white font-semibold text-lg tracking-wide">Detailed Sales & Revenue Statement</h2>
          <span className="text-white/90 text-xs font-medium">Total Entries: {reportDetails.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4 font-semibold">Report ID</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Order ID</th>
                <th className="px-6 py-4 font-semibold">Gross Sales</th>
                <th className="px-6 py-4 font-semibold">GST Amount</th>
                <th className="px-6 py-4 font-semibold">Net Payout</th>
                <th className="px-6 py-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-normal text-slate-700 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading reports...</td>
                </tr>
              ) : reportDetails.length > 0 ? (
                reportDetails.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.id}</td>
                    <td className="px-6 py-4">{item.date}</td>
                    <td className="px-6 py-4 font-medium">{item.orderId}</td>
                    <td className="px-6 py-4 font-semibold">₹{Number(item.rawGross || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">₹{Number(item.rawGst || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-700">₹{Number(item.rawNet || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'Settled' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">No records for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;

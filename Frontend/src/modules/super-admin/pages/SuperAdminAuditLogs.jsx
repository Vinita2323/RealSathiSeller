import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { useDebounce } from '../../../hooks/useDebounce';
import { ShieldAlert, Search, Lock, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';

export const SuperAdminAuditLogs = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedLog, setSelectedLog] = useState(null);

  // Reset page when debounced search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchLogs = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await superAdminService.getAuditLogs({ page, limit: 30, search: debouncedSearch });
        if (res.success) {
          setLogs(res.logs || []);
          setTotal(res.total || 0);
          setPages(res.pages || 1);
        }
      } catch (err) {
        console.error('Fetch audit logs error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Immutable Financial Audit Trail"
        subtitle="Tamper-proof chronological log of all sensitive monetary operations, payout decisions, and commission mutations"
        onRefresh={() => fetchLogs(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Notice & Search */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Log ID, Actor, Entity ID, Remarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#002625] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-bold">
            <Lock size={13} />
            <span>Append-Only Immutable Records</span>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10.5px]">
                <th className="py-3.5 px-4 font-bold">Log ID</th>
                <th className="py-3.5 px-4 font-bold">Action</th>
                <th className="py-3.5 px-4 font-bold">Authorized By</th>
                <th className="py-3.5 px-4 font-bold">Target Entity</th>
                <th className="py-3.5 px-4 font-bold">Target ID</th>
                <th className="py-3.5 px-4 font-bold">Amount</th>
                <th className="py-3.5 px-4 font-bold">Remarks</th>
                <th className="py-3.5 px-4 font-bold">Timestamp</th>
                <th className="py-3.5 px-4 font-bold text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading audit log entries...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">No financial audit logs recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#002625]">{log.logId}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-medium text-slate-800">{log.actorEmail}</div>
                      <span className="text-[10px] text-emerald-700 font-mono font-bold">{log.actorRole}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">{log.targetEntity}</td>
                    <td className="py-3.5 px-4 font-mono text-[#002625] font-bold">{log.targetId || '—'}</td>
                    <td className="py-3.5 px-4 font-bold font-mono text-slate-900">
                      {log.amount ? `₹${Number(log.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate">{log.remarks || '—'}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer transition-all"
                        title="View JSON state diff"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Page <span className="text-[#002625] font-bold">{page}</span> of{' '}
              <span className="text-[#002625] font-bold">{pages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#ff5500] font-bold uppercase">AUDIT INSPECTION</span>
                <h4 className="text-base font-bold text-slate-900 m-0">#{selectedLog.logId}</h4>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg bg-transparent border-none cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Action</span>
                <span className="font-bold text-slate-900 font-mono">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Target</span>
                <span className="font-mono text-[#002625] font-bold">{selectedLog.targetEntity} #{selectedLog.targetId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Operator</span>
                <span className="text-slate-800 font-medium">{selectedLog.actorEmail}</span>
              </div>

              {selectedLog.previousValue && (
                <div className="pt-2">
                  <span className="text-slate-600 font-bold block mb-1">Previous State</span>
                  <pre className="p-2.5 bg-rose-50 rounded-xl text-[11px] font-mono text-rose-800 border border-rose-200 overflow-x-auto m-0">
                    {JSON.stringify(selectedLog.previousValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div className="pt-2">
                  <span className="text-slate-600 font-bold block mb-1">New State</span>
                  <pre className="p-2.5 bg-emerald-50 rounded-xl text-[11px] font-mono text-emerald-800 border border-emerald-200 overflow-x-auto m-0">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              <div className="pt-2">
                <span className="text-slate-600 font-bold block mb-1">Remarks</span>
                <p className="p-2.5 bg-slate-50 rounded-xl text-slate-700 border border-slate-200 m-0">
                  {selectedLog.remarks || 'No remarks'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 bg-[#002625] hover:bg-[#003837] text-white font-bold rounded-xl border-none cursor-pointer mt-2 shadow-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

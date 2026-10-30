import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { Plus, SlidersHorizontal, ArrowDownLeft, ArrowUpRight, Search, Store, Truck, Building2 } from 'lucide-react';

export const SuperAdminAdjustments = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [search, setSearch] = useState('');

  // Create Adjustment Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [entityType, setEntityType] = useState('SELLER');
  const [entityId, setEntityId] = useState('');
  const [type, setType] = useState('CREDIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown options
  const [sellers, setSellers] = useState([]);
  const [captains, setCaptains] = useState([]);

  const fetchAdjustments = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [adjRes, commRes, capRes] = await Promise.all([
        superAdminService.getFinancialAdjustments(),
        superAdminService.getCommissions().catch(() => ({ sellers: [] })),
        superAdminService.getCaptainSettlements().catch(() => ({ captains: [] })),
      ]);

      if (adjRes.success) setAdjustments(adjRes.adjustments || []);
      if (commRes.sellers) setSellers(commRes.sellers);
      if (capRes.captains) setCaptains(capRes.captains);
    } catch (err) {
      console.error('Fetch adjustments error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!reason.trim()) {
      setError('A mandatory reason is required for financial auditing');
      return;
    }
    if (entityType !== 'PLATFORM' && !entityId) {
      setError('Please select a valid partner entity');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await superAdminService.createFinancialAdjustment({
        entityType,
        entityId: entityType === 'PLATFORM' ? 'PLATFORM_TREASURY' : entityId,
        type,
        amount: Number(amount),
        reason,
        reference,
        remarks,
      });

      if (res.success) {
        setCreateModalOpen(false);
        setAmount('');
        setReason('');
        setReference('');
        setRemarks('');
        fetchAdjustments();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to apply adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = adjustments.filter(
    (a) =>
      a.adjustmentId?.toLowerCase().includes(search.toLowerCase()) ||
      a.entityName?.toLowerCase().includes(search.toLowerCase()) ||
      a.reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Financial Adjustments"
        subtitle="Manual audited credit/debit adjustments for dispute resolutions, bonus credits, and clawbacks"
        onRefresh={() => fetchAdjustments(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Adjustment ID, Entity, Reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#002625] focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={() => {
              setCreateModalOpen(true);
              setError('');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Create Financial Adjustment</span>
          </button>
        </div>

        {/* Adjustments Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
                <th className="py-3.5 px-4 font-bold">Adjustment ID</th>
                <th className="py-3.5 px-4 font-bold">Party / Entity</th>
                <th className="py-3.5 px-4 font-bold">Type</th>
                <th className="py-3.5 px-4 font-bold">Amount</th>
                <th className="py-3.5 px-4 font-bold">Balance Impact</th>
                <th className="py-3.5 px-4 font-bold">Reason</th>
                <th className="py-3.5 px-4 font-bold">Created By</th>
                <th className="py-3.5 px-4 font-bold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading adjustments...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">No financial adjustments recorded.</td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#002625]">{a.adjustmentId}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{a.entityName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{a.entityType}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold font-mono text-[10.5px] ${
                          a.type === 'CREDIT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {a.type === 'CREDIT' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                        {a.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 font-mono text-sm">
                      ₹{Number(a.amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                      ₹{Number(a.balanceBefore || 0).toFixed(2)} ➔ ₹{Number(a.balanceAfter || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 max-w-[200px] truncate">{a.reason}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{a.creatorEmail || 'Super Admin'}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(a.createdAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Adjustment Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs text-slate-800">
            <h4 className="text-base font-bold text-slate-900 m-0">Create Financial Adjustment</h4>
            <p className="text-slate-500 m-0 leading-relaxed">
              Apply a manual credit or debit directly to a partner wallet. An immutable ledger and audit trail will be generated.
            </p>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Entity Type</label>
                  <select
                    value={entityType}
                    onChange={(e) => {
                      setEntityType(e.target.value);
                      setEntityId('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all font-medium"
                  >
                    <option value="SELLER">Seller Store</option>
                    <option value="CAPTAIN">Captain Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Adjustment Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all font-medium"
                  >
                    <option value="CREDIT">Credit (+) Add to balance</option>
                    <option value="DEBIT">Debit (-) Deduct from balance</option>
                  </select>
                </div>
              </div>

              {entityType === 'SELLER' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Seller Store</label>
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all font-medium"
                  >
                    <option value="">Choose Seller Store...</option>
                    {sellers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.businessName || s.ownerName} (Available: ₹{Number(s.walletBalance || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {entityType === 'CAPTAIN' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Captain Partner</label>
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all font-medium"
                  >
                    <option value="">Choose Captain Partner...</option>
                    {captains.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} - {c.phone} (Available: ₹{Number(c.walletBalance || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Adjustment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold text-base outline-none focus:border-[#002625] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mandatory Reason / Justification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Compensation for damaged return package"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reference / Support Ticket ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TICKET-9823 or ORDER-4412"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono outline-none focus:border-[#002625] focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-bold rounded-xl border-none cursor-pointer shadow-sm transition-all"
                >
                  {submitting ? 'Applying Adjustment...' : 'Apply Financial Adjustment'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border-none cursor-pointer transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Package, X, Eye, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { returnService } from '../../../../services/authService';

/**
 * Global popup for new return requests (status REQUESTED) — Seller bug #51
 */
const SellerReturnNotifier = () => {
  const navigate = useNavigate();
  const [activeReturn, setActiveReturn] = useState(null);
  const knownIdsRef = useRef(new Set());
  const notifiedIdsRef = useRef(new Set());
  const baselineReadyRef = useRef(false);
  const pollingRef = useRef(false);

  const pollReturns = async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await returnService.getSellerReturns({ status: 'REQUESTED' });
      const list = Array.isArray(res?.returns) ? res.returns : [];

      if (!baselineReadyRef.current) {
        list.forEach((r) => knownIdsRef.current.add(String(r._id || r.returnId)));
        baselineReadyRef.current = true;
        return;
      }

      for (const ret of list) {
        const id = String(ret._id || ret.returnId);
        if (knownIdsRef.current.has(id)) continue;
        knownIdsRef.current.add(id);
        if (!notifiedIdsRef.current.has(id) && !activeReturn) {
          notifiedIdsRef.current.add(id);
          setActiveReturn(ret);
          break;
        }
      }
    } catch {
      // silent background poll
    } finally {
      pollingRef.current = false;
    }
  };

  useEffect(() => {
    pollReturns();
    const interval = setInterval(pollReturns, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!activeReturn) return null;

  const orderLabel = activeReturn.orderId || activeReturn.order?.orderId || '—';
  const customerName =
    activeReturn.customerName ||
    activeReturn.customerDetails?.name ||
    activeReturn.user?.name ||
    'Customer';

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-100 animate-in zoom-in-95 duration-200">
        <div className="bg-rose-600 px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} />
            <h3 className="font-bold text-sm m-0">New Return Request</h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveReturn(null)}
            className="bg-transparent border-none text-white/90 hover:text-white cursor-pointer p-1"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-900 m-0 leading-relaxed">
              A customer requested a return. Review and approve or reject from the Returns page.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 text-xs font-medium">Return ID</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {activeReturn.returnId || activeReturn._id}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 text-xs font-medium">Order</span>
              <span className="font-semibold text-slate-900 text-xs">#{orderLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 text-xs font-medium">Customer</span>
              <span className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                <Package size={12} className="text-slate-400" />
                {customerName}
              </span>
            </div>
            {activeReturn.reason && (
              <div className="pt-1">
                <span className="text-slate-500 text-xs font-medium block mb-0.5">Reason</span>
                <p className="text-xs text-slate-700 m-0 bg-slate-50 border border-slate-100 rounded-lg p-2">
                  {activeReturn.reason}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveReturn(null)}
              className="flex-1 py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveReturn(null);
                navigate('/seller/returns');
              }}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 border-none cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Eye size={14} />
              Review Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerReturnNotifier;

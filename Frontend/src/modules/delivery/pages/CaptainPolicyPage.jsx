import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, RefreshCw, FileText, ShieldCheck, HelpCircle } from 'lucide-react';
import { policyService } from '../../../services/authService';

const CaptainPolicyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isPrivacyPage = location.pathname.endsWith('/privacy');
  const policyType = isPrivacyPage ? 'privacy' : 'terms';

  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const res = await policyService.getPolicy('captain', policyType);
      if (res?.policy) {
        setPolicyData(res.policy);
      }
    } catch (err) {
      console.warn('Error loading dynamic captain policy:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, [location.pathname]);

  const pageTitle = isPrivacyPage ? 'Captain Privacy Policy' : 'Captain Terms of Service';
  const themeColor = isPrivacyPage ? '#ea580c' : '#15803d';

  return (
    <main className="min-h-screen bg-slate-100 font-sans text-slate-800 flex justify-center py-4 px-3 sm:px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col my-auto">
        
        {/* Compact Top Header */}
        <header className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-400 block leading-tight">
                Sathi Seller Partner
              </span>
              <h1 className="text-xs sm:text-sm font-bold text-white m-0 leading-tight">
                {pageTitle}
              </h1>
            </div>
          </div>

          <button
            onClick={loadPolicy}
            title="Refresh"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Compact Content Area */}
        <div className="p-3.5 sm:p-4 space-y-3">
          
          {/* Compact Meta Strip */}
          <div className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-[11px] ${
            isPrivacyPage ? 'bg-orange-50 border border-orange-200/70 text-orange-950' : 'bg-emerald-50 border border-emerald-200/70 text-emerald-950'
          }`}>
            <div className="flex items-center gap-1.5 font-bold truncate">
              {isPrivacyPage ? <ShieldCheck size={14} className="text-[#ea580c] shrink-0" /> : <FileText size={14} className="text-[#15803d] shrink-0" />}
              <span className="truncate">{policyData?.title || pageTitle}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-500">
              <span className="px-1.5 py-0.5 bg-white font-extrabold rounded border text-slate-700">
                {policyData?.version || 'v1.0'}
              </span>
            </div>
          </div>

          {/* Dynamic Clauses List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
              <RefreshCw size={18} className="animate-spin text-slate-500" />
              <span>Loading clauses...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {policyData?.sections && policyData.sections.length > 0 ? (
                policyData.sections.map((sec, idx) => (
                  <div key={sec._id || idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                    <h3 className="text-xs font-bold text-slate-900 m-0 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: themeColor }}></span>
                      <span>{sec.heading}</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-snug m-0 text-justify pl-3">
                      {sec.body}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                  No policy clauses available.
                </div>
              )}
            </div>
          )}

          {/* Compact Footer Note */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>Effective: {policyData?.effectiveDate || 'Sep 1, 2026'}</span>
            <button
              onClick={() => navigate(-1)}
              className="text-[#15803d] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer text-[10px]"
            >
              Done
            </button>
          </div>

        </div>
      </div>
    </main>
  );
};

export default CaptainPolicyPage;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, RefreshCw } from 'lucide-react';
import { policyService } from '../../../services/authService';

const Terms = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine whether this is the Privacy Policy page or Terms of Service page based on route
  const isPrivacyPage = location.pathname.includes('/privacy') || location.hash === '#privacy';
  const policyType = isPrivacyPage ? 'privacy' : 'terms';
  
  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const res = await policyService.getPolicy('user', policyType);
      if (res?.policy) {
        setPolicyData(res.policy);
      }
    } catch (err) {
      console.warn('Error loading dynamic user policy:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, [location.pathname, location.hash]);

  const pageTitle = isPrivacyPage ? 'Privacy Policy' : 'Terms of Service';
  const themeColor = isPrivacyPage ? '#ea580c' : '#15803d';

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative max-w-[440px] md:max-w-4xl mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col md:py-8 md:px-6 overflow-hidden md:overflow-visible">
      
      {/* Sleek Compact Mobile Header */}
      <header className="flex md:hidden justify-between items-center py-3 px-4 bg-white shadow-xs z-10 sticky top-0 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <button 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border-none cursor-pointer p-0 flex items-center justify-center transition-colors text-slate-800" 
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-orange-600 block leading-tight">
              Sathi Seller Customer
            </span>
            <h2 className="text-[14px] font-extrabold m-0 text-slate-900 tracking-tight leading-tight">
              {pageTitle}
            </h2>
          </div>
        </div>

        <button 
          onClick={loadPolicy} 
          disabled={loading}
          className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center cursor-pointer transition-colors text-slate-600 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-orange-600' : ''} />
        </button>
      </header>

      {/* Desktop Breadcrumbs & Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate(-1)} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Back
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Legal</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs">
          <ShieldCheck size={16} className="text-emerald-600" />
          Official Sathi Seller Policy
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-8 pb-16 md:pb-12 [&::-webkit-scrollbar]:hidden md:bg-white md:rounded-3xl md:border md:border-slate-100 md:shadow-sm md:overflow-visible flex flex-col gap-3">
        
        {/* Compact Meta Strip */}
        <div className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-[11px] ${
          isPrivacyPage ? 'bg-orange-50 border border-orange-200/70 text-orange-950' : 'bg-emerald-50 border border-emerald-200/70 text-emerald-950'
        }`}>
          <div className="flex items-center gap-1.5 font-bold truncate">
            {isPrivacyPage ? <ShieldCheck size={14} className="text-[#ea580c] shrink-0" /> : <FileText size={14} className="text-[#15803d] shrink-0" />}
            <span className="truncate">{policyData?.title || (isPrivacyPage ? 'Customer Privacy Policy' : 'Customer Terms of Service')}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-[10px]">
            <span className="px-1.5 py-0.5 bg-white font-extrabold rounded border text-slate-700">
              {policyData?.version || 'v1.0'}
            </span>
          </div>
        </div>

        {/* Dynamic Clauses */}
        {loading ? (
          <div className="py-14 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
            <RefreshCw size={18} className="animate-spin text-orange-500" />
            <span>Loading {pageTitle.toLowerCase()}...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {policyData?.sections && policyData.sections.length > 0 ? (
              policyData.sections.map((sec, idx) => (
                <div key={sec._id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-xs space-y-1">
                  <h3 className="text-xs font-bold text-slate-900 m-0 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: themeColor }}></span>
                    <span>{sec.heading}</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-snug m-0 text-justify pl-3 font-normal">
                    {sec.body}
                  </p>
                </div>
              ))
            ) : (
              <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                No policy sections configured.
              </div>
            )}
          </div>
        )}

        {/* Compact Footer Note */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] text-slate-400">
          <span>Effective: {policyData?.effectiveDate || 'Sep 1, 2026'}</span>
          <button
            onClick={() => navigate(-1)}
            className="text-[#ea580c] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer text-[10px]"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

export default Terms;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, RefreshCw, Store, HelpCircle } from 'lucide-react';
import { policyService } from '../../../services/authService';

const SellerPolicyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine whether this is the Privacy Policy page or Terms of Service page based on route
  const isPrivacyPage = location.pathname.endsWith('/privacy');
  const policyType = isPrivacyPage ? 'privacy' : 'terms';

  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const res = await policyService.getPolicy('seller', policyType);
      if (res?.policy) {
        setPolicyData(res.policy);
      }
    } catch (err) {
      console.warn('Error loading dynamic seller policy:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, [location.pathname]);

  const pageTitle = isPrivacyPage ? 'Seller Privacy Policy' : 'Seller Terms of Service';
  const themeColor = '#ff7526';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col items-center justify-start py-6 px-4 sm:px-6">
      <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col">
        
        {/* Top Header */}
        <header className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Store size={16} className="text-[#ff7526]" />
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#ff7526]">Sathi Seller Merchant Portal</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white m-0">{pageTitle}</h1>
            </div>
          </div>

          <button
            onClick={loadPolicy}
            title="Refresh"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Policy Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isPrivacyPage ? (
                  <ShieldCheck size={18} className="text-[#ff7526]" />
                ) : (
                  <FileText size={18} className="text-[#ff7526]" />
                )}
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 m-0">
                  {policyData?.title || (isPrivacyPage ? 'Seller Privacy & Data Policy' : 'Seller & Merchant Terms of Service')}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 mb-0">
                {isPrivacyPage
                  ? 'Merchant data handling, confidential business records, and customer privacy terms.'
                  : 'Official merchant operating standards, product listing guidelines, and commission settlement terms.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 bg-white text-amber-800 text-[11px] font-extrabold rounded-lg border border-amber-200 shadow-xs uppercase">
                {policyData?.version || 'v1.0'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Updated: <b className="text-slate-700">{policyData?.effectiveDate || 'September 1, 2026'}</b>
              </span>
            </div>
          </div>

          {/* Dynamic Clauses */}
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw size={22} className="animate-spin text-slate-500" />
              <span>Loading policy terms...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {policyData?.sections && policyData.sections.length > 0 ? (
                policyData.sections.map((sec, idx) => (
                  <div key={sec._id || idx} className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 hover:border-slate-300 transition-colors">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 m-0 flex items-center gap-2.5">
                      <span className="w-2 h-4.5 bg-[#ff7526] rounded-full inline-block"></span>
                      {sec.heading}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed m-0 whitespace-pre-line text-justify font-normal">
                      {sec.body}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                  No policy clauses available for display.
                </div>
              )}
            </div>
          )}

          {/* Seller Support Helpdesk */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-[#ff7526]/20 text-[#ff7526] flex items-center justify-center shrink-0">
                <HelpCircle size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white m-0">Questions on Vendor Agreements or Billing?</h4>
                <p className="text-[11px] text-slate-400 m-0 mt-0.5">Contact our Merchant Relationship Team at seller-support@sathiseller.com</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/seller/login')}
              className="px-5 py-2.5 bg-[#ff7526] hover:bg-[#e05e16] text-white font-extrabold text-xs rounded-xl border-none cursor-pointer transition-colors shrink-0 shadow-sm"
            >
              Seller Login
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SellerPolicyPage;

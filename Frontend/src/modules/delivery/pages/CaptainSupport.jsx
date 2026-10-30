import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  PhoneCall, 
  Mail, 
  HelpCircle, 
  ChevronDown, 
  Loader2, 
  Truck, 
  Search,
  ShieldCheck
} from 'lucide-react';
import CaptainBottomNav from '../components/CaptainBottomNav';
import faqService from '../../../services/faqService';
import supportService from '../../../services/supportService';

const CaptainSupport = () => {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [supportSettings, setSupportSettings] = useState({
    captainPhone: '+91 63774 60692',
    captainEmail: 'shippnexin26@gmail.com',
    captainHours: '24/7 Active Dispatch Line',
  });
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [faqRes, setRes] = await Promise.all([
          faqService.getPublicFaqs(),
          supportService.getSupportSettings()
        ]);
        if (faqRes && faqRes.success && Array.isArray(faqRes.faqs)) {
          setFaqs(faqRes.faqs);
        }
        if (setRes) {
          setSupportSettings(prev => ({ ...prev, ...setRes }));
        }
      } catch (err) {
        console.warn('Error fetching captain FAQs or support settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter for Captain & General FAQs
  const captainFaqs = faqs.filter(f => {
    const isCaptain = f.category === 'Delivery Captain' || f.category === 'General' || f.category === 'General (Visible to all)';
    if (!isCaptain) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (f.question || '').toLowerCase().includes(q) || (f.answer || '').toLowerCase().includes(q);
    }
    return true;
  });

  const toggleAccordion = (index) => {
    setOpenIndex(prev => (prev === index ? -1 : index));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-28 text-slate-800 flex flex-col justify-between">
      <div className="max-w-md mx-auto px-4 py-3.5 w-full space-y-3.5">
        
        {/* Header Bar */}
        <header className="flex items-center justify-between py-2 border-b border-slate-200/80">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer flex items-center justify-center text-slate-800 transition-colors p-0 shadow-2xs"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-black m-0 text-slate-900 tracking-tight">Captain Help & Support</h1>
          <div className="w-8"></div>
        </header>

        {/* Dispatch Banner */}
        <div className="bg-gradient-to-tr from-[#002625] to-[#15803d] text-white p-4.5 rounded-3xl shadow-sm text-center">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/15">
            <Truck size={24} className="text-emerald-300" />
          </div>
          <h2 className="text-lg font-black text-white m-0">24/7 Dispatch Assistance</h2>
          <p className="text-[12px] text-emerald-100/90 font-medium m-0 mt-1">
            Need urgent help on an active route, payout dispute, or app navigation?
          </p>
        </div>

        {/* Direct Contact Buttons */}
        <div className="space-y-2">
          {/* Dispatch Helpline */}
          <a 
            href={`tel:${supportSettings.captainPhone?.replace(/\s+/g, '') || '+916377460692'}`}
            className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20 transition-all no-underline group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                <PhoneCall size={18} />
              </div>
              <div>
                <span className="text-[13.5px] font-black text-slate-900 block leading-tight">Call Dispatch Helpline</span>
                <span className="text-[12px] font-bold text-emerald-700 block mt-0.5">{supportSettings.captainPhone || '+91 63774 60692'}</span>
                {supportSettings.captainHours && (
                  <span className="text-[10px] text-slate-400 font-medium">{supportSettings.captainHours}</span>
                )}
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">Call Now</span>
          </a>

          {/* Email Support */}
          <a 
            href={`mailto:${supportSettings.captainEmail || 'shippnexin26@gmail.com'}`}
            className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-300 hover:bg-blue-50/20 transition-all no-underline group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                <Mail size={18} />
              </div>
              <div>
                <span className="text-[13.5px] font-black text-slate-900 block leading-tight">Email Support</span>
                <span className="text-[12px] font-bold text-blue-600 block mt-0.5">{supportSettings.captainEmail || 'shippnexin26@gmail.com'}</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">Email</span>
          </a>
        </div>

        {/* FAQs Section (Admin Managed) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} className="text-[#ea580c]" />
              <h2 className="text-[14px] font-black text-slate-900 m-0">Driver FAQs</h2>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver questions..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0 text-[11px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* FAQ Accordion */}
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={20} className="animate-spin text-emerald-600" />
                <span className="text-xs font-semibold">Loading FAQs...</span>
              </div>
            ) : captainFaqs.length > 0 ? (
              captainFaqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div key={faq._id || faq.id || index} className="py-3">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(index)}
                      className="w-full flex items-start justify-between gap-2.5 text-left bg-transparent border-none cursor-pointer p-0 select-none group"
                    >
                      <span className={`text-[13.5px] font-bold leading-snug transition-colors ${
                        isOpen ? 'text-emerald-700' : 'text-slate-900 group-hover:text-emerald-700'
                      }`}>
                        {faq.question}
                      </span>
                      <div className={`mt-0.5 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                      }`}>
                        <ChevronDown size={16} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-2 pr-2 animate-fadeIn">
                        <p className="text-[12.5px] text-slate-600 font-normal leading-relaxed m-0 select-text">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400">
                <HelpCircle size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700 text-[13px] m-0">No questions found</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5 m-0">
                  {search ? 'Try a different search term.' : 'Admin has not published any driver FAQs yet.'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      <CaptainBottomNav />
    </div>
  );
};

export default CaptainSupport;

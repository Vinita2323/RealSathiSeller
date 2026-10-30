import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  PhoneCall, 
  Mail, 
  HelpCircle, 
  ChevronDown, 
  Loader2, 
  Store, 
  Search, 
  FileText,
  ShieldCheck
} from 'lucide-react';
import faqService from '../../../services/faqService';
import supportService from '../../../services/supportService';

const SellerSupport = () => {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [supportSettings, setSupportSettings] = useState({
    sellerPhone: '+91 63774 60692',
    sellerEmail: 'shippnexin26@gmail.com',
    sellerHours: 'Mon - Sat (9 AM - 8 PM)',
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
        console.warn('Error fetching seller FAQs or support settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter for Seller & General FAQs
  const sellerFaqs = faqs.filter(f => {
    const isSeller = f.category === 'Seller' || f.category === 'General' || f.category === 'General (Visible to all)';
    if (!isSeller) return false;
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
    <div className="space-y-4 font-sans text-slate-800 pb-12 animate-fadeIn max-w-5xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-[#002625] text-white p-6 rounded-2xl shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-emerald-300 mb-2 border border-white/10">
            <Store size={14} /> Merchant Support & FAQs
          </div>
          <h1 className="text-xl sm:text-2xl font-black m-0 tracking-tight text-white">
            Seller Helpdesk & Knowledge Base
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 m-0 mt-1 max-w-xl">
            Find answers regarding product listings, payout cycles, commission rates, and order fulfillment.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 z-10">
          <button
            onClick={() => navigate('/seller/dashboard')}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        
        {/* Phone Support */}
        <a 
          href={`tel:${supportSettings.sellerPhone?.replace(/\s+/g, '') || '+916377460692'}`}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:bg-blue-50/20 transition-all flex items-center justify-between no-underline group cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <PhoneCall size={20} />
            </div>
            <div>
              <span className="text-[14px] font-bold text-slate-900 block leading-tight">Merchant Helpline</span>
              <span className="text-[13px] font-bold text-blue-600 block mt-0.5">{supportSettings.sellerPhone || '+91 63774 60692'}</span>
              <span className="text-[11px] text-slate-400 font-medium">{supportSettings.sellerHours || 'Instant priority phone assistance'}</span>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">Call Now</span>
        </a>

        {/* Email Support */}
        <a 
          href={`mailto:${supportSettings.sellerEmail || 'shippnexin26@gmail.com'}`}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-rose-300 hover:bg-rose-50/20 transition-all flex items-center justify-between no-underline group cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <span className="text-[14px] font-bold text-slate-900 block leading-tight">Merchant Relations Email</span>
              <span className="text-[13px] font-bold text-rose-600 block mt-0.5">{supportSettings.sellerEmail || 'shippnexin26@gmail.com'}</span>
              <span className="text-[11px] text-slate-400 font-medium">Response within 24 business hours</span>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">Write Email</span>
        </a>

      </div>

      {/* Admin-Managed Seller FAQs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Search & Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-[#ea580c]" />
            <div>
              <h2 className="text-[15px] font-black text-slate-900 m-0">Merchant Frequently Asked Questions</h2>
              <p className="text-[12px] text-slate-400 m-0">Official guidelines and answers updated by Sathi Seller admin</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant questions..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#002625] focus:bg-white"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0 text-[11px]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="p-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-[#002625]" />
              <span className="text-xs font-semibold">Loading merchant questions...</span>
            </div>
          ) : sellerFaqs.length > 0 ? (
            sellerFaqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq._id || faq.id || index} className="py-3">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(index)}
                    className="w-full flex items-start justify-between gap-3 text-left bg-transparent border-none cursor-pointer p-0 select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                        {faq.category === 'General' ? 'General' : 'Merchant'}
                      </span>
                      <span className={`text-[14px] font-bold transition-colors ${
                        isOpen ? 'text-[#ff5500]' : 'text-slate-900 group-hover:text-[#ff5500]'
                      }`}>
                        {faq.question}
                      </span>
                    </div>
                    <div className={`mt-0.5 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#ff5500]' : 'text-slate-400 group-hover:text-slate-600'
                    }`}>
                      <ChevronDown size={17} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-2.5 pl-4 sm:pl-16 pr-4 animate-fadeIn">
                      <p className="text-[13px] text-slate-600 font-normal leading-relaxed m-0 select-text">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400">
              <HelpCircle size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-[13.5px] m-0">No merchant questions found</p>
              <p className="text-[12px] text-slate-400 mt-0.5 m-0">
                {search ? 'Try searching with different keywords.' : 'Admin has not added any seller questions yet.'}
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default SellerSupport;

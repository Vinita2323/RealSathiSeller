import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PhoneCall, Mail, ChevronRight, HelpCircle, Headphones, Loader2 } from 'lucide-react';
import supportService from '../../../services/supportService';

const HelpSupport = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    customerPhone: '+91 63774 60692',
    customerEmail: 'shippnexin26@gmail.com',
    customerHours: '24/7 Priority Support',
    bannerTitle: "We're here to help",
    bannerSubtitle: 'Have an issue with your order or want to share feedback? Connect with us directly.',
  });
  const [loading, setLoading] = useState(true);
  const [actionToast, setActionToast] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await supportService.getSupportSettings();
        if (res) {
          setSettings(prev => ({ ...prev, ...res }));
        }
      } catch (err) {
        console.warn('Error fetching support settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const showToast = (msg) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 2500);
  };

  /** Digits-only tel URI — avoids SPA/PWA treating the link as an in-app navigation. */
  const supportPhoneHref = () => {
    const raw = String(settings.customerPhone || '+91 63774 60692');
    const digits = raw.replace(/[^\d+]/g, '');
    return digits.startsWith('+') ? digits : `+${digits.replace(/^\+/, '')}`;
  };

  const handleCallSupport = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const tel = supportPhoneHref();
    try {
      window.location.href = `tel:${tel}`;
    } catch {
      navigator.clipboard?.writeText(tel).then(() => showToast(`Number copied: ${tel}`)).catch(() => showToast(tel));
    }
  };

  const handleEmailSupport = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const email = String(settings.customerEmail || 'shippnexin26@gmail.com').trim();
    try {
      window.location.href = `mailto:${email}`;
    } catch {
      navigator.clipboard?.writeText(email).then(() => showToast(`Email copied: ${email}`)).catch(() => showToast(email));
    }
  };

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative max-w-[480px] md:max-w-4xl mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col md:py-8 md:px-6 overflow-hidden md:overflow-visible">
      {/* Mobile Header */}
      <header className="flex md:hidden justify-between items-center py-4 px-4 bg-white border-b border-slate-100 z-10 sticky top-0 shrink-0">
        <button 
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center text-slate-700 transition-colors p-0" 
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-[16px] font-extrabold m-0 text-slate-900 tracking-tight">Help & Support</h2>
        <div className="w-8"></div>
      </header>

      {/* Desktop Breadcrumbs & Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate('/profile')} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Profile
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Support</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Help & Customer Support</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
          <Headphones size={16} />
          24/7 Available
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-0 py-5 md:py-0 pb-20 md:pb-12 [&::-webkit-scrollbar]:hidden flex flex-col items-center md:overflow-visible">
        
        {/* Banner */}
        <div className="w-full flex flex-col items-center justify-center py-5 md:py-8 mb-2 md:mb-6 text-center md:bg-white md:rounded-3xl md:border md:border-slate-100 md:shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-3 shadow-[0_4px_16px_rgba(234,88,12,0.12)]">
            <Headphones size={28} className="text-[#ea580c]" />
          </div>
          <h2 className="text-[18px] md:text-2xl font-extrabold text-slate-900 mb-1">{settings.bannerTitle || "We're here to help"}</h2>
          <p className="text-[12px] md:text-sm font-medium text-slate-500 max-w-sm m-0">
            {settings.bannerSubtitle || 'Have an issue with your order or want to share feedback? Connect with us directly.'}
          </p>
        </div>

        {/* Action Cards */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          
          {actionToast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
              {actionToast}
            </div>
          )}

          {/* Call Support */}
          <a 
            href={`tel:${supportPhoneHref()}`}
            onClick={handleCallSupport}
            className="flex items-center justify-between bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-all text-left no-underline group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors">
                <PhoneCall size={18} className="text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13.5px] font-bold text-slate-900 leading-tight">Call Support</span>
                <span className="text-[12px] font-semibold text-blue-600 mt-0.5">{settings.customerPhone || '+91 63774 60692'}</span>
                {settings.customerHours && (
                  <span className="text-[10px] text-slate-400 font-medium">{settings.customerHours}</span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
          </a>
          
          {/* Email Support */}
          <a 
            href={`mailto:${settings.customerEmail || 'shippnexin26@gmail.com'}`}
            onClick={handleEmailSupport}
            className="flex items-center justify-between bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs cursor-pointer hover:border-rose-300 hover:bg-rose-50/20 transition-all text-left no-underline group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-600 transition-colors">
                <Mail size={18} className="text-rose-600 group-hover:text-white transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13.5px] font-bold text-slate-900 leading-tight">Email Support</span>
                <span className="text-[12px] font-semibold text-rose-600 mt-0.5">{settings.customerEmail || 'shippnexin26@gmail.com'}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
          </a>

          {/* Quick link to FAQs */}
          <div 
            onClick={() => navigate('/faqs')}
            className="flex items-center justify-between bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 group-hover:bg-[#ea580c] transition-colors">
                <HelpCircle size={18} className="text-[#ea580c] group-hover:text-white transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13.5px] font-bold text-slate-900 leading-tight">Frequently Asked Questions</span>
                <span className="text-[11px] font-medium text-slate-500 mt-0.5">Browse common questions & answers</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
          </div>

        </div>
        
      </div>
    </div>
  );
};

export default HelpSupport;

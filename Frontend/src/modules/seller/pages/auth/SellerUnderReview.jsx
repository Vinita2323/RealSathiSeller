import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShieldAlert, ArrowLeft, Headphones, Mail } from 'lucide-react';

const SellerUnderReview = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.05)] border border-slate-200 p-8 space-y-6 text-center">
        
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/Logo.png" alt="Sathi Seller Logo" className="h-14 w-auto object-contain" />
        </div>

        {/* Status Icon */}
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full mx-auto flex items-center justify-center border border-amber-200 animate-pulse">
          <Clock size={32} />
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Account Under Review
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
            Your seller application has been received and is currently under review by our admin verification team.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-left flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold">What happens next?</p>
            <p className="text-amber-700">Verification usually takes 24–48 hours. Once approved, you will be able to log in to your dashboard using your registered mobile number and password.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-3">
          <button
            onClick={() => navigate('/seller/login')}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 shadow-xs text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Seller Login
          </button>

          <a 
            href="mailto:shippnexin26@gmail.com"
            className="w-full flex justify-center items-center gap-2 text-xs text-[#ff7526] font-semibold hover:underline no-underline"
          >
            <Mail size={14} />
            Contact Support Team
          </a>
        </div>

      </div>
    </div>
  );
};

export default SellerUnderReview;

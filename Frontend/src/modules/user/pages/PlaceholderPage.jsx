import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PlaceholderPage = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] bg-[#f8fafc] font-sans text-slate-800 relative max-w-[480px] mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center py-4 px-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] z-10">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} color="#1e293b" />
        </button>
        <h2 className="text-[16px] font-bold m-0 text-slate-900 text-center">{title}</h2>
        <div className="w-5"></div>
      </header>
      
      <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
        <h3 className="text-[20px] font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-[14px] text-slate-500">This page is under construction.</p>
      </div>
    </div>
  );
};

export default PlaceholderPage;

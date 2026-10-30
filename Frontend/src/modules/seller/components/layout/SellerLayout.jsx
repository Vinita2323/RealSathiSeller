import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SellerSidebar from './SellerSidebar';
import SellerHeader from './SellerHeader';
import SellerOrderNotifier from './SellerOrderNotifier';
import SellerReturnNotifier from './SellerReturnNotifier';

const SellerLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const mainRef = useRef(null);

  // Reset main container scroll position on every page navigation
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800 overflow-hidden select-none">
      {/* Global incoming order audio ringtone and popup modal across all seller pages */}
      <SellerOrderNotifier />
      <SellerReturnNotifier />

      <SellerSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <SellerHeader isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
};

export default SellerLayout;

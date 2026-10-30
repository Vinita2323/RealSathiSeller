import React from 'react';
import { Outlet } from 'react-router-dom';
import { SuperAdminSidebar } from '../components/SuperAdminSidebar';

export const SuperAdminLayout = () => {
  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800 overflow-hidden select-none">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

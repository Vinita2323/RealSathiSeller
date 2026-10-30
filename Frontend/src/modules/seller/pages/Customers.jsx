import React, { useState } from 'react';
import { Search, User, Phone, MapPin, ShoppingBag, CreditCard, ChevronRight } from 'lucide-react';

const mockCustomers = [
  { id: 'CUST-301', name: 'Shree Krishna Retailers', owner: 'Ramesh Sharma', phone: '+91 98765 43210', location: 'Gurugram', totalOrders: 38, totalSpent: '₹4,82,000', creditLimit: '₹1,00,000', status: 'Active' },
  { id: 'CUST-302', name: 'Gupta Kirana Superstore', owner: 'Suresh Gupta', phone: '+91 98111 22334', location: 'Delhi', totalOrders: 54, totalSpent: '₹7,15,000', creditLimit: '₹1,50,000', status: 'Active' },
  { id: 'CUST-303', name: 'FreshBazaar Wholesale', owner: 'Amit Patel', phone: '+91 99000 11223', location: 'Noida', totalOrders: 19, totalSpent: '₹2,40,000', creditLimit: '₹50,000', status: 'Active' },
  { id: 'CUST-304', name: 'Aman General Mart', owner: 'Aman Verma', phone: '+91 97654 32109', location: 'Delhi', totalOrders: 82, totalSpent: '₹12,40,000', creditLimit: '₹2,50,000', status: 'VIP Seller' },
];

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = mockCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Retailer & Buyer Directory</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage bulk shopkeepers, credit terms, and purchase histories.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search size={18} className="text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search shopkeeper name, phone, or area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#ff5500] text-sm font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4 font-bold">Shop Name</th>
                <th className="px-6 py-4 font-bold">Owner Name</th>
                <th className="px-6 py-4 font-bold">Contact</th>
                <th className="px-6 py-4 font-bold">Total Orders</th>
                <th className="px-6 py-4 font-bold">Lifetime Value</th>
                <th className="px-6 py-4 font-bold">Credit Limit</th>
                <th className="px-6 py-4 font-bold text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{c.name}</span>
                      <span className="text-xs text-slate-400 font-normal">{c.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{c.owner}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-600">{c.phone}</td>
                  <td className="px-6 py-4 font-bold">{c.totalOrders} Bulk Orders</td>
                  <td className="px-6 py-4 font-extrabold text-[#ff5500]">{c.totalSpent}</td>
                  <td className="px-6 py-4 text-slate-600 font-semibold">{c.creditLimit}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md border border-slate-200 cursor-pointer">
                      View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers;

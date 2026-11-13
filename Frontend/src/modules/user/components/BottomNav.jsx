import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon, LayoutGrid, ShoppingCart, ClipboardList, User, Wrench } from 'lucide-react';
import { useCart } from '../context/CartContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { cartCount } = useCart();
  const [hideForSearch, setHideForSearch] = useState(false);

  useEffect(() => {
    const onSearchUi = (e) => setHideForSearch(Boolean(e?.detail?.active));
    window.addEventListener('sathiseller_search_ui', onSearchUi);
    return () => window.removeEventListener('sathiseller_search_ui', onSearchUi);
  }, []);

  if (hideForSearch) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white flex justify-around items-center py-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] rounded-t-[20px] z-[100]">
      <div 
        className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors duration-200 ${currentPath === '/' ? 'text-[#ff5500]' : 'text-slate-400'}`}
        onClick={() => navigate('/')}
      >
        <HomeIcon size={24} />
        <span className="text-[10px] font-semibold">Home</span>
      </div>
      <div 
        className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors duration-200 ${currentPath === '/categories' ? 'text-[#ff5500]' : 'text-slate-400'}`}
        onClick={() => navigate('/categories')}
      >
        <LayoutGrid size={24} />
        <span className="text-[10px] font-semibold">Categories</span>
      </div>
      <div 
        className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors duration-200 ${currentPath === '/cart' ? 'text-[#ff5500]' : 'text-slate-400'}`}
        onClick={() => navigate('/cart')}
      >
        <ShoppingCart size={24} />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-2 bg-[#ff5500] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-[1.5px] border-white">
            {cartCount}
          </span>
        )}
        <span className="text-[10px] font-semibold">Cart</span>
      </div>
      <div 
        className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors duration-200 ${currentPath === '/orders' ? 'text-[#ff5500]' : 'text-slate-400'}`}
        onClick={() => navigate('/orders')}
      >
        <ClipboardList size={24} />
        <span className="text-[10px] font-semibold">Orders</span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors duration-200 ${currentPath.startsWith('/repair') ? 'text-[#ff5500]' : 'text-slate-400'}`}
        onClick={() => navigate('/repair')}
      >
        <Wrench size={24} />
        <span className="text-[10px] font-semibold">Repair</span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors duration-200 ${currentPath === '/profile' ? 'text-[#ff5500]' : 'text-slate-400'}`}
        onClick={() => navigate('/profile')}
      >
        <User size={24} />
        <span className="text-[10px] font-semibold">Profile</span>
      </div>
    </nav>
  );
};

export default BottomNav;

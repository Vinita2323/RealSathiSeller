import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { getImageUrl, getCategoryFallbackImage, handleImageError } from '../../../utils/imageUtils';
import grainsImg from '../../../assets/user/categories/grains-removebg-preview.png';

const Wishlist = () => {
  const navigate = useNavigate();
  const { wishlistItems, removeFromWishlist } = useWishlist();

  return (
    <div className="w-full max-w-[480px] md:max-w-7xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-slate-50 font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-8">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center gap-3 py-4 px-5 bg-gradient-to-r from-[#ea580c] to-[#f97316] rounded-b-[20px] shadow-sm z-10 relative mb-2">
        <ArrowLeft size={22} color="white" className="cursor-pointer" onClick={() => navigate(-1)} />
        <h2 className="text-[20px] font-semibold m-0 text-white">My Wishlist</h2>
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 m-0">My Wishlist</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">{wishlistItems.length} saved items in your wishlist</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto md:overflow-visible px-4 md:px-0 py-4 md:py-0 [&::-webkit-scrollbar]:hidden">
        {wishlistItems.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xs h-[60vh] max-w-md mx-auto my-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3">
              <Heart size={28} className="text-red-300" fill="currentColor" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-800 m-0 mb-1">Your wishlist is empty</h3>
            <p className="text-[13px] text-slate-400 m-0 text-center">Save items you love here and buy them later.</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-5 bg-[#ff5500] hover:bg-[#e04a00] text-white border-none rounded-xl px-6 py-2.5 text-[13px] font-bold cursor-pointer transition-transform duration-200 active:scale-[0.98]"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5 pb-6">
            {wishlistItems.map((item) => {
              const fallbackImg = getCategoryFallbackImage(item.category || item.name);
              const itemImg = getImageUrl(item.image || item.mainImage, fallbackImg);
              const itemPrice = item.price || item.salePrice || 0;
              const itemMrp = item.originalPrice || item.mrp || itemPrice;

              return (
                <div key={item.id || item._id} className="bg-white rounded-[16px] overflow-hidden flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative border border-slate-50 cursor-pointer transition-transform hover:-translate-y-1" onClick={() => navigate(`/product/${item.id || item._id}`)}>
                  
                  {/* Image Section */}
                  <div className="relative w-full h-[145px] bg-slate-100 overflow-hidden">
                    <div 
                      className="absolute top-2 right-2 bg-white/95 backdrop-blur-xs w-7 h-7 rounded-full flex items-center justify-center shadow-md cursor-pointer z-10 hover:bg-red-50 transition-all active:scale-95 border border-slate-100"
                      onClick={(e) => { e.stopPropagation(); removeFromWishlist(item.id || item._id); }}
                    >
                      <Trash2 size={13} className="text-red-500" />
                    </div>
                    
                    <img 
                      src={getImageUrl(item.image || item.mainImage, item.name)} 
                      alt={item.name} 
                      onError={(e) => handleImageError(e, item.name)}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                    />
                  </div>

                  {/* Details Section */}
                  <div className="p-2.5 pb-3 bg-white flex flex-col">
                    <h4 className="text-[12px] font-bold text-slate-800 m-0 mb-0.5 leading-tight">{item.name}</h4>
                    <p className="text-[10px] font-medium text-slate-400 m-0 mb-2">{item.brand || 'Sathi Seller Select'}</p>
                    
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[14px] font-extrabold text-slate-900">₹{itemPrice}</span>
                      {itemMrp > itemPrice && (
                        <span className="text-[11px] text-slate-400 line-through">₹{itemMrp}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;

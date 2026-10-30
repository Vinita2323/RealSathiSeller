import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Check, ShoppingCart, Heart, Zap, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useLocationContext } from '../../../context/LocationContext';
import { productService } from '../../../services/authService';
import { getImageUrl, getCategoryFallbackImage, handleImageError } from '../../../utils/imageUtils';

import grainsImg from '../../../assets/user/categories/grains-removebg-preview.png';
import oilGheeImg from '../../../assets/user/categories/OilGhee-removebg-preview.png';
import masalaImg from '../../../assets/user/categories/masala-removebg-preview.png';
import sugarImg from '../../../assets/user/categories/Sugar-removebg-preview.png';
import groceryImg from '../../../assets/user/categories/Grocery-removebg-preview.png';

const BestSelling = () => {
  const navigate = useNavigate();
  const { addToCart, updateQuantity, getItemQuantity, isInCart, removeFromCart, cartCount } = useCart();
  const { wishlistItems, addToWishlist, removeFromWishlist } = useWishlist();
  const locationContext = useLocationContext();
  const [toastMessage, setToastMessage] = useState('');
  const [productsList, setProductsList] = useState([]);

  const userLat = locationContext?.currentLocation?.lat || locationContext?.currentLocation?.latitude;
  const userLng = locationContext?.currentLocation?.lng || locationContext?.currentLocation?.longitude;

  const calcTimeLeft = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const diff = Math.max(0, end.getTime() - now.getTime());
    return {
      hours: Math.floor(diff / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchFlashProducts = async () => {
      let apiItems = [];
      try {
        const params = { section: 'bestseller' };
        if (userLat != null && userLng != null) {
          params.lat = userLat;
          params.lng = userLng;
        }
        const res = await productService.getProducts(params);
        if (res && res.products && Array.isArray(res.products)) {
          apiItems = res.products;
        }
      } catch (err) {
        console.warn('Backend Best Selling Products fetch fallback:', err.message);
      }
      if (!isMounted) return;

      const formatItem = (p) => {
        const salePrice = Number(p.salePrice || p.price || 0);
        const mrp = Number(p.mrp || p.originalPrice || salePrice);
        let discountStr = p.discount;
        if (!discountStr && mrp > salePrice) {
          const pct = Math.round(((mrp - salePrice) / mrp) * 100);
          discountStr = `${pct}% OFF`;
        }
        return {
          id: p._id || p.id || p.sku || `p_${Math.random()}`,
          _id: p._id || p.id,
          name: p.name,
          price: salePrice,
          originalPrice: mrp,
          discount: discountStr || '',
          image: p.image || p.mainImage || grainsImg,
          unit: p.unit || `${p.unitValue || 1} ${p.unitType || 'kg'}`
        };
      };

      const combined = apiItems.map(p => formatItem(p));
      setProductsList(combined);
    };

    fetchFlashProducts();

    const handleLocChange = () => {
      fetchFlashProducts();
    };
    window.addEventListener('sathiseller_location_changed', handleLocChange);

    return () => {
      isMounted = false;
      window.removeEventListener('sathiseller_location_changed', handleLocChange);
    };
  }, [userLat, userLng]);

  const handleAddToCart = async (product) => {
    const res = await addToCart(product, 1, { navigate, returnUrl: window.location.pathname });
    if (res && res.success) {
      setToastMessage(`${product.name} added to cart!`);
      setTimeout(() => setToastMessage(''), 2000);
    }
  };

  const isWishlisted = (id) => wishlistItems?.some(item => item.id === id);

  const toggleWishlist = (e, product) => {
    e.stopPropagation();
    if (isWishlisted(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const formatNumber = (num) => String(num).padStart(2, '0');

  return (
    <div className="w-full max-w-[480px] md:max-w-7xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-slate-50 font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg z-50 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between py-4 px-5 bg-gradient-to-r from-[#ea580c] to-[#f97316] rounded-b-[20px] shadow-sm z-10 relative mb-2">
        <div className="flex items-center gap-3">
          <ArrowLeft size={22} color="white" className="cursor-pointer" onClick={() => navigate(-1)} />
          <div>
            <h2 className="text-[18px] font-bold m-0 text-white flex items-center gap-1.5">
              Best Selling Products <Zap size={18} className="fill-yellow-300 text-yellow-300 animate-pulse" />
            </h2>
          </div>
        </div>

        {/* Cart Icon */}
        <div className="relative cursor-pointer" onClick={() => navigate('/cart')}>
          <ShoppingCart size={22} color="white" />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-yellow-400 text-slate-900 text-[10px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </div>
      </header>

      {/* Mobile Timer Sub-header Banner */}
      <div className="px-4 py-2 md:hidden">
        <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-orange-700 flex items-center gap-1">
            Ends In:
          </span>
          <div className="flex items-center gap-1 font-bold text-orange-900">
            <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[13px] font-mono">{formatNumber(timeLeft.hours)}</span>:
            <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[13px] font-mono">{formatNumber(timeLeft.minutes)}</span>:
            <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[13px] font-mono">{formatNumber(timeLeft.seconds)}</span>
          </div>
        </div>
      </div>

      {/* Desktop Header & Timer Banner */}
      <div className="hidden md:flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-6 shadow-xs mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 m-0">
            Best Selling Products <Zap size={24} className="fill-amber-400 text-amber-500 animate-pulse" />
          </h1>
          <p className="text-sm text-slate-500 mt-1 mb-0">Handpicked top performers and customer favorites with special offers</p>
        </div>

        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 px-5 py-3 rounded-xl">
          <span className="text-sm font-bold text-orange-700">Deals End In:</span>
          <div className="flex items-center gap-1 font-bold text-orange-900">
            <span className="bg-orange-600 text-white px-2.5 py-1 rounded-md text-sm font-mono">{formatNumber(timeLeft.hours)}</span>:
            <span className="bg-orange-600 text-white px-2.5 py-1 rounded-md text-sm font-mono">{formatNumber(timeLeft.minutes)}</span>:
            <span className="bg-orange-600 text-white px-2.5 py-1 rounded-md text-sm font-mono">{formatNumber(timeLeft.seconds)}</span>
          </div>
        </div>
      </div>

      {/* Product List Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-2 md:p-0 [&::-webkit-scrollbar]:hidden pb-8 md:overflow-visible">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
          {productsList.map((product) => {
            const wishlisted = isWishlisted(product.id);
            return (
              <div 
                key={product.id} 
                className="bg-white border border-slate-100 rounded-xl md:rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col relative transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                {/* Discount Badge */}
                {product.discount && (
                  <span className="absolute top-2 left-2 bg-[#ff5500] text-white text-[10px] md:text-xs font-extrabold px-1.5 md:px-2 py-0.5 rounded z-10">
                    {product.discount}
                  </span>
                )}

                {/* Wishlist Button */}
                <button
                  onClick={(e) => toggleWishlist(e, product)}
                  className={`absolute top-2 right-2 rounded-full p-1.5 shadow-sm z-10 border-none cursor-pointer transition-all ${
                    wishlisted ? 'bg-emerald-50 text-emerald-600' : 'bg-white/80 backdrop-blur-sm text-slate-400 hover:text-red-500'
                  }`}
                >
                  <Heart size={14} className={wishlisted ? 'fill-emerald-600 text-emerald-600' : ''} />
                </button>

                {/* Image */}
                <img 
                  onClick={() => navigate(`/product/${product.id}`)} 
                  src={getImageUrl(product.image, product.name)} 
                  alt={product.name} 
                  className="w-full h-[120px] sm:h-[150px] md:h-[180px] object-cover bg-slate-50 cursor-pointer transition-transform duration-300 hover:scale-105" 
                  onError={(e) => handleImageError(e, product.name)}
                />

                {/* Details */}
                <div className="flex flex-col p-3 md:p-4 pt-2 flex-1 justify-between">
                  <div>
                    <h4 
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="text-[13px] md:text-sm font-bold m-0 mb-0.5 text-slate-800 line-clamp-1 cursor-pointer hover:text-emerald-700"
                    >
                      {product.name}
                    </h4>
                    <p className="text-[11px] md:text-xs text-slate-400 m-0 mb-0.5">{product.unit}</p>
                    <p className="text-[10px] md:text-[11px] font-medium text-slate-500 m-0 mb-2 truncate">by:- <span className="font-bold text-slate-700">{product.seller || 'Fashion Hub'}</span></p>
                  </div>

                  <div className="flex justify-between items-end mt-1 pt-2 border-t border-slate-50">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[14px] md:text-base font-extrabold text-slate-900">₹{Number(product.price).toFixed(2)}</span>
                      {product.originalPrice > product.price && (
                        <span className="text-[10px] md:text-xs text-slate-400 line-through">₹{Number(product.originalPrice).toFixed(2)}</span>
                      )}
                    </div>
                    {!isInCart(product.id || product._id) ? (
                      <button 
                        onClick={() => handleAddToCart(product)} 
                        className="px-2.5 md:px-3.5 py-1 md:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] md:text-xs flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-95 transition-all shrink-0"
                        aria-label="Add to cart"
                      >
                        <Plus size={13} strokeWidth={3} /> ADD
                      </button>
                    ) : (
                      <button 
                        onClick={() => removeFromCart(product.id || product._id)}
                        className="px-2.5 md:px-3.5 py-1 md:py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] md:text-xs flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-95 transition-all shrink-0"
                        aria-label="Remove from cart"
                      >
                        <Trash2 size={12} strokeWidth={2.5} /> REMOVE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BestSelling;

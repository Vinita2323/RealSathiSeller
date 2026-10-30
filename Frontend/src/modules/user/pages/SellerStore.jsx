import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  Store, 
  Star, 
  MapPin, 
  Clock, 
  CheckCircle, 
  ShoppingCart, 
  Heart, 
  Plus, 
  Trash2,
  Phone,
  ShieldCheck,
  Share2,
  Check,
  Sparkles
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useLocationContext } from '../../../context/LocationContext';
import { sellerService, productService } from '../../../services/authService';
import { getImageUrl } from '../../../utils/imageUtils';
import grainsImg from '../../../assets/user/categories/grains-removebg-preview.png';

export const SellerStore = () => {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const { addToCart, isInCart, removeFromCart, cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const locationContext = useLocationContext();

  const userLat = locationContext?.currentLocation?.lat || locationContext?.currentLocation?.latitude;
  const userLng = locationContext?.currentLocation?.lng || locationContext?.currentLocation?.longitude;

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info'); // 'info' | 'success' | 'wishlist'

  // Helper for saved favorite stores
  const getFavoriteStores = () => {
    try {
      const saved = localStorage.getItem('sathiseller_favorite_stores');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  };

  const [isFavoriteStore, setIsFavoriteStore] = useState(false);

  useEffect(() => {
    if (!seller) return;
    const favs = getFavoriteStores();
    const currentId = String(seller._id || seller.id || sellerId);
    const isFav = favs.some(f => String(f._id || f.id) === currentId || f.businessName === seller.businessName);
    setIsFavoriteStore(isFav);
  }, [seller, sellerId]);

  const showNotification = (msg, type = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 2800);
  };

  // Toggle Store Wishlist / Favorites
  const handleToggleWishlistStore = () => {
    if (!seller) return;
    const favs = getFavoriteStores();
    const currentId = String(seller._id || seller.id || sellerId);
    const existingIndex = favs.findIndex(f => String(f._id || f.id) === currentId || f.businessName === seller.businessName);

    if (existingIndex > -1) {
      favs.splice(existingIndex, 1);
      localStorage.setItem('sathiseller_favorite_stores', JSON.stringify(favs));
      setIsFavoriteStore(false);
      showNotification(`Removed "${seller.businessName}" from favorite stores`, 'info');
    } else {
      const storeObj = {
        _id: seller._id || seller.id,
        id: seller._id || seller.id,
        businessName: seller.businessName,
        storeLogo: seller.storeLogo,
        banner: seller.banner,
        rating: seller.rating || 4.8,
        reviewsCount: seller.reviewsCount || 120,
        tagline: seller.tagline,
        warehouseLocation: seller.warehouseLocation,
        addedAt: new Date().toISOString(),
      };
      favs.unshift(storeObj);
      localStorage.setItem('sathiseller_favorite_stores', JSON.stringify(favs));
      setIsFavoriteStore(true);
      showNotification(`❤️ Added "${seller.businessName}" to favorite stores!`, 'wishlist');
    }

    try {
      window.dispatchEvent(new Event('sathiseller_favorite_stores_updated'));
    } catch (e) {}
  };

  // Share Store Link
  const handleShareStore = async () => {
    const title = seller?.businessName ? `${seller.businessName} on Sathi Seller` : 'Sathi Seller Store';
    const text = `Order groceries & essentials from ${seller?.businessName || 'this store'} on Sathi Seller with fast 15-25 min delivery!`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        if (err.name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(url);
            showNotification('✓ Store link copied to clipboard!', 'success');
          } catch (clipErr) {}
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showNotification('✓ Store link copied to clipboard!', 'success');
      } catch (clipErr) {
        alert(`Store Link: ${url}`);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchStore = async () => {
      try {
        setLoading(true);
        const decoded = decodeURIComponent(sellerId || '');
        const params = (userLat != null && userLng != null) ? { lat: userLat, lng: userLng } : {};
        const res = await sellerService.getSellerStore(decoded, params);
        if (!isMounted) return;
        
        if (res.success && res.seller) {
          setSeller(res.seller);
          setProducts(res.products || []);
        } else {
          setSeller(null);
          setProducts([]);
        }
      } catch (err) {
        console.warn('Store fetch error:', err);
        if (isMounted) {
          setSeller(null);
          setProducts([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStore();

    const handleLocChange = () => {
      fetchStore();
    };
    window.addEventListener('sathiseller_location_changed', handleLocChange);

    return () => {
      isMounted = false;
      window.removeEventListener('sathiseller_location_changed', handleLocChange);
    };
  }, [sellerId, userLat, userLng]);

  const handleAddToCart = async (product) => {
    const res = await addToCart(product, 1, { navigate, returnUrl: window.location.pathname });
    if (res && res.success) {
      showNotification(`${product.name} added to cart!`, 'success');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!loading && seller && seller.isOnline === false) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 w-full pb-16 px-4 md:px-5 md:py-8 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl p-8 md:p-12 text-center max-w-md shadow-sm border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Store size={32} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{seller.businessName || 'Store'} is Currently Offline</h2>
          <p className="text-sm text-slate-500 mb-6">This store is not accepting orders at the moment. Please check back later or browse other active stores nearby.</p>
          <button
            onClick={() => navigate('/all-sellers')}
            className="w-full py-3 px-5 rounded-xl bg-[#ea580c] hover:bg-orange-700 text-white font-bold text-sm border-none cursor-pointer shadow-md transition-all"
          >
            Explore Nearby Stores
          </button>
        </div>
      </div>
    );
  }

  if (!loading && !seller) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 w-full pb-16 px-4 md:px-5 md:py-8 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl p-8 md:p-12 text-center max-w-md shadow-sm border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4 border border-orange-100">
            <Store size={32} className="text-[#ea580c]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Store Not Available</h2>
          <p className="text-sm text-slate-500 mb-6">This store does not service your selected delivery area or is currently inactive.</p>
          <button
            onClick={() => navigate('/all-sellers')}
            className="w-full py-3 px-5 rounded-xl bg-[#ea580c] hover:bg-orange-700 text-white font-bold text-sm border-none cursor-pointer shadow-md transition-all"
          >
            Explore Nearby Stores
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 w-full shadow-none pb-16 px-0 md:px-5 md:py-6">
      {/* Desktop Header & Breadcrumb Bar */}
      <div className="hidden md:flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button onClick={() => navigate(-1)} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
            <ArrowLeft size={16} /> Back
          </button>
          <span>/</span>
          <button onClick={() => navigate('/all-sellers')} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent">
            Stores
          </button>
          <span>/</span>
          <span className="text-slate-800 font-bold">{seller?.businessName || 'Store Details'}</span>
        </div>

        {/* Desktop Quick Actions (Wishlist Store & Share Store) */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToggleWishlistStore}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              isFavoriteStore 
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
            }`}
            title={isFavoriteStore ? 'Remove from favorite stores' : 'Add to favorite stores'}
          >
            <Heart size={14} className={isFavoriteStore ? 'fill-rose-500 text-rose-500' : ''} />
            <span>{isFavoriteStore ? 'Saved Store' : 'Wishlist Store'}</span>
          </button>

          <button
            onClick={handleShareStore}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Share Store Link"
          >
            <Share2 size={14} className="text-slate-500" />
            <span>Share Store</span>
          </button>
        </div>
      </div>

      {/* Store Banner & Navigation */}
      <div className="relative h-44 md:h-64 bg-slate-800 w-full md:rounded-3xl overflow-hidden shadow-sm">
        <img 
          src={seller?.banner || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80'} 
          alt={seller?.businessName || 'Store Banner'} 
          className="w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/50"></div>

        {/* Top Navbar Actions (Mobile & Responsive Overlay) */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10">
          <button 
            onClick={() => navigate(-1)} 
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-all shadow-xs"
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Right Action Icons: Wishlist, Share, Cart */}
          <div className="flex items-center gap-2">
            {/* Wishlist Store Icon Button */}
            <button 
              onClick={handleToggleWishlistStore}
              className={`w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-90 ${
                isFavoriteStore
                  ? 'bg-white text-rose-500 border-white shadow-md'
                  : 'bg-black/40 text-white border-white/20 hover:bg-black/60 hover:text-rose-400'
              }`}
              title={isFavoriteStore ? 'Remove from Wishlist' : 'Add Store to Wishlist'}
            >
              <Heart size={17} className={isFavoriteStore ? 'fill-rose-500 text-rose-500' : ''} />
            </button>

            {/* Share Store Icon Button */}
            <button 
              onClick={handleShareStore}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-all shadow-xs active:scale-90"
              title="Share Store"
            >
              <Share2 size={16} />
            </button>

            {/* Cart Icon Button */}
            <button 
              onClick={() => navigate('/cart')} 
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 flex items-center justify-center cursor-pointer relative hover:bg-black/60 transition-all shadow-xs active:scale-90"
              title="View Cart"
            >
              <ShoppingCart size={17} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ea580c] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-scaleIn">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Store Avatar & Badge Info */}
        <div className="absolute bottom-3 md:bottom-6 left-4 md:left-8 right-4 md:right-8 flex items-end justify-between">
          <div className="flex items-end gap-3 md:gap-5">
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl bg-white p-1 md:p-1.5 shadow-xl border-2 border-white overflow-hidden shrink-0">
              <img 
                src={seller?.storeLogo || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=160&auto=format&fit=crop&q=80'} 
                alt={seller?.businessName} 
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="text-white">
              <h1 className="text-base md:text-2xl font-bold m-0 flex items-center gap-1.5 md:gap-2 leading-tight">
                {seller?.businessName}
                <CheckCircle size={18} className="text-emerald-400 fill-emerald-400/20" />
              </h1>
              <p className="text-[11px] md:text-sm text-white/80 m-0 mt-0.5 line-clamp-1">{seller?.tagline || 'Verified Merchant'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-400 text-slate-900 font-black text-xs md:text-sm px-2.5 md:px-3.5 py-1 md:py-1.5 rounded-xl shadow-sm shrink-0">
            <Star size={14} className="fill-slate-900" />
            {seller?.rating || 4.9}
            <span className="hidden md:inline font-medium text-slate-800 text-xs">({seller?.reviewsCount || 184} reviews)</span>
          </div>
        </div>
      </div>

      {/* Store Quick Info Bar */}
      <div className="bg-white px-4 md:px-6 py-3.5 md:py-4 md:rounded-2xl border-b md:border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm text-slate-600 shadow-2xs md:mt-4 mb-4">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock size={15} className="text-emerald-600" />
            <span className="font-semibold text-slate-800">{seller?.deliveryTime || '15-25 min'} delivery</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <MapPin size={15} className="text-slate-400" />
            <span className="truncate max-w-[200px] md:max-w-[360px]">{seller?.warehouseLocation?.storeAddress || seller?.warehouseLocation?.city || 'Local Store'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
            <ShieldCheck size={15} />
            <span>FSSAI & GST Registered Merchant</span>
          </div>
        </div>
      </div>

      {/* In-Store Search */}
      <div className="px-4 md:px-0 mb-6">
        <div className="flex items-center bg-white rounded-xl md:rounded-2xl px-3.5 py-2.5 md:py-3 border border-slate-200 shadow-2xs focus-within:border-orange-500 transition-colors">
          <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
          <input 
            type="text" 
            placeholder={`Search items in ${seller?.businessName || 'this store'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border-none outline-none text-xs md:text-sm bg-transparent text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      {/* Store Products */}
      <div className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-bold text-slate-900 m-0">Store Products ({filteredProducts.length})</h2>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading store inventory...
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
            {filteredProducts.map((prod) => {
              const salePrice = Number(prod.salePrice || prod.price || 0);
              const originalPrice = Number(prod.mrp || prod.originalPrice || salePrice);
              const discount = prod.discount || (originalPrice > salePrice ? `${Math.round(((originalPrice - salePrice) / originalPrice) * 100)}% OFF` : '');

              return (
                <div key={prod._id || prod.id} className="bg-white border border-slate-100 rounded-xl md:rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:-translate-y-1 transition-all flex flex-col justify-between">
                  <div className="h-[125px] sm:h-[150px] md:h-[180px] w-full overflow-hidden bg-slate-50 relative cursor-pointer" onClick={() => navigate(`/product/${prod._id || prod.id}`)}>
                    <img 
                      src={getImageUrl(prod.mainImage || prod.image, grainsImg)} 
                      alt={prod.name} 
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = grainsImg;
                      }}
                    />
                    {discount && (
                      <span className="absolute top-2 left-2 bg-[#ff5500] text-white text-[10px] md:text-xs font-extrabold px-1.5 md:px-2 py-0.5 rounded z-10">
                        {discount}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col p-3 md:p-4 flex-1 justify-between gap-2">
                    <div>
                      <h4 
                        onClick={() => navigate(`/product/${prod._id || prod.id}`)}
                        className="text-[13px] md:text-sm font-bold m-0 mb-0.5 text-slate-800 line-clamp-1 cursor-pointer hover:text-emerald-700"
                      >
                        {prod.name}
                      </h4>
                      <p className="text-[11px] md:text-xs text-slate-400 m-0">{prod.unit || `${prod.unitValue || 1} ${prod.unitType || 'kg'}`}</p>
                    </div>
                    
                    <div className="flex items-baseline justify-between gap-1 pt-1 border-t border-slate-50">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[14px] md:text-base font-extrabold text-slate-900">₹{salePrice.toFixed(2)}</span>
                        {originalPrice > salePrice && (
                          <span className="text-[10px] md:text-xs text-slate-400 line-through">₹{originalPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {!isInCart(prod.id || prod._id) ? (
                        <button 
                          onClick={() => handleAddToCart({ ...prod, id: prod._id || prod.id, price: salePrice, originalPrice, discount, image: prod.mainImage || prod.image })} 
                          className="w-full py-1.5 md:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] md:text-xs flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-98 transition-all"
                          aria-label="Add to cart"
                        >
                          <Plus size={14} strokeWidth={3} /> ADD
                        </button>
                      ) : (
                        <button 
                          onClick={() => removeFromCart(prod.id || prod._id)}
                          className="w-full py-1.5 md:py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[12px] md:text-xs flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs active:scale-98 transition-all"
                          aria-label="Remove from cart"
                        >
                          <Trash2 size={13} strokeWidth={2.5} /> REMOVE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 mt-2">
            <Store size={48} className="text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700 m-0">No items found</h4>
            <p className="text-sm text-slate-400 m-0 mt-1">This store does not have items matching your search</p>
          </div>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-xs md:text-sm font-semibold shadow-xl z-50 whitespace-nowrap flex items-center gap-2 transition-all animate-slideUp ${
          toastType === 'wishlist' 
            ? 'bg-rose-600 text-white' 
            : toastType === 'success' 
              ? 'bg-slate-900 text-white' 
              : 'bg-slate-800 text-white'
        }`}>
          {toastType === 'wishlist' ? (
            <Heart size={15} className="fill-white" />
          ) : toastType === 'success' ? (
            <Check size={15} className="text-emerald-400" />
          ) : (
            <ShoppingCart size={15} />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default SellerStore;

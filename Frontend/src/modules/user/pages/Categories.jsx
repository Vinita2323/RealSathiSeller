import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Heart, Star, Filter, Plus, Trash2, ShoppingBag, Layers, X, RefreshCw } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useLocationContext } from '../../../context/LocationContext';
import { categoryService, productService } from '../../../services/authService';
import { 
  getImageUrl, 
  getCategoryFallbackImage,
  handleImageError,
  grainsImg,
  oilGheeImg,
  masalaImg,
  sugarImg,
  groceryImg,
  readyCookImg,
  homeCareImg,
  personalCareImg 
} from '../../../utils/imageUtils';
import { useDebounce } from '../../../hooks/useDebounce';
import { isProductOutOfStock } from '../../../utils/productStock';

const fallbackCategories = [
  { name: 'Grains & Flours', image: grainsImg },
  { name: 'Oil & Ghee', image: oilGheeImg },
  { name: 'Spices & Masala', image: masalaImg },
  { name: 'Sugar & Sweeteners', image: sugarImg },
  { name: 'Grocery Essentials', image: groceryImg },
  { name: 'Ready-to-Cook', image: readyCookImg },
  { name: 'Home Care', image: homeCareImg },
  { name: 'Personal Care', image: personalCareImg }
];

const defaultSubCategoryMap = {
  'Grains & Flours': [
    { _id: 'sub_atta', name: 'Ata', image: grainsImg },
    { _id: 'sub_dal', name: 'Dal types', image: grainsImg },
    { _id: 'sub_rice', name: 'Rice & Rice Products', image: grainsImg }
  ],
  'Oil & Ghee': [
    { _id: 'sub_oil', name: 'Edible Oils', image: oilGheeImg },
    { _id: 'sub_ghee', name: 'Ghee & Vanaspati', image: oilGheeImg }
  ],
  'Spices & Masala': [
    { _id: 'sub_spices', name: 'Whole Spices', image: masalaImg },
    { _id: 'sub_powder', name: 'Powdered Spices', image: masalaImg }
  ],
  'Sugar & Sweeteners': [
    { _id: 'sub_sugar', name: 'Sugar & Salt', image: sugarImg }
  ]
};

const Categories = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart, getItemQuantity, isInCart, removeFromCart } = useCart();
  const locationContext = useLocationContext();

  const userLat = locationContext?.currentLocation?.lat || locationContext?.currentLocation?.latitude;
  const userLng = locationContext?.currentLocation?.lng || locationContext?.currentLocation?.longitude;

  const [toastMessage, setToastMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchTerm = useDebounce(searchInput, 300);
  
  // URL and Session synced state
  const urlCategory = searchParams.get('category');
  const urlSubCategory = searchParams.get('subCategory');

  const [activeCategory, setActiveCategoryState] = useState(() => {
    return urlCategory || sessionStorage.getItem('sathiseller_active_cat') || 'All';
  });

  const [activeSubCategory, setActiveSubCategoryState] = useState(() => {
    return urlSubCategory || sessionStorage.getItem('sathiseller_active_sub') || null;
  });

  const [allCategories, setAllCategories] = useState([]);
  const [sidebarCategories, setSidebarCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [totalProductCount, setTotalProductCount] = useState(0);

  // Sync state if URL search parameters change externally
  useEffect(() => {
    if (urlCategory && urlCategory !== activeCategory) {
      setActiveCategoryState(urlCategory);
      sessionStorage.setItem('sathiseller_active_cat', urlCategory);
    }
    if (urlSubCategory !== undefined && urlSubCategory !== activeSubCategory) {
      setActiveSubCategoryState(urlSubCategory || null);
      if (urlSubCategory) {
        sessionStorage.setItem('sathiseller_active_sub', urlSubCategory);
      } else {
        sessionStorage.removeItem('sathiseller_active_sub');
      }
    }
  }, [urlCategory, urlSubCategory]);

  const setActiveCategory = (catName) => {
    setActiveCategoryState(catName);
    sessionStorage.setItem('sathiseller_active_cat', catName);
    
    // Clear subcategory when switching category
    setActiveSubCategoryState(null);
    sessionStorage.removeItem('sathiseller_active_sub');

    const newParams = new URLSearchParams(searchParams);
    if (catName === 'All') {
      newParams.delete('category');
    } else {
      newParams.set('category', catName);
    }
    newParams.delete('subCategory');
    setSearchParams(newParams, { replace: true });
  };

  const setActiveSubCategory = (subCatName) => {
    setActiveSubCategoryState(subCatName);
    const newParams = new URLSearchParams(searchParams);
    if (subCatName) {
      sessionStorage.setItem('sathiseller_active_sub', subCatName);
      newParams.set('subCategory', subCatName);
    } else {
      sessionStorage.removeItem('sathiseller_active_sub');
      newParams.delete('subCategory');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Fetch Categories on Mount
  useEffect(() => {
    let isMounted = true;
    const fetchCategoriesData = async () => {
      try {
        setLoadingCategories(true);
        const res = await (categoryService.getAllCategories ? categoryService.getAllCategories(true) : categoryService.getCategories(true));
        if (!isMounted) return;

        if (res && res.success && Array.isArray(res.categories)) {
          setAllCategories(res.categories);
          const topLevel = res.categories.filter(c => !c.parent);
          const list = topLevel.length > 0 ? topLevel : fallbackCategories;
          setSidebarCategories(list);

          // If activeCategory is not 'All' and not found in categories, check case-insensitively
          if (activeCategory !== 'All') {
            const match = list.find(c => c.name.toLowerCase().trim() === activeCategory.toLowerCase().trim());
            if (match && match.name !== activeCategory) {
              setActiveCategoryState(match.name);
              sessionStorage.setItem('sathiseller_active_cat', match.name);
            }
          }
        } else {
          setSidebarCategories(fallbackCategories);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        if (isMounted) setSidebarCategories(fallbackCategories);
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };

    fetchCategoriesData();
    return () => { isMounted = false; };
  }, []);

  // Fetch Products whenever Category or SubCategory changes
  useEffect(() => {
    let isMounted = true;
    const fetchCategoryProducts = async () => {
      try {
        setLoadingProducts(true);
        const params = {};
        if (activeCategory && activeCategory !== 'All') {
          params.category = activeCategory;
        }
        if (activeSubCategory) {
          params.subCategory = activeSubCategory;
        }
        if (userLat != null && userLng != null) {
          params.lat = userLat;
          params.lng = userLng;
        }

        const res = await productService.getProducts(params);
        if (!isMounted) return;

        if (res && res.success && Array.isArray(res.products)) {
          setProducts(res.products);
          if (activeCategory === 'All' && !activeSubCategory) {
            setTotalProductCount(res.total || res.products.length);
          }
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error('Failed to fetch category products:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };

    fetchCategoryProducts();

    const handleLocChange = () => {
      fetchCategoryProducts();
    };
    window.addEventListener('sathiseller_location_changed', handleLocChange);

    return () => { 
      isMounted = false; 
      window.removeEventListener('sathiseller_location_changed', handleLocChange);
    };
  }, [activeCategory, activeSubCategory, userLat, userLng]);

  const handleWishlistClick = (e, product) => {
    e.stopPropagation();
    const isAdded = toggleWishlist(product);
    if (isAdded) {
      setToastMessage('Item added to wishlist! ❤️');
      setTimeout(() => setToastMessage(''), 2500);
    } else {
      setToastMessage('Item removed from wishlist');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  // Client-side search filtering (debounced)
  const filteredProducts = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return products;
    const term = debouncedSearchTerm.toLowerCase().trim();
    return products.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.seller && typeof p.seller === 'string' && p.seller.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, debouncedSearchTerm]);

  // Dynamically compute subcategories for activeCategory
  const availableSubCategories = useMemo(() => {
    if (activeCategory === 'All') return [];

    const activeCatObj = sidebarCategories.find(c => 
      c.name.toLowerCase().trim() === activeCategory.toLowerCase().trim() || 
      c._id === activeCategory
    );
    const catId = activeCatObj ? (activeCatObj._id || activeCatObj.id) : null;

    // 1. Check parent-child subcategories from allCategories
    let subs = catId 
      ? allCategories.filter(c => c.parent && (String(c.parent) === String(catId) || String(c.parent._id || '') === String(catId)))
      : [];

    // 2. Also extract distinct subcategories from loaded products
    const productSubNames = new Set(
      products
        .map(p => (p.subCategory || '').trim())
        .filter(s => s && s.toLowerCase() !== 'none' && s.toLowerCase() !== 'all')
    );

    // Merge distinct names
    const mergedList = [...subs];
    productSubNames.forEach(subName => {
      if (!mergedList.some(s => s.name.toLowerCase().trim() === subName.toLowerCase().trim())) {
        mergedList.push({
          _id: `dyn_${subName}`,
          name: subName,
          image: null
        });
      }
    });

    // 3. Fallback map if still empty
    if (mergedList.length === 0 && defaultSubCategoryMap[activeCategory]) {
      return defaultSubCategoryMap[activeCategory];
    }

    return mergedList;
  }, [activeCategory, sidebarCategories, allCategories, products]);

  return (
    <div className="w-full h-[100dvh] md:h-auto md:min-h-screen bg-[#fdfaf6] font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible px-0 md:px-5 md:py-6">
      
      {/* Mobile Search Header */}
      <div className="md:hidden p-3.5 bg-white shadow-2xs border-b border-slate-100 shrink-0">
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#ff5500] flex items-center justify-center font-black text-xs">
              <ShoppingBag size={15} />
            </div>
            <h2 className="text-[18px] font-black text-slate-900 m-0">All Categories</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {filteredProducts.length} items
          </span>
        </div>
        <div className="bg-[#f5f6fa] rounded-xl px-3 py-2 flex items-center gap-2 border border-slate-100 focus-within:border-orange-300 focus-within:bg-white transition-all">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input 
            type="text" 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products or categories..." 
            className="bg-transparent border-none outline-none text-[12px] w-full text-slate-800 font-medium placeholder:text-slate-400"
          />
          {searchInput && (
            <button 
              onClick={() => setSearchInput('')} 
              className="text-slate-400 hover:text-slate-600 p-0.5 border-none bg-transparent cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden md:overflow-visible md:gap-6 min-h-0">
        
        {/* Left Sidebar */}
        <aside className="w-[80px] sm:w-[88px] md:w-64 bg-white border-r md:border md:rounded-2xl border-slate-100 overflow-y-auto shrink-0 [&::-webkit-scrollbar]:hidden md:p-2.5 md:shadow-xs">
          
          <div className="hidden md:flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Categories</h3>
            <span className="text-[11px] font-bold text-[#ff5500] bg-orange-50 px-2 py-0.5 rounded-full">
              {sidebarCategories.length + 1}
            </span>
          </div>

          {/* "All Products" Option at Top */}
          <div 
            onClick={() => setActiveCategory('All')}
            className={`py-3 px-1 md:px-3 md:py-2.5 flex flex-col md:flex-row items-center md:gap-3 justify-center md:justify-start cursor-pointer relative transition-all border-b border-slate-50 md:border-b-0 md:rounded-xl md:mb-1.5 ${
              activeCategory === 'All' 
                ? 'bg-[#fff5ee] text-[#ff5500] font-black' 
                : 'hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            {activeCategory === 'All' && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff5500] rounded-r-full"></div>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
              activeCategory === 'All' ? 'bg-[#ff5500] text-white shadow-sm scale-105' : 'bg-slate-100 text-slate-500'
            }`}>
              <Layers size={18} />
            </div>
            <div className="flex flex-col text-center md:text-left truncate">
              <span className={`text-[10px] md:text-xs leading-tight truncate ${
                activeCategory === 'All' ? 'text-[#ff5500] font-black' : 'text-slate-800 font-bold'
              }`}>
                All Products
              </span>
              <span className="hidden md:block text-[10px] text-slate-400 font-medium">
                {totalProductCount > 0 ? `${totalProductCount} items` : 'Explore catalog'}
              </span>
            </div>
          </div>

          {/* Category List */}
          {sidebarCategories.map((cat, idx) => {
            const isActive = activeCategory.toLowerCase().trim() === cat.name.toLowerCase().trim();
            const fallbackImg = getCategoryFallbackImage(cat.name);
            const imgSrc = getImageUrl(cat.image, fallbackImg);
            
            return (
              <div 
                key={cat._id || idx}
                onClick={() => setActiveCategory(cat.name)}
                className={`py-3 px-1 md:px-3 md:py-2 flex flex-col md:flex-row items-center md:gap-3 justify-center md:justify-start cursor-pointer relative transition-all border-b border-slate-50 md:border-b-0 md:rounded-xl md:mb-1 ${
                  isActive ? 'bg-[#fff5ee] text-[#ff5500]' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff5500] rounded-r-full"></div>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center p-1.5 mb-1 md:mb-0 shrink-0 transition-transform ${
                  isActive ? 'scale-105 bg-white shadow-2xs' : 'opacity-85 bg-slate-50'
                }`}>
                  <img 
                    src={imgSrc} 
                    alt={cat.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackImg;
                    }}
                  />
                </div>
                <span className={`text-[9.5px] md:text-xs text-center md:text-left font-bold leading-tight line-clamp-2 md:truncate ${
                  isActive ? 'text-[#ff5500] font-extrabold' : 'text-slate-700'
                }`}>
                  {cat.name}
                </span>
              </div>
            );
          })}
          
          <div className="h-[120px] md:hidden"></div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 p-2.5 md:p-0 overflow-y-auto md:overflow-visible [&::-webkit-scrollbar]:hidden bg-[#fdfaf6] flex flex-col min-w-0">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 bg-white md:bg-transparent p-3 md:p-0 rounded-2xl border border-slate-100 md:border-none shadow-2xs md:shadow-none">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] md:text-[22px] font-black text-slate-900 uppercase tracking-tight m-0">
                  {activeCategory === 'All' ? 'All Products' : activeCategory}
                </h1>
                {activeSubCategory && (
                  <span className="text-xs font-bold text-[#ff5500] bg-orange-50 px-2 py-0.5 rounded-md">
                    / {activeSubCategory}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-400 m-0 uppercase tracking-wider mt-0.5">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'ITEM' : 'ITEMS'} AVAILABLE
              </p>
            </div>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-2xs w-72 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input 
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Filter by name, brand, seller..."
                className="bg-transparent border-none outline-none text-xs w-full text-slate-800 font-medium placeholder:text-slate-400"
              />
              {searchInput && (
                <button 
                  onClick={() => setSearchInput('')} 
                  className="text-slate-400 hover:text-slate-600 p-0.5 border-none bg-transparent cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Subcategories Horizontal Bar (If Available) */}
          {availableSubCategories.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto pb-3 mb-3 shrink-0 [&::-webkit-scrollbar]:hidden">
              <button 
                onClick={() => setActiveSubCategory(null)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  activeSubCategory === null 
                    ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                }`}
              >
                <span>All {activeCategory}</span>
              </button>
              
              {availableSubCategories.map(sub => {
                const isSubActive = activeSubCategory === sub.name;
                return (
                  <button 
                    key={sub._id || sub.name}
                    onClick={() => setActiveSubCategory(isSubActive ? null : sub.name)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSubActive 
                        ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <span>{sub.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading Skeletons */}
          {loadingProducts && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 pb-20 md:pb-10">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 animate-pulse flex flex-col gap-2.5">
                  <div className="w-full h-28 bg-slate-100 rounded-xl"></div>
                  <div className="h-3.5 bg-slate-100 rounded w-3/4"></div>
                  <div className="h-2.5 bg-slate-100 rounded w-1/2"></div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                    <div className="h-7 bg-slate-100 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingProducts && filteredProducts.length === 0 && (
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-100 text-center flex flex-col items-center justify-center my-6 shadow-2xs max-w-lg mx-auto w-full">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#ff5500] flex items-center justify-center mb-4">
                <ShoppingBag size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900 m-0 mb-1.5">
                {debouncedSearchTerm ? 'No matching items found' : `No products in "${activeCategory}" yet`}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm m-0 mb-5 leading-relaxed font-medium">
                {debouncedSearchTerm 
                  ? `We couldn't find any products matching "${debouncedSearchTerm}". Try a different keyword.` 
                  : (userLat && userLng 
                      ? 'No verified sellers in your delivery area are currently offering products in this selection. Try changing your delivery location or browsing all items.' 
                      : 'Items in this category are being updated. You can browse all available products across all categories below.')}
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-3">
                {debouncedSearchTerm ? (
                  <button 
                    onClick={() => setSearchInput('')}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer border-none hover:bg-slate-800 transition-all shadow-sm"
                  >
                    Clear Search
                  </button>
                ) : activeCategory !== 'All' ? (
                  <button 
                    onClick={() => setActiveCategory('All')}
                    className="px-5 py-2.5 rounded-xl bg-[#ff5500] text-white font-bold text-xs cursor-pointer border-none hover:bg-[#e04b00] transition-all shadow-sm"
                  >
                    Browse All Products
                  </button>
                ) : null}
                
                <button 
                  onClick={() => navigate('/')}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer border-none hover:bg-slate-200 transition-all"
                >
                  Go to Home
                </button>
              </div>
            </div>
          )}

          {/* Product Grid */}
          {!loadingProducts && filteredProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 pb-28 md:pb-12">
              {filteredProducts.map((item) => {
                const itemDiscount = item.mrp && item.salePrice ? Math.round(((item.mrp - item.salePrice) / item.mrp) * 100) : 0;
                const isItemInCart = isInCart(item._id || item.id);
                const isOutOfStock = isProductOutOfStock(item);

                return (
                  <div 
                    key={item._id || item.id} 
                    className="bg-white rounded-xl sm:rounded-2xl overflow-hidden flex flex-col shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative border border-slate-100/80 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] group"
                    onClick={() => navigate(`/product/${item._id || item.id}`)}
                  >
                    {/* Image Section */}
                    <div className="bg-[#f8fafc] h-[105px] sm:h-[125px] md:h-[150px] relative w-full overflow-hidden flex items-center justify-center p-1.5 sm:p-2">
                      {/* Heart Wishlist */}
                      <button 
                        className={`absolute top-1.5 right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shadow-2xs cursor-pointer z-10 transition-all border-none ${
                          isInWishlist(item._id || item.id) 
                            ? 'bg-rose-50 text-rose-600' 
                            : 'bg-white/90 backdrop-blur-xs text-slate-500 hover:bg-white hover:text-rose-500'
                        }`}
                        onClick={(e) => handleWishlistClick(e, item)}
                        aria-label="Toggle Wishlist"
                      >
                        <Heart size={12} className={isInWishlist(item._id || item.id) ? "text-rose-600 fill-rose-600" : ""} />
                      </button>
                      
                      <img 
                        src={getImageUrl(item.mainImage || item.image, item.name)} 
                        alt={item.name} 
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => handleImageError(e, item.name)} 
                      />
                      
                      {/* Out of stock badge */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-1">
                          <span className="bg-slate-800 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details Section */}
                    <div className="p-2 sm:p-2.5 md:p-3 bg-white flex flex-col justify-between flex-1 gap-1.5">
                      <div>
                        <h4 className="text-[11.5px] sm:text-xs md:text-sm font-bold text-slate-900 m-0 mb-0.5 leading-tight line-clamp-2">
                          {item.name}
                        </h4>
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 m-0 truncate">
                          {item.unit || `${item.unitValue || 1} ${item.unitType || 'unit'}`}
                        </p>
                        <p className="text-[10px] sm:text-[10.5px] font-medium text-slate-500 m-0 mt-0.5 truncate">
                          by <span className="font-bold text-slate-700">{typeof item.seller === 'string' ? item.seller : 'Sathi Seller Store'}</span>
                        </p>
                      </div>

                      {/* Price Row */}
                      <div className="flex items-baseline justify-between gap-1 pt-1 border-t border-slate-50">
                        <div className="flex items-baseline gap-1 truncate">
                          <span className="text-xs sm:text-sm md:text-base font-black text-slate-950">
                            ₹{item.salePrice || item.price}
                          </span>
                          {item.mrp && item.mrp > (item.salePrice || item.price) && (
                            <span className="text-[10px] sm:text-[11px] text-slate-400 line-through">
                              ₹{item.mrp}
                            </span>
                          )}
                        </div>
                        {itemDiscount > 0 && (
                          <span className="text-[9px] sm:text-[10px] font-black text-[#ff5500] whitespace-nowrap shrink-0 bg-orange-50 px-1 py-0.5 rounded">
                            -{itemDiscount}%
                          </span>
                        )}
                      </div>

                      {/* Add to Cart / Remove Button */}
                      <div>
                        {!isItemInCart ? (
                          <button 
                            disabled={isOutOfStock}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (isOutOfStock) return;
                              const res = await addToCart(item, 1, { navigate, returnUrl: window.location.pathname });
                              if (res && res.success) {
                                setToastMessage('Item added to cart! 🛒');
                                setTimeout(() => setToastMessage(''), 2000);
                              }
                            }}
                            className={`w-full py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1 border-none cursor-pointer transition-all ${
                              isOutOfStock 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-2xs'
                            }`}
                            aria-label="Add to cart"
                          >
                            <Plus size={13} strokeWidth={3} /> ADD
                          </button>
                        ) : (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              await removeFromCart(item._id || item.id);
                              setToastMessage('Item removed from cart');
                              setTimeout(() => setToastMessage(''), 2000);
                            }}
                            className="w-full py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1 border-none cursor-pointer shadow-2xs transition-all"
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
          )}

        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xl z-[100] animate-fade-in-up whitespace-nowrap flex items-center gap-2 border border-slate-700">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default Categories;

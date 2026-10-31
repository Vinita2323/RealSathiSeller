import React, { useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Star, ShoppingCart, ChevronRight, ChevronDown, 
  ShieldCheck, Tag, Share2, Plus, Minus, Clock, Check, Trash2
} from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { productService } from '../../../services/authService';
import productReviewService from '../../../services/productReviewService';
import { getImageUrl, handleImageError, getInitialSvgDataUrl } from '../../../utils/imageUtils';
import { cartLineId, normalizeAttributes } from '../../../utils/variantLabel';
import { getDisplayStock, getEffectiveStock } from '../../../utils/productStock';

/** Build default option selections so chips are highlighted on first paint. */
const buildDefaultSelectedAttributes = (productDoc) => {
  if (!productDoc?.hasVariants || !Array.isArray(productDoc.variantOptions)) return {};

  const options = productDoc.variantOptions.filter(
    (opt) => opt?.name && Array.isArray(opt.values) && opt.values.length > 0
  );
  if (!options.length) return {};

  // Prefer attributes from the first active SKU so the combo is a real match
  const firstActive = (Array.isArray(productDoc.variants) ? productDoc.variants : []).find(
    (v) => v && v.active !== false && v.attributes && typeof v.attributes === 'object'
  );
  if (firstActive?.attributes) {
    const fromSku = {};
    for (const opt of options) {
      const optKey = String(opt.name).trim();
      const attrKey = Object.keys(firstActive.attributes).find(
        (k) => String(k).trim().toLowerCase() === optKey.toLowerCase()
      );
      const raw = attrKey != null ? firstActive.attributes[attrKey] : undefined;
      const value = raw !== undefined && raw !== null ? String(raw).trim() : '';
      if (value && opt.values.some((v) => String(v).trim() === value)) {
        fromSku[optKey] = value;
      }
    }
    if (options.every((opt) => fromSku[String(opt.name).trim()])) {
      return fromSku;
    }
  }

  // Fallback: first listed value per option
  const initial = {};
  for (const opt of options) {
    initial[String(opt.name).trim()] = String(opt.values[0]).trim();
  }
  return initial;
};

const DESCRIPTION_PREVIEW_LENGTH = 160;

const previewDescription = (text) => {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= DESCRIPTION_PREVIEW_LENGTH) return trimmed;
  const sliced = trimmed.slice(0, DESCRIPTION_PREVIEW_LENGTH);
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;
  return `${cutoff.trim()}...`;
};

const DescriptionText = ({ text, expanded, onToggle }) => {
  const fullText = String(text || '').trim();
  const isLong = fullText.length > DESCRIPTION_PREVIEW_LENGTH;

  return (
    <div>
      <p className="text-[12px] text-slate-600 leading-relaxed m-0 font-normal break-words [overflow-wrap:anywhere]">
        {expanded || !isLong ? fullText : previewDescription(fullText)}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1.5 p-0 border-none bg-transparent text-[#ff5500] text-[12px] font-bold cursor-pointer"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

const ProductDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart, replaceCartLineVariant, updateQuantity, getItemQuantity, isInCart, removeFromCart, cartItems } = useCart();
  const location = useLocation();
  const buyNowLock = useRef(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const toggleAccordion = (section) => {
    setActiveAccordion(activeAccordion === section ? null : section);
  };

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  React.useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        setDescriptionExpanded(false);
        const res = await productService.getProductById(id);
        if (res && res.success && res.product) {
          setProduct(res.product);

          // Restore selection from cart when returning from checkout/cart (don't wipe user choices)
          const productId = String(res.product._id || res.product.id || id);
          const fromLineId = location.state?.cartLineId;
          const cartLine =
            (fromLineId
              ? cartItems.find((item) => item.lineId === fromLineId || cartLineId(item) === fromLineId)
              : null)
            || cartItems.find((item) => String(item.productId || item.id || item._id) === productId);

          if (cartLine) {
            const attrs = normalizeAttributes(
              cartLine.selectedAttributes && Object.keys(cartLine.selectedAttributes).length
                ? cartLine.selectedAttributes
                : Object.fromEntries(
                    (Array.isArray(cartLine.selectedVariants) ? cartLine.selectedVariants : [])
                      .filter((row) => row?.name)
                      .map((row) => [String(row.name).trim(), row.value])
                  )
            );
            setSelectedAttributes(
              Object.keys(attrs).length ? attrs : buildDefaultSelectedAttributes(res.product)
            );
            setQuantity(Math.max(1, Number(cartLine.quantity) || 1));
          } else {
            // Default-select a real variant combo so option chips are highlighted on load
            setSelectedAttributes(buildDefaultSelectedAttributes(res.product));
            setQuantity(1);
          }

          fetchReviews(res.product._id || id);
        } else {
          setError('Product not found');
        }
      } catch (err) {
        console.error('Failed to fetch product details:', err);
        setError('Failed to fetch product details');
      } finally {
        setLoading(false);
      }
    };
    
    const fetchReviews = async (targetId = id) => {
      if (!targetId) return;
      try {
        setLoadingReviews(true);
        const res = await productReviewService.getProductReviews(targetId);
        if (res && res.success) {
          setReviewsData(res);
        }
      } catch (err) {
        console.warn('Failed to load product reviews:', err);
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchProductDetails();
    // Restore from cartItems/location when re-entering this product (e.g. back from checkout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.state?.cartLineId]);

  // All option groups must be chosen before a variant is considered matched
  const requiredOptionNames = React.useMemo(() => {
    if (!product?.hasVariants || !Array.isArray(product.variantOptions)) return [];
    return product.variantOptions
      .filter((opt) => opt?.name && Array.isArray(opt.values) && opt.values.length > 0)
      .map((opt) => String(opt.name).trim())
      .filter(Boolean);
  }, [product]);

  const allOptionsSelected = React.useMemo(() => {
    if (!requiredOptionNames.length) return Object.keys(selectedAttributes || {}).length > 0;
    return requiredOptionNames.every((name) => {
      const selected = selectedAttributes[name];
      return selected !== undefined && selected !== null && String(selected).trim() !== '';
    });
  }, [requiredOptionNames, selectedAttributes]);

  // Find currently matched variant — only when every option is selected (no partial match)
  const matchedVariant = React.useMemo(() => {
    if (!product || !product.hasVariants || !Array.isArray(product.variants) || product.variants.length === 0) {
      return null;
    }
    if (!allOptionsSelected) return null;

    const found = product.variants.find((variant) => {
      if (!variant?.attributes || variant.active === false) return false;
      const attrs = variant.attributes;
      return Object.entries(selectedAttributes).every(([attrName, attrVal]) => {
        const key = Object.keys(attrs).find((name) => String(name).trim().toLowerCase() === attrName.toLowerCase());
        return key && String(attrs[key]).trim() === String(attrVal).trim();
      });
    });

    return found || null;
  }, [product, selectedAttributes, allOptionsSelected]);

  const lineSelection = matchedVariant
    ? {
        variantSku: matchedVariant.sku || '',
        // Always persist only what the user selected — never inflate from full variant attributes
        selectedAttributes: { ...selectedAttributes },
      }
    : null;
  const selectedLineId = lineSelection
    ? cartLineId({ productId: product?.id || product?._id, ...lineSelection })
    : (product?.id || product?._id);

  // Sync active image with product mainImage and non-dummy variant images
  React.useEffect(() => {
    const isDummyImage = (url) => !url || url.includes('photo-1586201375761-83865001e31c');
    const primaryImg = product?.mainImage || product?.image || (Array.isArray(product?.galleryImages) && product.galleryImages[0]);

    if (matchedVariant && matchedVariant.image && !isDummyImage(matchedVariant.image)) {
      setActiveImage(matchedVariant.image);
    } else if (primaryImg) {
      setActiveImage(primaryImg);
    }
  }, [matchedVariant, product]);

  const handleSelectAttribute = (attrName, val) => {
    const name = String(attrName || '').trim();
    const value = String(val ?? '').trim();
    if (!name || !value) return;
    setSelectedAttributes((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Similar products = other products from the same category as the one being viewed
  const [similarProducts, setSimilarProducts] = useState([]);
  const currentProductId = product?._id || product?.id;
  const currentCategory = product?.category;

  React.useEffect(() => {
    if (!currentCategory) {
      setSimilarProducts([]);
      return undefined;
    }
    let cancelled = false;
    const fetchSimilar = async () => {
      try {
        const res = await productService.getProducts({ category: currentCategory, limit: 12 });
        if (cancelled || !res?.success) return;
        const list = (res.products || [])
          .filter((p) => String(p._id) !== String(currentProductId))
          .slice(0, 10)
          .map((p) => ({
            ...p,
            id: p._id,
            brand: p.brand || (typeof p.seller === 'string' ? p.seller : '') || currentCategory,
            price: Number(p.salePrice || p.mrp || 0),
            originalPrice: Number(p.mrp || 0),
            image: p.mainImage,
          }));
        setSimilarProducts(list);
      } catch {
        if (!cancelled) setSimilarProducts([]);
      }
    };
    fetchSimilar();
    return () => {
      cancelled = true;
    };
  }, [currentCategory, currentProductId]);

  const handleWishlistClick = () => {
    const isAdded = toggleWishlist(product);
    setToastMessage(isAdded ? 'Added to wishlist' : 'Removed from wishlist');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || 'Sathi Seller Product',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setToastMessage('Link copied to clipboard!');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  const getProductToAdd = () => {
    if (!product) return null;
    if (matchedVariant) {
      // Build a display title from the user's selections only (not the full SKU title)
      const selectionTitle = Object.entries(selectedAttributes)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
      return {
        ...product,
        id: product._id || product.id,
        productId: product._id || product.id,
        salePrice: matchedVariant.price,
        price: matchedVariant.price,
        mrp: matchedVariant.originalPrice || matchedVariant.price,
        originalPrice: matchedVariant.originalPrice || matchedVariant.price,
        stock: matchedVariant.stock,
        variation: selectionTitle || matchedVariant.title,
        variantTitle: selectionTitle || matchedVariant.title,
        variantSku: matchedVariant.sku,
        variantId: matchedVariant._id || '',
        sku: matchedVariant.sku || product.sku,
        image: matchedVariant.image || product.mainImage || product.image,
        // Only user-selected options — do not copy full matchedVariant.attributes
        selectedAttributes: { ...selectedAttributes },
        selectedVariants: Object.entries(selectedAttributes).map(([name, value]) => ({
          variantId: matchedVariant._id || '',
          name,
          value,
        })),
        // Strip nested attributes so cart sync cannot fall back to the full SKU attrs
        selectedVariant: {
          _id: matchedVariant._id,
          sku: matchedVariant.sku,
          title: selectionTitle || matchedVariant.title,
          price: matchedVariant.price,
          originalPrice: matchedVariant.originalPrice,
          stock: matchedVariant.stock,
          image: matchedVariant.image,
          attributes: { ...selectedAttributes },
        },
      };
    }
    return product;
  };

  const handleAddToCart = async () => {
    if (product?.hasVariants && !allOptionsSelected) {
      const missing = requiredOptionNames.filter((name) => !selectedAttributes[name]);
      setToastMessage(
        missing.length
          ? `Please select: ${missing.join(', ')}`
          : 'Please select an available option'
      );
      setTimeout(() => setToastMessage(''), 2500);
      return;
    }
    if (product?.hasVariants && !matchedVariant) {
      setToastMessage('Please select an available option');
      setTimeout(() => setToastMessage(''), 2500);
      return;
    }
    const itemToAdd = getProductToAdd();
    if (!itemToAdd) return;
    const res = await addToCart(itemToAdd, quantity, { navigate, returnUrl: window.location.pathname });
    if (res && res.success) {
      setToastMessage(`${quantity} item${quantity > 1 ? 's' : ''} added to cart! 🛒`);
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  const handleBuyNow = async () => {
    if (buyNowLock.current) return;
    if (product?.hasVariants && !allOptionsSelected) {
      const missing = requiredOptionNames.filter((name) => !selectedAttributes[name]);
      setToastMessage(
        missing.length
          ? `Please select: ${missing.join(', ')}`
          : 'Please select an available option'
      );
      setTimeout(() => setToastMessage(''), 2500);
      return;
    }
    if (product?.hasVariants && !matchedVariant) {
      setToastMessage('Please select an available option');
      setTimeout(() => setToastMessage(''), 2500);
      return;
    }
    const itemToAdd = getProductToAdd();
    if (!itemToAdd) return;

    buyNowLock.current = true;
    try {
      const productId = String(itemToAdd.productId || itemToAdd.id || itemToAdd._id || '');
      const selection = {
        variantSku: itemToAdd.variantSku,
        selectedAttributes: itemToAdd.selectedAttributes,
      };
      const desiredQty = Math.max(1, Number(quantity) || 1);
      const targetLineId = cartLineId({
        productId,
        variantSku: selection.variantSku,
        selectedAttributes: selection.selectedAttributes,
      });

      // Already in cart: apply the quantity shown on this page, then checkout
      if (isInCart(productId, selection)) {
        await updateQuantity(targetLineId, 0, desiredQty);
        navigate('/checkout');
        return;
      }

      const fromCartLineId = location.state?.cartLineId;
      const linesForProduct = cartItems.filter((item) => String(item.productId || item.id || item._id) === productId);
      const sourceLine = fromCartLineId
        ? linesForProduct.find((item) => cartLineId(item) === fromCartLineId || item.lineId === fromCartLineId)
        : (linesForProduct.length === 1 ? linesForProduct[0] : null);

      if (sourceLine) {
        const res = await replaceCartLineVariant(sourceLine.lineId || cartLineId(sourceLine), itemToAdd);
        if (res?.success) {
          const newLineId = cartLineId({
            productId,
            variantSku: itemToAdd.variantSku,
            selectedAttributes: itemToAdd.selectedAttributes,
          });
          await updateQuantity(newLineId, 0, desiredQty);
          navigate('/checkout');
        }
        return;
      }

      const res = await addToCart(itemToAdd, desiredQty, { isBuyNow: true, navigate, returnUrl: window.location.pathname });
      if (res && res.success) navigate('/checkout');
    } finally {
      buyNowLock.current = false;
    }
  };

  // When this exact variant is already in cart, seed the stepper from cart quantity
  React.useEffect(() => {
    if (!product) return;
    const productId = product.id || product._id;
    if (!productId || !lineSelection || !isInCart(productId, lineSelection)) return;
    const cartQty = getItemQuantity(productId, lineSelection);
    if (cartQty > 0) setQuantity(cartQty);
    // Re-seed only when product / selected line changes (not on every cart tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id, product?.id, selectedLineId]);

  const changeQuantity = (nextQty) => {
    const desired = Math.max(1, Number(nextQty) || 1);
    setQuantity(desired);
    // If this line is already in cart, update cart immediately so checkout matches the UI
    if (product && isInCart(product.id || product._id, lineSelection)) {
      updateQuantity(selectedLineId, 0, desired);
    }
  };

  const isFav = product && isInWishlist(product.id || product._id);

  if (loading) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col items-center justify-center max-w-[480px] mx-auto">
        <div className="w-9 h-9 border-3 border-orange-200 border-t-[#ff5500] rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 font-medium text-xs">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col items-center justify-center max-w-[480px] mx-auto px-6 text-center">
        <p className="text-slate-600 font-medium text-sm mb-4">{error || 'Product not found'}</p>
        <button 
          onClick={() => navigate(-1)} 
          className="px-5 py-2 bg-[#ff5500] text-white font-bold rounded-xl border-none cursor-pointer text-xs"
        >
          Go Back
        </button>
      </div>
    );
  }

  const currentPrice = matchedVariant ? Number(matchedVariant.price || 0) : Number(product.salePrice || product.price || 0);
  const originalPrice = matchedVariant ? Number(matchedVariant.originalPrice || matchedVariant.price || 0) : Number(product.mrp || product.originalPrice || 0);
  const hasDiscount = originalPrice > currentPrice;
  const discountCalc = hasDiscount ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;
  const savingsAmount = hasDiscount ? (originalPrice - currentPrice) : 0;
  const displayStock = getDisplayStock(product, matchedVariant);
  const totalProductStock = getEffectiveStock(product);
  const isOutOfStock = matchedVariant
    ? (matchedVariant.active === false || displayStock <= 0)
    : displayStock <= 0;

  return (
    <div className="min-h-[100dvh] md:min-h-screen bg-white font-sans text-slate-800 relative w-full max-w-[480px] md:max-w-7xl mx-auto shadow-[0_0_25px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col pb-24 md:pb-12 md:px-6 md:pt-4 overflow-x-hidden">
      
      {/* Desktop 2-Column Split Container */}
      <div className="md:grid md:grid-cols-12 md:gap-10 md:items-start w-full min-w-0 max-w-full">
        {/* Full-Cover Hero Product Image Canvas (Left Column) */}
        <div className="w-full relative overflow-hidden bg-slate-100 border-b md:border border-slate-100 md:col-span-6 lg:col-span-5 md:rounded-3xl md:sticky md:top-24">
        
        {/* Floating Top Header Controls */}
        <div className="absolute top-4 left-0 right-0 z-30 px-4 flex items-center justify-between pointer-events-none">
          <button 
            onClick={() => navigate(-1)}
            className="pointer-events-auto w-9 h-9 rounded-full bg-slate-900/40 hover:bg-slate-900/60 backdrop-blur-md text-white flex items-center justify-center border-none cursor-pointer shadow-md transition-all active:scale-95"
          >
            <ArrowLeft size={20} color="white" />
          </button>

          <div className="pointer-events-auto flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-slate-900/40 hover:bg-slate-900/60 backdrop-blur-md text-white flex items-center justify-center border-none cursor-pointer shadow-md transition-all active:scale-95"
            >
              <Share2 size={18} color="white" />
            </button>
            <button 
              onClick={handleWishlistClick}
              className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center border-none cursor-pointer shadow-md transition-all active:scale-95 ${
                isFav ? 'bg-white text-red-500' : 'bg-slate-900/40 hover:bg-slate-900/60 text-white'
              }`}
            >
              <Heart size={19} className={isFav ? "text-red-500 fill-red-500" : "text-white"} />
            </button>
          </div>
        </div>

        {/* Floating Express Delivery Badge */}
        <div className="absolute top-16 left-4 z-20 bg-white/90 backdrop-blur-md border border-emerald-200/80 text-emerald-700 font-medium text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <Clock size={12} className="text-emerald-600" /> 10-MIN EXPRESS DELIVERY
        </div>

        {/* Full Edge-to-Edge Image Container */}
        <div className="w-full h-[320px] sm:h-[360px] md:h-[420px] lg:h-[480px] relative overflow-hidden bg-white">
          <img
            src={getImageUrl(activeImage || product.mainImage || product.image || (Array.isArray(product.galleryImages) && product.galleryImages[0]), product.name)}
            alt={product.name}
            className="w-full h-full object-contain transition-transform duration-300"
            onError={(e) => handleImageError(e, product.name)}
          />
        </div>

        {/* Thumbnail Selector Row */}
        <div className="flex justify-center items-center gap-2 py-2.5 px-4 bg-white border-t border-slate-100">
          {[
            product.mainImage || product.image, 
            ...(product.galleryImages || [])
          ].filter(Boolean).filter((img, i, arr) => arr.indexOf(img) === i).slice(0, 5).map((imgUrl, idx) => {
            const isSelected = (activeImage || product.mainImage || product.image) === imgUrl;
            return (
              <button 
                key={idx}
                onClick={() => setActiveImage(imgUrl)}
                className={`w-12 h-12 rounded-lg bg-slate-50 border cursor-pointer p-0.5 overflow-hidden flex items-center justify-center transition-all ${
                  isSelected 
                    ? 'border-[#ff5500] ring-2 ring-[#ff5500]/20 shadow-xs scale-105' 
                    : 'border-slate-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img 
                  src={getImageUrl(imgUrl, product.name)} 
                  alt={`Thumbnail ${idx+1}`} 
                  className="w-full h-full object-contain"
                  onError={(e) => handleImageError(e, product.name)}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Product Info Content (Right Column) */}
      <div className="px-4 py-4 md:px-0 md:py-0 flex flex-col gap-3 md:gap-4 md:col-span-6 lg:col-span-7 min-w-0 w-full max-w-full overflow-hidden">

        {/* Title & Rating Header */}
        <div className="flex items-start justify-between gap-3 min-w-0 w-full">
          <div className="space-y-1 min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold text-slate-800 m-0 leading-snug break-words break-all [overflow-wrap:anywhere]">
              {product.name}
            </h1>
            <p className="text-[11px] font-medium text-slate-500 m-0 truncate">
              by:- <span className="font-bold text-slate-700">{product.seller || 'Fashion Hub'}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md shrink-0">
            <span className="text-[11px] font-bold text-amber-800">
              {reviewsData?.averageRating ? reviewsData.averageRating.toFixed(1) : (product.ratingAverage ? Number(product.ratingAverage).toFixed(1) : '4.8')}
            </span>
            <Star size={11} className="text-amber-500 fill-amber-500" />
            <span className="text-[10px] text-amber-600 font-medium">
              ({reviewsData?.totalRatings !== undefined ? reviewsData.totalRatings : (product.ratingCount || 0)})
            </span>
          </div>
        </div>

        {/* Pricing Block */}
        <div className="flex flex-col gap-1 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
          <div className="flex items-baseline gap-2">
            <span className="text-[20px] font-bold text-slate-800 leading-none">
              ₹{currentPrice}
            </span>
            {hasDiscount && (
              <>
                <span className="text-[13px] font-normal text-slate-400 line-through">
                  ₹{originalPrice}
                </span>
                <span className="bg-[#ff5500] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider">
                  {discountCalc}% OFF
                </span>
              </>
            )}
          </div>

          {hasDiscount && (
            <span className="text-[11px] font-medium text-emerald-600">
              Save ₹{savingsAmount} on this pack
            </span>
          )}
          <span className="text-[10px] text-slate-400">Inclusive of all taxes</span>
        </div>

        {/* Dynamic Product Variant Attribute Selectors */}
        {product.hasVariants && Array.isArray(product.variantOptions) && product.variantOptions.length > 0 && (
          <div className="flex flex-col gap-3 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 my-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5500]"></span>
                Available Options:
              </span>
              {matchedVariant && (
                <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {matchedVariant.title}
                </span>
              )}
            </div>

            {product.variantOptions.map((opt, oIdx) => {
              const optKey = String(opt.name || '').trim();
              const currentVal = String(selectedAttributes[optKey] ?? '').trim();
              return (
              <div key={`${optKey || 'opt'}-${oIdx}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{opt.name}:</span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      currentVal ? 'text-[#ff5500]' : 'text-slate-400'
                    }`}
                  >
                    {currentVal || 'Select'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {opt.values && opt.values.map((val, vIdx) => {
                    const optionVal = String(val ?? '').trim();
                    const isSelected = currentVal !== '' && currentVal === optionVal;
                    return (
                      <button
                        key={`${optKey}-${optionVal}-${vIdx}`}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectAttribute(opt.name, val)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-sm ring-2 ring-[#ff5500]/25'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                        }`}
                      >
                        {optionVal}
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })}

            {/* Stock Availability indicator for selected variant */}
            <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Availability:</span>
              {isOutOfStock ? (
                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Out of Stock
                </span>
              ) : (
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  In Stock ({displayStock} left)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Desktop Inlined Action Box */}
        <div className="hidden md:flex flex-col gap-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl my-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1">
              <button 
                onClick={() => changeQuantity(quantity - 1)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium flex items-center justify-center cursor-pointer border-none active:scale-95 transition-transform"
              >
                <Minus size={15} />
              </button>
              <span className="w-10 text-center text-sm font-bold text-slate-900">{quantity}</span>
              <button 
                onClick={() => changeQuantity(quantity + 1)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium flex items-center justify-center cursor-pointer border-none active:scale-95 transition-transform"
              >
                <Plus size={15} />
              </button>
            </div>

            <div className="flex-1 flex items-center gap-3">
              {isOutOfStock ? (
                <button 
                  disabled
                  className="flex-1 h-12 bg-slate-200 text-slate-400 rounded-xl text-sm font-bold cursor-not-allowed border-none flex items-center justify-center gap-2"
                >
                  <span>Out of Stock</span>
                </button>
              ) : (
                <>
                  {product && !isInCart(product.id || product._id, lineSelection) ? (
                    <button 
                      onClick={handleAddToCart}
                      className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold cursor-pointer border-none flex items-center justify-center gap-2 whitespace-nowrap active:scale-98 transition-all shadow-md"
                    >
                      <ShoppingCart size={18} className="shrink-0" />
                      <span>Add to Cart</span>
                    </button>
                  ) : (
                    <button 
                      onClick={async () => {
                        if (product) {
                          await removeFromCart(selectedLineId);
                          setToastMessage('Item removed from cart');
                          setTimeout(() => setToastMessage(''), 2000);
                        }
                      }}
                      className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold cursor-pointer border-none flex items-center justify-center gap-2 whitespace-nowrap active:scale-98 transition-all shadow-md"
                    >
                      <Trash2 size={16} className="shrink-0" />
                      <span>Remove from Cart</span>
                    </button>
                  )}

                  <button
                    onClick={handleBuyNow}
                    className="flex-1 h-12 bg-[#ff5500] hover:bg-[#e04a00] text-white rounded-xl text-sm font-bold cursor-pointer border-none flex items-center justify-center gap-2 whitespace-nowrap active:scale-98 transition-all shadow-md"
                  >
                    <span>Buy Now</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 pt-1">
            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-600" /> Free Returns</span>
            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-600" /> 10-Min Fast Delivery</span>
            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-600" /> 100% Genuine</span>
          </div>
        </div>

        {/* Seamless Divider */}
        <hr className="border-slate-100 my-1 w-full" />

        {/* Product Overview & Description */}
        <div className="w-full min-w-0 overflow-hidden">
          <h3 className="text-[13px] font-semibold text-slate-800 mb-1.5">Product Description</h3>
          {product.description ? (
            <DescriptionText
              text={product.description}
              expanded={descriptionExpanded}
              onToggle={() => setDescriptionExpanded((open) => !open)}
            />
          ) : (
            <div className="flex flex-col gap-1.5 text-[12px] text-slate-600 font-normal">
              <p className="m-0">🌾 Freshly milled and processed under hygienic standards.</p>
              <p className="m-0">🧼 100% natural, free from harmful additives and preservatives.</p>
              <p className="m-0">📦 Sealed in high-grade moisture-proof packaging for maximum freshness.</p>
            </div>
          )}
        </div>

        {/* Expandable Accordions */}
        <div className="flex flex-col border-t border-slate-100 mt-1">
          
          <div className="border-b border-slate-100 py-2.5">
            <div 
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleAccordion('product')}
            >
              <span className="text-[13px] font-medium text-slate-700">Product Specifications</span>
              {activeAccordion === 'product' ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            </div>
            {activeAccordion === 'product' && (
              <div className="pt-2 text-[12px] text-slate-600 grid grid-cols-2 gap-2 font-normal">
                <div><span className="text-slate-400">Brand:</span> <strong>{product.brand || product.seller || 'Sathi Seller'}</strong></div>
                <div><span className="text-slate-400">Category:</span> <strong>{product.category || 'Grocery'}</strong></div>
                <div><span className="text-slate-400">Sub-Category:</span> <strong>{product.subCategory || 'Staples'}</strong></div>
                <div>
                  <span className="text-slate-400">Stock:</span>{' '}
                  <strong className={totalProductStock > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {totalProductStock > 0 ? `Available (${totalProductStock})` : 'Out of Stock'}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div className="border-b border-slate-100 py-2.5">
            <div 
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleAccordion('policy')}
            >
              <span className="text-[13px] font-medium text-slate-700 flex items-center gap-1.5">
                Return & Refund Policy
                {product.isReturnable === false && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Non-Returnable
                  </span>
                )}
              </span>
              {activeAccordion === 'policy' ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            </div>
            {activeAccordion === 'policy' && (
              <div className="pt-2 text-[12px] text-slate-600 space-y-1 font-normal">
                {product.isReturnable === false ? (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px]">
                    🚫 <strong>Non-Returnable Item:</strong> This product cannot be returned or replaced once delivered due to hygiene, freshness, or perishable nature.
                  </div>
                ) : (
                  <p className="m-0 text-emerald-700 font-medium">
                    🛡️ {product.returnPolicy || `${product.returnWindow || 7}-Day Replacement Guarantee for damaged, missing, or incorrect items.`}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Ratings & Customer Reviews Section */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 m-0">Ratings & Reviews</h3>
              <p className="text-[11px] text-slate-400 m-0">Verified customer feedback</p>
            </div>
            {reviewsData && reviewsData.totalRatings > 0 && (
              <span className="text-xs font-bold text-[#ff5500] bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60">
                {reviewsData.totalRatings} {reviewsData.totalRatings === 1 ? 'Review' : 'Reviews'}
              </span>
            )}
          </div>

          {/* Overall Rating & Breakdown Score Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
            <div className="flex flex-col items-center justify-center pr-3 border-r border-slate-200/70 shrink-0 min-w-[75px]">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {reviewsData?.averageRating ? reviewsData.averageRating.toFixed(1) : (product.ratingAverage ? Number(product.ratingAverage).toFixed(1) : '4.8')}
              </span>
              <div className="flex items-center gap-0.5 my-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={11}
                    className={
                      s <= Math.round(reviewsData?.averageRating || product.ratingAverage || 4.8)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-slate-200 text-slate-200'
                    }
                  />
                ))}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {reviewsData?.totalRatings !== undefined ? reviewsData.totalRatings : (product.ratingCount || 0)} Ratings
              </span>
            </div>

            {/* Distribution Progress Bars */}
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviewsData?.breakdown?.[stars] || 0;
                const total = reviewsData?.totalRatings || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={stars} className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold text-slate-600 w-3 text-right">{stars}★</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-slate-400 font-medium w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Reviews List */}
          {reviewsData && reviewsData.reviews && reviewsData.reviews.length > 0 ? (
            <div className="space-y-2.5 mt-1">
              {reviewsData.reviews.slice(0, 5).map((rev, rIdx) => (
                <div key={rIdx} className="p-3 rounded-xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-orange-100 text-[#ff5500] font-bold text-[10px] flex items-center justify-center">
                        {(rev.user?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{rev.user?.name || 'Verified Customer'}</span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-medium">{rev.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={11}
                          className={s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
                        />
                      ))}
                    </div>
                    {rev.isVerifiedPurchase && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70 flex items-center gap-0.5">
                        <Check size={10} strokeWidth={3} /> Verified Purchase
                      </span>
                    )}
                  </div>

                  {rev.review && (
                    <p className="text-xs text-slate-600 m-0 leading-relaxed font-normal break-words break-all [overflow-wrap:anywhere]">{rev.review}</p>
                  )}

                  {rev.feedbackTags && rev.feedbackTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {rev.feedbackTags.map((t, tIdx) => (
                        <span key={tIdx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {rev.images && rev.images.length > 0 && (
                    <div className="flex gap-1.5 pt-1 overflow-x-auto">
                      {rev.images.map((imgUrl, iIdx) => (
                        <a key={iIdx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img
                            src={imgUrl}
                            alt={`Review photo ${iIdx + 1}`}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 px-3 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 m-0">No customer reviews yet. Be the first to review after purchasing!</p>
            </div>
          )}
        </div>

        {/* Similar Items Carousel */}
        {similarProducts.length > 0 && (
        <div className="pt-1 w-full min-w-0 overflow-hidden">
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[13px] font-semibold text-slate-800 m-0">Similar Products</h3>
            <button 
              onClick={() => navigate(product?.category ? `/categories?category=${encodeURIComponent(product.category)}` : '/categories')} 
              className="text-[#ff5500] text-[12px] font-medium bg-transparent border-none cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-4 pb-2 w-full hide-scrollbar">
            {similarProducts.map((item) => {
              const qty = getItemQuantity(item.id || item._id);
              return (
                <div 
                  key={item.id}
                  onClick={() => navigate(`/product/${item.id}`)}
                  className="min-w-[135px] w-[135px] md:min-w-0 md:w-full bg-white rounded-xl border border-slate-100 p-2.5 flex flex-col justify-between cursor-pointer shrink-0 md:shrink hover:shadow-md transition-shadow"
                >
                  <div className="bg-slate-50 rounded-lg h-[90px] w-full flex items-center justify-center p-2 mb-2">
                    <img 
                      src={getImageUrl(item.image, item.name)} 
                      alt={item.name} 
                      className="max-h-full max-w-full object-contain mix-blend-multiply" 
                      onError={(e) => handleImageError(e, item.name)}
                    />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-medium text-slate-800 m-0 truncate">{item.name}</h4>
                    <p className="text-[10px] text-slate-400 m-0 mb-1 truncate">{item.brand}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[12px] font-bold text-slate-800">₹{item.price}</span>
                      {qty === 0 ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                            setToastMessage('Item added to cart! 🛒');
                            setTimeout(() => setToastMessage(''), 2000);
                          }}
                          className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center border-none cursor-pointer shadow-2xs active:scale-90 transition-transform shrink-0"
                          aria-label="Add to cart"
                        >
                          <Plus size={13} strokeWidth={3} />
                        </button>
                      ) : (
                        <div 
                          onClick={(e) => e.stopPropagation()} 
                          className="bg-emerald-600 text-white rounded-md p-0.5 flex items-center justify-between shadow-2xs border-none shrink-0"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(item.id || item._id, -1);
                            }}
                            className="w-5 h-5 rounded bg-emerald-700/80 hover:bg-emerald-700 text-white font-bold flex items-center justify-center cursor-pointer border-none active:scale-90 transition-transform"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <span className="px-1 text-[10px] font-black text-white min-w-[12px] text-center">
                            {qty}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(item.id || item._id, 1);
                            }}
                            className="w-5 h-5 rounded bg-emerald-700/80 hover:bg-emerald-700 text-white font-bold flex items-center justify-center cursor-pointer border-none active:scale-90 transition-transform"
                            aria-label="Increase quantity"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

      </div>
      </div>

      {/* 4. Sticky Bottom Action Bar (Mobile Only) */}
      <div className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-slate-200/80 px-3 py-2.5 flex items-center justify-between gap-2.5 z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        
        {/* Quantity Stepper */}
        <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200/80 p-0.5 shrink-0 h-11">
          <button 
            onClick={() => changeQuantity(quantity - 1)}
            className="w-8 h-full rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-center cursor-pointer border-none active:scale-95 transition-transform shadow-2xs"
          >
            <Minus size={14} />
          </button>
          <span className="w-8 text-center text-xs font-bold text-slate-800">{quantity}</span>
          <button 
            onClick={() => changeQuantity(quantity + 1)}
            className="w-8 h-full rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-center cursor-pointer border-none active:scale-95 transition-transform shadow-2xs"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {isOutOfStock ? (
            <button 
              disabled
              className="flex-1 h-11 bg-slate-200 text-slate-400 rounded-xl text-xs sm:text-[13px] font-bold cursor-not-allowed border-none flex items-center justify-center gap-1.5"
            >
              <span>Out of Stock</span>
            </button>
          ) : (
            <>
              {product && !isInCart(product.id || product._id, lineSelection) ? (
                <button 
                  onClick={handleAddToCart}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-[13px] font-bold cursor-pointer border-none flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 active:scale-98 transition-all shadow-xs"
                >
                  <ShoppingCart size={16} className="shrink-0" />
                  <span>Add to Cart</span>
                </button>
              ) : (
                <button 
                  onClick={async () => {
                    if (product) {
                      await removeFromCart(selectedLineId);
                      setToastMessage('Item removed from cart');
                      setTimeout(() => setToastMessage(''), 2000);
                    }
                  }}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-[13px] font-bold cursor-pointer border-none flex items-center justify-center gap-1.5 whitespace-nowrap px-2 active:scale-98 transition-all shadow-xs"
                >
                  <Trash2 size={15} className="shrink-0" />
                  <span>Remove</span>
                </button>
              )}

              <button 
                onClick={handleBuyNow}
                className="flex-1 h-11 bg-[#ff5500] hover:bg-[#e04a00] text-white rounded-xl text-xs sm:text-[13px] font-bold cursor-pointer border-none flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 active:scale-98 transition-all shadow-xs"
              >
                <span>Buy Now</span>
              </button>
            </>
          )}
        </div>

      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-[12px] font-medium shadow-lg z-[100] whitespace-nowrap">
          {toastMessage}
        </div>
      )}

    </div>
  );
};

export default ProductDetails;

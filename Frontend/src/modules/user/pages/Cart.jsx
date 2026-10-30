import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus, Tag, ShoppingCart, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';
import { cartLineId, variantLabel } from '../../../utils/variantLabel';
import commissionService from '../../../services/commissionService';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, cartTotal, originalTotal } = useCart();

  const [deliverySettings, setDeliverySettings] = useState({
    deliveryCharge: 40,
    freeDeliveryMinOrder: 500,
    isFreeDeliveryEnabled: true,
  });

  useEffect(() => {
    let isMounted = true;
    commissionService.getCurrentRates(true).then((res) => {
      if (isMounted && res && res.success) {
        setDeliverySettings({
          deliveryCharge: Number(res.deliveryCharge !== undefined ? res.deliveryCharge : 40),
          freeDeliveryMinOrder: Number(res.freeDeliveryMinOrder !== undefined ? res.freeDeliveryMinOrder : 500),
          isFreeDeliveryEnabled: res.isFreeDeliveryEnabled !== undefined ? Boolean(res.isFreeDeliveryEnabled) : true,
        });
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);
  
  const safeCartTotal = Number(cartTotal || 0);
  const safeOriginalTotal = Number(originalTotal || 0);
  
  const isFreeDelivery = safeCartTotal === 0 || (deliverySettings.isFreeDeliveryEnabled && safeCartTotal >= deliverySettings.freeDeliveryMinOrder);
  const deliveryCharge = isFreeDelivery ? 0 : deliverySettings.deliveryCharge;
  const youSaved = Math.max(0, safeOriginalTotal - safeCartTotal);
  const grandTotal = safeCartTotal + deliveryCharge;
  const amountNeededForFreeDelivery = deliverySettings.isFreeDeliveryEnabled && safeCartTotal > 0 && safeCartTotal < deliverySettings.freeDeliveryMinOrder
    ? deliverySettings.freeDeliveryMinOrder - safeCartTotal
    : 0;

  return (
    <div className="w-full max-w-[480px] md:max-w-7xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-slate-50 font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-8">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center gap-3 py-3 px-5 bg-gradient-to-r from-[#ea580c] to-[#f97316] rounded-b-[20px] shadow-sm z-10 relative mb-2">
        <ArrowLeft size={22} color="white" className="cursor-pointer" onClick={() => navigate(-1)} />
        <h2 className="text-[20px] font-semibold m-0 text-white">Cart</h2>
      </header>

      {/* Desktop Breadcrumbs & Title */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Shopping Cart</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Review your items and proceed to checkout</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-xs font-bold text-[#ff5500] hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
        >
          ← Continue Shopping
        </button>
      </div>

      <div className="flex-1 overflow-y-auto md:overflow-visible px-5 md:px-0 py-4 md:py-0 [&::-webkit-scrollbar]:hidden">
        {cartItems.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 flex flex-col items-center justify-center shadow-xs max-w-md mx-auto my-8">
            <div className="w-20 h-20 bg-orange-50 text-[#ff5500] rounded-full flex items-center justify-center mb-4">
              <ShoppingCart size={36} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 m-0 mb-1">Your cart is empty</h3>
            <p className="text-xs text-slate-400 m-0 text-center max-w-xs">Looks like you haven't added anything to your cart yet.</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-6 bg-[#ff5500] hover:bg-[#e04a00] text-white border-none rounded-xl px-8 py-3 text-xs font-black cursor-pointer transition-all shadow-md active:scale-[0.98]"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          /* Desktop 2-Column Grid */
          <div className="md:grid md:grid-cols-12 md:gap-8 md:items-start">
            
            {/* Left Column: Cart Items & Coupon */}
            <div className="md:col-span-7 lg:col-span-8 space-y-4">
              <div className="flex flex-col gap-3">
                {cartItems.map((item) => {
                  const itemId = item.lineId || item.productId || item.id || item._id;
                  const productLinkId = item.productId || item.sku || item.id || item._id;
                  const optionLabel = variantLabel(item);
                  const itemPrice = Number(item.price ?? item.salePrice ?? 0);
                  const openProduct = () => {
                    if (!productLinkId) return;
                    navigate(`/product/${productLinkId}`, {
                      state: { cartLineId: item.lineId || cartLineId(item) },
                    });
                  };

                  return (
                    <div key={itemId} className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 flex gap-4 shadow-xs hover:shadow-md transition-shadow">
                      <button
                        type="button"
                        onClick={openProduct}
                        className="w-[70px] h-[80px] md:w-[90px] md:h-[100px] flex justify-center items-center overflow-hidden rounded-xl bg-slate-50 shrink-0 border-none p-0 cursor-pointer"
                      >
                        <img 
                          src={getImageUrl(item.image || item.mainImage, item.name)} 
                          alt={item.name} 
                          className="max-w-full max-h-full object-contain mix-blend-multiply" 
                          onError={(e) => handleImageError(e, item.name)}
                        />
                      </button>
                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <button
                            type="button"
                            onClick={openProduct}
                            className="text-[13px] md:text-sm font-bold text-slate-800 m-0 mb-1 truncate text-left bg-transparent border-none p-0 cursor-pointer hover:text-[#ff5500]"
                          >
                            {item.name}
                          </button>
                          <button onClick={() => removeFromCart(itemId)} className="bg-transparent border-none cursor-pointer p-1 text-slate-300 hover:text-red-500 transition-colors" title="Remove item">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 m-0 mb-3">{optionLabel || item.unit || '1 Pack'}</p>
                        <div className="flex justify-between items-center mt-auto">
                          <span className="text-[15px] md:text-base font-extrabold text-slate-900">₹{itemPrice.toFixed(2)}</span>
                          <div className="flex items-center gap-3 border border-slate-200 rounded-xl py-1 px-2.5 bg-slate-50">
                            <button onClick={() => updateQuantity(itemId, -1)} className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0.5 text-slate-600 hover:text-slate-900 active:scale-90"><Minus size={13} /></button>
                            <span className="text-[13px] font-black text-slate-900 min-w-[14px] text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(itemId, 1)} className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0.5 text-slate-600 hover:text-slate-900 active:scale-90"><Plus size={13} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Apply Coupon */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#ff5500] flex items-center justify-center">
                    <Tag size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Apply Coupon Code</span>
                    <span className="text-[10px] text-slate-400">Save extra with discount coupons</span>
                  </div>
                </div>
                <button className="bg-transparent border-none text-[#ff5500] hover:text-[#e04a00] text-xs font-extrabold cursor-pointer">Apply</button>
              </div>
            </div>

            {/* Right Column: Order Summary (Desktop Sidebar) */}
            <div className="md:col-span-5 lg:col-span-4 md:sticky md:top-24 mt-4 md:mt-0 space-y-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-3.5">
                <h3 className="text-sm font-black text-slate-900 m-0 pb-2 border-b border-slate-100">Bill Details</h3>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Item Total ({cartItems.length} items)</span>
                  <span className="font-bold text-slate-700">₹{safeCartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Delivery Charges</span>
                  <div className="flex items-center gap-1.5">
                    {deliveryCharge === 0 ? (
                      <>
                        {deliverySettings.deliveryCharge > 0 && (
                          <span className="text-[11px] text-slate-400 line-through">₹{deliverySettings.deliveryCharge.toFixed(2)}</span>
                        )}
                        <span className="text-xs font-bold text-emerald-600">FREE</span>
                      </>
                    ) : (
                      <span className="font-bold text-slate-700">₹{deliveryCharge.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {amountNeededForFreeDelivery > 0 && (
                  <div className="bg-orange-50 border border-orange-200/70 rounded-xl p-2.5 text-[11px] text-orange-800 flex items-center gap-1.5 font-bold">
                    <Sparkles size={14} className="text-[#ff5500] shrink-0" />
                    <span>Add ₹{amountNeededForFreeDelivery.toFixed(2)} more to get <strong>FREE Delivery</strong>!</span>
                  </div>
                )}
                
                {youSaved > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">You Saved</span>
                    <span className="font-bold text-emerald-600">- ₹{youSaved.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-slate-200">
                  <span className="text-sm font-black text-slate-900">Grand Total</span>
                  <span className="text-lg font-black text-slate-900">₹{grandTotal.toFixed(2)}</span>
                </div>

                {/* Desktop Checkout Button */}
                <div className="hidden md:block pt-2">
                  <button 
                    className="w-full bg-[#ff5500] hover:bg-[#e04a00] text-white border-none rounded-xl p-3.5 text-sm font-black cursor-pointer shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]" 
                    onClick={() => {
                      const token = localStorage.getItem('sathiseller_user_token');
                      if (!token) {
                        localStorage.setItem('sathiseller_pending_action', JSON.stringify({ type: 'CHECKOUT', returnUrl: '/checkout' }));
                        navigate('/login');
                      } else {
                        navigate('/checkout');
                      }
                    }}
                  >
                    Proceed to Checkout • ₹{grandTotal.toFixed(2)}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium">
                  <span>🔒 256-Bit Secure</span>
                  <span>⚡ 10-Min Delivery</span>
                </div>
              </div>
            </div>

          </div>
        )}
        
        {/* Padding for fixed buttons at bottom (Mobile only) */}
        <div className="h-[100px] md:hidden"></div>
      </div>

      {/* Mobile Checkout Button */}
      {cartItems.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-5 bg-gradient-to-t from-white via-white/90 to-transparent z-[90]">
          <button 
            className="w-full bg-[#ff5500] text-white border-none rounded-xl p-4 text-[15px] font-bold cursor-pointer shadow-[0_4px_12px_rgba(255,85,0,0.2)] transition-transform duration-200 active:scale-[0.98]" 
            onClick={() => {
              const token = localStorage.getItem('sathiseller_user_token');
              if (!token) {
                localStorage.setItem('sathiseller_pending_action', JSON.stringify({ type: 'CHECKOUT', returnUrl: '/checkout' }));
                navigate('/login');
              } else {
                navigate('/checkout');
              }
            }}
          >
            Proceed to Checkout • ₹{grandTotal.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
};

export default Cart;

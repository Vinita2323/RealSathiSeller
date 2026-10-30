import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Building2, Wallet, Banknote, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOrder } from '../context/OrderContext';

const Payment = () => {
  const navigate = useNavigate();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');
  
  const { cartItems, cartTotal, clearCart } = useCart();
  const { addOrder } = useOrder();

  const handlePay = () => {
    // Generate an Order ID
    const newOrderId = `SHX${Math.floor(Math.random() * 10000000000)}`;
    setPlacedOrderId(newOrderId);
    
    // Create the order object
    const newOrder = {
      id: newOrderId,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Processing',
      items: cartItems.length > 0 ? cartItems : [{ id: 1, name: 'Premium Basmati', image: 'https://api.dicebear.com/7.x/icons/svg?seed=Rice', price: 490, quantity: 1 }],
      total: cartTotal > 0 ? cartTotal : 490,
      itemCount: cartItems.length > 0 ? cartItems.length : 1
    };

    // Add to context and clear cart
    addOrder(newOrder);
    clearCart();
    
    // Show Modal
    setShowSuccessModal(true);
  };

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-slate-50 font-sans text-slate-800 relative max-w-[480px] md:max-w-3xl mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col md:py-8 md:px-6 overflow-hidden md:overflow-visible">
      {/* Mobile Header */}
      <header className="flex md:hidden justify-between items-center py-4 px-5 bg-white">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} color="#1e293b" />
        </button>
        <h2 className="text-[16px] font-bold m-0 text-slate-900 text-center">Payment</h2>
        <div className="w-5"></div>
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate(-1)} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Back
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Payment</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Payment Options</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-0 py-4 md:py-0 flex flex-col gap-6 [&::-webkit-scrollbar]:hidden md:overflow-visible">
        
        {/* UPI Section */}
        <div>
          <h3 className="text-[13px] font-extrabold text-slate-800 m-0 mb-3 uppercase tracking-wide">UPI</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[18px]">G</div>
              <span className="text-[10px] font-bold text-slate-600 text-center">Google Pay</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-[18px]">P</div>
              <span className="text-[10px] font-bold text-slate-600 text-center">PhonePe</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 font-bold text-[12px]">Paytm</div>
              <span className="text-[10px] font-bold text-slate-600 text-center">Paytm</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-[12px]">BHIM</div>
              <span className="text-[10px] font-bold text-slate-600 text-center">BHIM UPI</span>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div>
          <h3 className="text-[13px] font-extrabold text-slate-800 m-0 mb-3 uppercase tracking-wide">Cards</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 flex items-center justify-center text-blue-800 font-extrabold italic text-[16px]">VISA</div>
              <span className="text-[10px] font-bold text-slate-600 text-center">Visa</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 flex items-center justify-center relative">
                <div className="w-5 h-5 rounded-full bg-red-500 absolute left-1 mix-blend-multiply"></div>
                <div className="w-5 h-5 rounded-full bg-yellow-400 absolute right-1 mix-blend-multiply"></div>
              </div>
              <span className="text-[10px] font-bold text-slate-600 text-center">Mastercard</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 flex items-center justify-center text-blue-600 font-extrabold italic text-[14px]">RuPay</div>
              <span className="text-[10px] font-bold text-slate-600 text-center">RuPay</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center">
                <Plus size={16} color="#64748b" />
              </div>
              <span className="text-[10px] font-bold text-slate-600 text-center">Add Card</span>
            </div>
          </div>
        </div>

        {/* Other Options Section */}
        <div>
          <h3 className="text-[13px] font-extrabold text-slate-800 m-0 mb-3 uppercase tracking-wide">Other Options</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                <Building2 size={20} color="#475569" />
              </div>
              <span className="text-[11px] font-bold text-slate-600 text-center">Net Banking</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                <Wallet size={20} color="#475569" />
              </div>
              <span className="text-[11px] font-bold text-slate-600 text-center">Wallets</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                <Banknote size={20} color="#475569" />
              </div>
              <span className="text-[11px] font-bold text-slate-600 text-center">Cash on Delivery</span>
            </div>
          </div>
        </div>
        
        <div className="h-[100px]"></div>
      </div>

      {/* Payment Action Button Sticky Footer */}
      <div className="absolute bottom-0 left-0 w-full py-4 px-5 pb-6 bg-white border-t border-slate-100 z-[90] flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium text-slate-500">Total Payable</span>
          <span className="text-[18px] font-extrabold text-slate-900">₹490.00</span>
        </div>
        <button 
          className="bg-[#ff5500] text-white border-none rounded-xl py-3.5 px-8 text-[15px] font-bold cursor-pointer shadow-[0_4px_12px_rgba(255,85,0,0.2)] transition-transform duration-200 active:scale-[0.98]"
          onClick={handlePay}
        >
          Pay ₹{cartTotal > 0 ? cartTotal : 490}.00
        </button>
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && (
        <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center px-5 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
          <div className="flex flex-col items-center justify-center w-full max-w-[400px]">
            {/* Checkmark Circle with Confetti-like dots */}
            <div className="relative mb-5 animate-[bounceIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)]">
              <div className="w-20 h-20 bg-[#22c55e] rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(34,197,94,0.3)]">
                <Check size={40} color="white" strokeWidth={3.5} />
              </div>
              {/* Decorative dots to simulate confetti */}
              <div className="absolute top-1 right-[-12px] w-2 h-2 rounded-full bg-yellow-400 rotate-12"></div>
              <div className="absolute top-[-8px] left-[12px] w-1.5 h-1.5 rounded-full bg-blue-400 -rotate-12"></div>
              <div className="absolute bottom-[8px] left-[-16px] w-2.5 h-2.5 rounded-full bg-[#ff5500] rotate-45"></div>
              <div className="absolute bottom-[-8px] right-[-4px] w-1.5 h-1.5 rounded-full bg-red-400 rotate-12"></div>
              <div className="absolute top-6 left-[-20px] w-1 h-3 bg-purple-400 rounded-full rotate-45"></div>
              <div className="absolute top-[40px] right-[-24px] w-1 h-3 bg-teal-400 rounded-full -rotate-45"></div>
            </div>
            
            <h2 className="text-[20px] font-extrabold text-slate-900 mb-1 text-center">Thank You, Rahul! 🎉</h2>
            <p className="text-[12px] font-medium text-slate-500 mb-6 text-center">Your order has been placed successfully.</p>
            
            <div className="w-full bg-white border border-slate-100 rounded-[16px] p-4 mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <div className="flex flex-col gap-0.5 mb-4 pb-4 border-b border-dashed border-slate-200">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Order ID</span>
                <span className="text-[14px] font-bold text-slate-800">{placedOrderId}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estimated Delivery</span>
                <span className="text-[14px] font-bold text-slate-800">
                  {(() => {
                    const d = new Date();
                    // Express / same-day window after successful pay
                    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                  })()}
                </span>
                <span className="text-[12px] font-semibold text-slate-700">Express (Within 30 Mins)</span>
              </div>
            </div>
            
            <button 
              className="w-full bg-[#0f172a] text-white border-none rounded-[12px] py-3.5 px-5 text-[14px] font-bold cursor-pointer shadow-[0_4px_12px_rgba(15,23,42,0.15)] mb-3 transition-transform duration-200 active:scale-[0.98]"
              onClick={() => navigate('/track-order')}
            >
              Track Order
            </button>
            <button 
              className="bg-transparent border-none text-blue-600 text-[13px] font-semibold cursor-pointer py-2 hover:text-blue-700 transition-colors"
              onClick={() => navigate('/')}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payment;

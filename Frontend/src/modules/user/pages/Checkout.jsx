import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Check, Plus, ChevronRight, X, Loader2, Banknote,
  CreditCard, Wallet, Building2, ShieldCheck, Smartphone
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLocationContext } from '../../../context/LocationContext';
import { addressService, orderService, walletService } from '../../../services/authService';
import commissionService from '../../../services/commissionService';
import { variantLabel, toSelectedVariants, missingVariantOptions } from '../../../utils/variantLabel';

/** Build delivery slots from the current clock — no hard-coded "Tomorrow" default. */
const buildAvailableSlots = (now = new Date()) => {
  const hour = now.getHours();
  const slots = [
    { id: 's1', date: 'Today', time: 'Express (Within 30 Mins)', badge: 'Fastest' },
  ];

  // Afternoon window still bookable before 4 PM
  if (hour < 16) {
    slots.push({ id: 's2', date: 'Today', time: '05:00 PM - 07:00 PM' });
  }
  // Evening window still bookable before 6 PM
  if (hour < 18) {
    slots.push({ id: 's3', date: 'Today', time: '07:00 PM - 09:00 PM' });
  }

  slots.push(
    { id: 's4', date: 'Tomorrow', time: '10:00 AM - 12:00 PM' },
    { id: 's5', date: 'Tomorrow', time: '04:00 PM - 06:00 PM' },
  );

  // Prefer first Today slot (Express / next available), not a static Tomorrow row
  slots[0] = { ...slots[0], isDefault: true };
  return slots;
};

const availableSlots = buildAvailableSlots();

// Available Payment Options
const paymentMethods = [
  { id: 'COD', name: 'Cash on Delivery', icon: Banknote, description: 'Pay cash upon delivery' },
  { id: 'UPI', name: 'UPI (GPay / PhonePe / Paytm)', icon: Smartphone, description: 'Instant UPI payment' },
  { id: 'CARD', name: 'Credit / Debit Card', icon: CreditCard, description: 'Visa, Mastercard, RuPay' },
  { id: 'NETBANKING', name: 'Net Banking', icon: Building2, description: 'All major banks supported' },
  { id: 'WALLET', name: 'Sathi Seller Wallet', icon: Wallet, description: 'Pay instantly from your wallet balance' },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, originalTotal, cartCount, clearCart, fetchCart } = useCart();
  const { currentLocation } = useLocationContext();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(
    () => availableSlots.find((s) => s.isDefault) || availableSlots[0]
  );
  const [selectedPayment, setSelectedPayment] = useState('COD');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Modals & States
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [isNewAddressModalOpen, setIsNewAddressModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [walletBalance, setWalletBalance] = useState(null);

  // Profile Form State for incomplete profiles
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  // New Address Form State
  const [newAddrForm, setNewAddrForm] = useState({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    addressType: 'Home',
  });

  // Load addresses from backend / localStorage
  const loadAddresses = async () => {
    const currentName = localStorage.getItem('sathiseller_user_name') || '';
    const cleanCurrentName = currentName && currentName !== 'User' && currentName !== 'Customer' ? currentName : '';

    const normalizeAddress = (a) => {
      const isPlaceholder = !a.fullName || a.fullName === 'User' || a.fullName === 'Customer';
      return {
        ...a,
        fullName: isPlaceholder && cleanCurrentName ? cleanCurrentName : a.fullName || cleanCurrentName || 'Customer',
      };
    };

    let fetchedAddresses = [];
    let loadedFromServer = false;
    try {
      const res = await addressService.getAddresses();
      if (res && res.success && Array.isArray(res.addresses)) {
        fetchedAddresses = res.addresses.map(normalizeAddress);
        loadedFromServer = true;
        localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(fetchedAddresses));
        if (fetchedAddresses.length === 0) {
          localStorage.removeItem('sathiseller_selected_checkout_address');
        }
      }
    } catch (err) {
      console.error('Failed to fetch addresses from backend:', err);
    }

    if (!loadedFromServer && fetchedAddresses.length === 0) {
      const saved = localStorage.getItem('sathiseller_saved_addresses');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            fetchedAddresses = parsed.map(normalizeAddress);
          }
        } catch (err) {}
      }
    }

    if (fetchedAddresses.length > 0) {
      setAddresses(fetchedAddresses);

      // Check if there is an active selection in localStorage
      const savedSelStr = localStorage.getItem('sathiseller_selected_checkout_address');
      if (savedSelStr) {
        try {
          const parsedSel = JSON.parse(savedSelStr);
          const found = fetchedAddresses.find(
            (a) =>
              (a._id && parsedSel._id && String(a._id) === String(parsedSel._id)) ||
              (a.id && parsedSel.id && String(a.id) === String(parsedSel.id)) ||
              ((a.addressLine1 || a.address) === (parsedSel.addressLine1 || parsedSel.address) &&
                (a.pincode || a.zip) === (parsedSel.pincode || parsedSel.zip))
          );
          if (found) {
            setSelectedAddress(found);
            return;
          }
        } catch (e) {}
      }

      const def = fetchedAddresses.find((a) => a.isDefault) || fetchedAddresses[0];
      setSelectedAddress(def);
      localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(def));
    } else {
      setAddresses([]);
      setSelectedAddress(null);
    }
  };

  useEffect(() => {
    const userDataStr = localStorage.getItem('sathiseller_user_data');
    let name = localStorage.getItem('sathiseller_user_name') || '';
    let phone = localStorage.getItem('sathiseller_user_phone') || '';
    let email = localStorage.getItem('sathiseller_user_email') || '';

    if (userDataStr) {
      try {
        const u = JSON.parse(userDataStr);
        if (!name && u.name) name = u.name;
        if (!phone && u.phone) phone = u.phone;
        if (!email && u.email) email = u.email;
      } catch (e) {}
    }

    setUserName(name);
    setUserEmail(email);
    setUserPhone(phone);
    setProfileForm({
      fullName: name && name !== 'Customer' && name !== 'User' ? name : '',
      email: email || '',
      phone: phone || '',
    });
    setNewAddrForm((prev) => ({ ...prev, fullName: name, phone: phone }));

    // Check if profile is incomplete
    if (!name || name === 'Customer' || name === 'User' || name.trim() === '') {
      setIsProfileModalOpen(true);
    }

    loadAddresses();

    walletService.getUserWallet()
      .then((res) => {
        if (res?.success) {
          setWalletBalance(Number(res.wallet?.balance || 0));
        }
      })
      .catch(() => setWalletBalance(0));
  }, []);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!profileForm.fullName || profileForm.fullName.trim().length < 2) {
      setErrorMsg('Please enter a valid Full Name to complete your profile.');
      return;
    }

    const cleanName = profileForm.fullName.trim();
    const cleanEmail = profileForm.email.trim();
    const cleanPhone = profileForm.phone.trim() || userPhone;

    localStorage.setItem('sathiseller_user_name', cleanName);
    localStorage.setItem('sathiseller_user_email', cleanEmail);
    localStorage.setItem('sathiseller_user_phone', cleanPhone);

    const userDataStr = localStorage.getItem('sathiseller_user_data');
    if (userDataStr) {
      try {
        const u = JSON.parse(userDataStr);
        u.name = cleanName;
        u.email = cleanEmail;
        u.phone = cleanPhone;
        localStorage.setItem('sathiseller_user_data', JSON.stringify(u));
      } catch (err) {}
    }

    setUserName(cleanName);
    setUserEmail(cleanEmail);
    setUserPhone(cleanPhone);
    setNewAddrForm((prev) => ({ ...prev, fullName: cleanName, phone: cleanPhone }));

    if (selectedAddress) {
      const updatedSel = {
        ...selectedAddress,
        fullName: (!selectedAddress.fullName || selectedAddress.fullName === 'User' || selectedAddress.fullName === 'Customer') ? cleanName : selectedAddress.fullName,
        phone: selectedAddress.phone || cleanPhone,
      };
      setSelectedAddress(updatedSel);
      localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(updatedSel));
    }

    setAddresses((prevAddrs) =>
      prevAddrs.map((a) => ({
        ...a,
        fullName: (!a.fullName || a.fullName === 'User' || a.fullName === 'Customer') ? cleanName : a.fullName,
        phone: a.phone || cleanPhone,
      }))
    );

    setIsProfileModalOpen(false);
    setErrorMsg('');
  };

  const handleSelectAddress = (addr) => {
    setSelectedAddress(addr);
    localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(addr));
    setIsAddressModalOpen(false);
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const cleanName = newAddrForm.fullName || userName || 'Customer';
      const cleanPhone = newAddrForm.phone || userPhone;
      const payload = {
        ...newAddrForm,
        fullName: cleanName,
        phone: cleanPhone,
        isDefault: true,
      };

      const res = await addressService.addAddress(payload);
      let created = payload;
      if (res && res.success) {
        if (res.address) created = res.address;
        else if (res.addresses && Array.isArray(res.addresses) && res.addresses.length > 0) {
          created = res.addresses[res.addresses.length - 1];
        }
      }

      // Automatically set newly created address as selected address for Checkout
      setSelectedAddress(created);
      localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(created));

      await loadAddresses();
      setIsNewAddressModalOpen(false);
    } catch (err) {
      console.error('Failed to create address via API:', err);
      const fallbackCreated = {
        ...newAddrForm,
        id: `local_addr_${Date.now()}`,
        fullName: newAddrForm.fullName || userName || 'Customer',
        phone: newAddrForm.phone || userPhone,
      };
      setSelectedAddress(fallbackCreated);
      localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(fallbackCreated));
      setIsNewAddressModalOpen(false);
    }
  };

  // Order Placement Action
  const loadRazorpayScript = () => {
    if (window.Razorpay) return Promise.resolve(true);
    return new Promise((resolve) => {
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const indianMobile = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const ten = digits.length >= 10 ? digits.slice(-10) : '';
    return /^[6-9]\d{9}$/.test(ten) ? ten : '';
  };

  const usableEmail = (value) => {
    const email = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  };

  const handleRazorpayPayment = async (orderPayload) => {
    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setErrorMsg('Failed to load payment gateway. Please try again.');
        setPlacingOrder(false);
        return;
      }

      // Create order on backend
      const orderRes = await orderService.placeOrder(orderPayload);
      if (!orderRes || !orderRes.success || !orderRes.order) {
        setErrorMsg('Failed to create order.');
        setPlacingOrder(false);
        return;
      }

      const orderId = orderRes.order._id || orderRes.order.orderId;

      // Amount is calculated on the server from the saved order. The value sent here is ignored.
      const razorpayOrderRes = await orderService.createRazorpayOrder(0, orderId);
      if (!razorpayOrderRes || !razorpayOrderRes.success || !razorpayOrderRes.orderId) {
        setErrorMsg('Failed to initialize payment. Please try again.');
        setPlacingOrder(false);
        return;
      }

      const contact = indianMobile(selectedAddress?.phone || profileForm.phone || userPhone);
      const email = usableEmail(profileForm.email || localStorage.getItem('sathiseller_user_email') || selectedAddress?.email);
      const notCompleted = 'Payment was not completed. Your order has not been placed.';
      const paymentFailed = 'Payment failed. Your order has not been placed. Please try again.';
      const razorpayOrderId = razorpayOrderRes.razorpayOrderId || razorpayOrderRes.orderId;
      const amountPaise = Number(razorpayOrderRes.amount);
      const key = razorpayOrderRes.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;

      if (!key || !String(razorpayOrderId).startsWith('order_') || !Number.isInteger(amountPaise) || amountPaise < 100) {
        console.info('[Checkout] Razorpay order was not usable', {
          shippnexOrderId: orderRes.order.orderId,
          razorpayOrderId,
          amount: razorpayOrderRes.amount,
          currency: razorpayOrderRes.currency,
          hasPublicKey: Boolean(key),
        });
        setErrorMsg('Failed to initialize payment. Please try again.');
        setPlacingOrder(false);
        return;
      }

      console.info('[Checkout] Opening Razorpay', {
        shippnexOrderId: orderRes.order.orderId,
        razorpayOrderId,
        amount: amountPaise,
        currency: razorpayOrderRes.currency || 'INR',
      });

      let settled = false;
      const prefill = { name: userName || undefined };
      if (email) prefill.email = email;
      if (contact) prefill.contact = contact;

      const options = {
        key,
        amount: amountPaise,
        currency: razorpayOrderRes.currency || 'INR',
        name: 'Sathi Seller',
        description: 'Order Payment',
        order_id: razorpayOrderId,
        prefill,
        theme: { color: '#ff5500' },
        handler: async (response) => {
          settled = true;
          console.info('[Checkout] Razorpay success callback', {
            shippnexOrderId: orderRes.order.orderId,
            razorpayOrderId: response?.razorpay_order_id,
            razorpayPaymentId: response?.razorpay_payment_id,
          });
          try {
            const verifyRes = await orderService.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: orderId,
            });
            console.info('[Checkout] verify response', {
              status: verifyRes?.success ? 200 : 400,
              paymentStatus: verifyRes?.order?.paymentStatus,
              orderStatus: verifyRes?.order?.orderStatus,
            });

            if (verifyRes && verifyRes.success && verifyRes.order && verifyRes.order.paymentStatus === 'Paid') {
              setErrorMsg('');
              setPlacedOrder(verifyRes.order);
              await clearCart();
            } else {
              setErrorMsg(verifyRes?.message || paymentFailed);
            }
          } catch (err) {
            console.info('[Checkout] verify failed', {
              status: err.response?.status,
              message: err.response?.data?.message,
            });
            setErrorMsg(paymentFailed);
          } finally {
            setPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            settled = true;
            console.info('[Checkout] Razorpay closed', {
              shippnexOrderId: orderRes.order.orderId,
              razorpayOrderId,
              paymentStatus: 'CANCELLED',
            });
            setErrorMsg(notCompleted);
            setPlacingOrder(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        if (settled) return;
        settled = true;
        console.info('[Checkout] Razorpay payment failed', {
          shippnexOrderId: orderRes.order.orderId,
          razorpayOrderId: response?.error?.metadata?.order_id || razorpayOrderId,
          razorpayPaymentId: response?.error?.metadata?.payment_id,
          paymentStatus: 'FAILED',
          reason: response?.error?.reason,
        });
        setErrorMsg(paymentFailed);
        setPlacingOrder(false);
      });
      rzp.open();
      return true;
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMsg(err.response?.data?.message || 'Payment failed. Please try again.');
      setPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    setErrorMsg('');

    // Require complete profile before placing order
    if (!userName || userName === 'Customer' || userName === 'User' || userName.trim() === '') {
      setErrorMsg('Please complete your profile details before placing an order.');
      setIsProfileModalOpen(true);
      return;
    }
    if (!selectedAddress) {
      setErrorMsg('Please select or add a delivery address to proceed.');
      setIsAddressModalOpen(true);
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    const missingSelections = cartItems.flatMap((item) => (
      missingVariantOptions(item).map((option) => `${item.name}: ${option}`)
    ));
    if (missingSelections.length) {
      setErrorMsg(`Please select ${missingSelections.join(', ')} before placing the order.`);
      return;
    }

    let onlineCheckoutOpen = false;
    try {
      setPlacingOrder(true);

      const orderPayload = {
        items: cartItems.map((item) => ({
          product: item.productId || item.id || item._id,
          name: item.name,
          price: Number(item.price || 0),
          originalPrice: Number(item.originalPrice || item.mrp || item.price || 0),
          quantity: item.quantity,
          image: item.image || item.mainImage || '',
          variantSku: item.variantSku || '',
          variantId: item.variantId || '',
          variantTitle: item.variantTitle || item.variation || '',
          selectedAttributes: item.selectedAttributes || undefined,
          selectedVariants: toSelectedVariants(item),
        })),
        shippingAddress: {
          fullName: selectedAddress.fullName || selectedAddress.name || userName,
          phone: selectedAddress.phone || userPhone,
          altPhone: selectedAddress.altPhone || '',
          email: selectedAddress.email || userEmail,
          addressLine1: selectedAddress.addressLine1 || selectedAddress.address,
          addressLine2: selectedAddress.addressLine2 || '',
          landmark: selectedAddress.landmark || '',
          city: selectedAddress.city || 'Noida',
          state: selectedAddress.state || 'Uttar Pradesh',
          pincode: selectedAddress.pincode || selectedAddress.zip || '201301',
          country: selectedAddress.country || 'India',
          addressType: selectedAddress.addressType || selectedAddress.type || 'Home',
        },
        deliverySlot: {
          date: selectedSlot.date,
          time: selectedSlot.time,
        },
        deliveryInstructions,
        paymentMethod: selectedPayment,
      };

      // Razorpay for UPI / Card / Net Banking
      if (['UPI', 'CARD', 'NETBANKING'].includes(selectedPayment)) {
        onlineCheckoutOpen = Boolean(await handleRazorpayPayment(orderPayload));
        return;
      }

      // COD or Sathi Seller Wallet — place order directly (wallet debited on server)
      if (selectedPayment === 'WALLET' && walletBalance !== null && walletBalance < finalGrandTotal) {
        setErrorMsg(`Insufficient wallet balance (₹${walletBalance.toFixed(2)}). Add funds via refunds or choose another payment method.`);
        return;
      }

      const res = await orderService.placeOrder(orderPayload);
      if (res && res.success && res.order) {
        if (res.user) {
          if (res.user.name) localStorage.setItem('sathiseller_user_name', res.user.name);
          if (res.user.email) localStorage.setItem('sathiseller_user_email', res.user.email);
          if (res.user.phone) localStorage.setItem('sathiseller_user_phone', res.user.phone);
          localStorage.setItem('sathiseller_user_data', JSON.stringify(res.user));
          if (res.user.addresses && Array.isArray(res.user.addresses)) {
            localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(res.user.addresses));
          }
        }
        if (selectedPayment === 'WALLET' && typeof res.walletBalance === 'number') {
          setWalletBalance(res.walletBalance);
        } else if (selectedPayment === 'WALLET') {
          try {
            const w = await walletService.getUserWallet();
            if (w?.success) setWalletBalance(Number(w.wallet?.balance || 0));
          } catch (_) {}
        }
        setPlacedOrder(res.order);
        await clearCart();
      } else {
        setErrorMsg(res.message || 'Failed to place order.');
      }
    } catch (err) {
      console.error('Order placement failed:', err);
      setErrorMsg(err.response?.data?.message || 'Order placement failed. Please check stock and try again.');
    } finally {
      if (!onlineCheckoutOpen) setPlacingOrder(false);
    }
  };

  const [deliverySettings, setDeliverySettings] = useState({
    deliveryCharge: 40,
    freeDeliveryMinOrder: 500,
    isFreeDeliveryEnabled: true,
    codCharge: 9,
    isCodChargeEnabled: true,
  });

  useEffect(() => {
    let isMounted = true;
    commissionService.getCurrentRates(true).then((res) => {
      if (isMounted && res && res.success) {
        setDeliverySettings({
          deliveryCharge: Number(res.deliveryCharge !== undefined ? res.deliveryCharge : 40),
          freeDeliveryMinOrder: Number(res.freeDeliveryMinOrder !== undefined ? res.freeDeliveryMinOrder : 500),
          isFreeDeliveryEnabled: res.isFreeDeliveryEnabled !== undefined ? Boolean(res.isFreeDeliveryEnabled) : true,
          codCharge: Number(res.codCharge !== undefined ? res.codCharge : 9),
          isCodChargeEnabled: res.isCodChargeEnabled !== undefined ? Boolean(res.isCodChargeEnabled) : true,
        });
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Calculation summaries
  const itemCount = cartCount || cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const safeTotal = cartTotal || 0;
  const isFreeDelivery = safeTotal === 0 || (deliverySettings.isFreeDeliveryEnabled && safeTotal >= deliverySettings.freeDeliveryMinOrder);
  const deliveryCharge = isFreeDelivery ? 0 : deliverySettings.deliveryCharge;
  const isCod = selectedPayment === 'COD';
  const isOnlinePay = ['UPI', 'CARD', 'NETBANKING'].includes(selectedPayment);
  const isWalletPay = selectedPayment === 'WALLET';
  const paymentNotFinished = errorMsg.startsWith('Payment was not completed');
  const codCharge = (isCod && deliverySettings.isCodChargeEnabled) ? Number(deliverySettings.codCharge ?? 9) : 0;
  const savings = originalTotal > safeTotal ? originalTotal - safeTotal : 0;
  const finalGrandTotal = safeTotal + deliveryCharge + codCharge;
  const walletInsufficient = isWalletPay && walletBalance !== null && walletBalance < finalGrandTotal;

  return (
    <div className="w-full max-w-[480px] md:max-w-7xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-slate-50 font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-8">
      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center py-3 px-5 bg-gradient-to-r from-[#ea580c] to-[#f97316] rounded-b-[20px] shadow-sm z-10 relative mb-2">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} color="white" />
        </button>
        <h2 className="text-[20px] font-semibold m-0 text-white text-center">Checkout</h2>
        <div className="w-[22px]"></div>
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Secure Checkout</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Review your delivery address, slot and payment options</p>
        </div>
        <button
          onClick={() => navigate('/cart')}
          className="text-xs font-bold text-[#ff5500] hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
        >
          ← Return to Cart
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto md:overflow-visible px-5 md:px-0 py-3 md:py-0 flex flex-col md:grid md:grid-cols-12 md:gap-8 md:items-start gap-4 [&::-webkit-scrollbar]:hidden">
        
        {/* Left Column (Address, Slot, Payment) on Desktop */}
        <div className="w-full md:col-span-7 lg:col-span-8 flex flex-col gap-4">
        
        {(!userName || userName === 'Customer' || userName === 'User') && (
          <div className="bg-orange-50 border border-orange-200 text-[#ea580c] px-4 py-3 rounded-xl text-[12px] font-bold flex items-center justify-between shadow-xs">
            <span>⚠️ Complete your profile details to place order.</span>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="bg-[#ff5500] text-white border-none rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer hover:bg-[#e04b00] transition-colors"
            >
              Complete Now
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[12px] font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 1. Delivery Address Card */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5">
              <MapPin size={18} className="text-[#ff5500]" />
              <h3 className="text-[14px] font-bold text-slate-800 m-0">Delivery Address</h3>
            </div>
            <button
              onClick={() => setIsAddressModalOpen(true)}
              className="bg-transparent border-none text-[#ff5500] text-[12px] font-bold cursor-pointer p-0 hover:underline"
            >
              {selectedAddress ? 'Change' : '+ Select'}
            </button>
          </div>

          {selectedAddress ? (
            <div className="flex flex-col gap-1 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-900">
                  {(!selectedAddress.fullName || selectedAddress.fullName === 'User' || selectedAddress.fullName === 'Customer')
                    ? (userName && userName !== 'User' && userName !== 'Customer' ? userName : selectedAddress.fullName || 'Customer')
                    : selectedAddress.fullName}
                </span>
                <span className="bg-orange-50 text-[#ff5500] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-orange-200/60">
                  {selectedAddress.addressType || selectedAddress.type || 'Home'}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600 m-0 mt-0.5">
                {selectedAddress.addressLine1 || selectedAddress.address}
                {selectedAddress.addressLine2 && `, ${selectedAddress.addressLine2}`}
                {selectedAddress.landmark && ` (Near ${selectedAddress.landmark})`}
                <br />
                {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode || selectedAddress.zip}
              </p>
              <p className="text-[11px] font-medium text-slate-500 m-0 mt-1">
                📞 {selectedAddress.phone || userPhone}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setIsAddressModalOpen(true)}
              className="w-full py-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 text-[#ff5500] font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> Add Delivery Address
            </button>
          )}
        </div>

        {/* 3. Delivery Instructions (Optional) */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <h3 className="text-[13px] font-bold text-slate-800 m-0 mb-2">Delivery Instructions (Optional)</h3>
          <input
            type="text"
            placeholder="e.g. Leave at gate, don't ring bell"
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-medium text-slate-800 outline-none focus:border-[#ff5500]"
          />
        </div>

        {/* 4. Payment Method Selection Section */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <h3 className="text-[14px] font-bold text-slate-800 m-0 mb-3">Select Payment Method</h3>
          <div className="flex flex-col gap-2.5">
            {paymentMethods.map((pm) => {
              const IconComp = pm.icon;
              const isSelected = selectedPayment === pm.id;
              const isCodOption = pm.id === 'COD';
              const codExtra = (isCodOption && deliverySettings.isCodChargeEnabled && deliverySettings.codCharge > 0) ? deliverySettings.codCharge : 0;
              
              return (
                <div
                  key={pm.id}
                  onClick={() => setSelectedPayment(pm.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-[#ff5500] bg-orange-50/40 ring-1 ring-[#ff5500]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#ff5500] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <IconComp size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-bold text-slate-900 m-0">{pm.name}</h4>
                        {codExtra > 0 && (
                          <span className="bg-orange-100 text-[#ea580c] border border-orange-200/80 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md">
                            +₹{codExtra} COD Fee
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        {codExtra > 0
                          ? `Pay cash upon delivery (+₹${codExtra} handling fee)`
                          : pm.id === 'WALLET' && walletBalance !== null
                            ? `Balance ₹${walletBalance.toFixed(2)} · ${pm.description}`
                            : pm.description}
                      </p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#ff5500] bg-[#ff5500] text-white' : 'border-slate-300'}`}>
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div> {/* End Left Column */}

        {/* Right Column (Order Summary & Desktop Checkout Button) on Desktop */}
        <div className="w-full md:col-span-5 lg:col-span-4 md:sticky md:top-24 flex flex-col gap-4">
        {/* 5. Order Summary Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 m-0 mb-3 pb-2 border-b border-slate-100">Order Summary</h3>

          {/* Cart Items List */}
          <div className="flex flex-col gap-2 mb-3 pb-3 border-b border-slate-100 max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:hidden">
            {cartItems.map((item) => (
              <div key={item.id || item._id} className="flex justify-between items-center py-1">
                <span className="text-[12px] font-medium text-slate-700 truncate max-w-[200px]">
                  {item.name}{variantLabel(item) ? ` (${variantLabel(item)})` : ''} <strong className="text-slate-900">x{item.quantity}</strong>
                </span>
                <span className="text-[12px] font-bold text-slate-900">
                  ₹{(Number(item.price || 0) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-medium text-slate-500">Items Total ({itemCount} items)</span>
              <span className="text-[12px] font-semibold text-slate-900">₹{safeTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-medium text-slate-500">Delivery Charges</span>
              {deliveryCharge === 0 ? (
                <span className="text-[12px] font-bold text-emerald-600">FREE</span>
              ) : (
                <span className="text-[12px] font-bold text-slate-900">₹{deliveryCharge.toFixed(2)}</span>
              )}
            </div>
            {isCod && deliverySettings.isCodChargeEnabled && codCharge > 0 && (
              <div className="flex justify-between items-center bg-orange-50/70 px-2.5 py-1.5 rounded-lg border border-orange-100">
                <span className="text-[12px] font-medium text-orange-800">COD Handling Fee</span>
                <span className="text-[12px] font-bold text-orange-900">+ ₹{codCharge.toFixed(2)}</span>
              </div>
            )}
            {savings > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-medium text-slate-500">Total Savings</span>
                <span className="text-[12px] font-bold text-emerald-600">- ₹{savings.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-3 border-t border-dashed border-slate-300">
              <span className="text-sm font-black text-slate-900">Grand Total</span>
              <span className="text-lg font-black text-slate-900">₹{finalGrandTotal.toFixed(2)}</span>
            </div>
          </div>

          {walletInsufficient && (
            <p className="text-[11px] font-semibold text-rose-600 m-0 pt-1">
              Insufficient wallet balance. Available ₹{Number(walletBalance || 0).toFixed(2)}.
            </p>
          )}

          {/* Desktop Place Order Button */}
          <div className="hidden md:block pt-3">
            <button
              disabled={placingOrder || walletInsufficient}
              className="w-full bg-[#ff5500] hover:bg-[#e04b00] disabled:opacity-60 text-white border-none rounded-xl py-3.5 px-6 text-sm font-black cursor-pointer shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              onClick={handlePlaceOrder}
            >
              {placingOrder ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> {isOnlinePay || isWalletPay ? 'Processing...' : 'Placing Order...'}
                </>
              ) : (
                <>
                  <span>
                    {isOnlinePay || isWalletPay
                      ? (paymentNotFinished ? 'Retry Payment' : 'Pay')
                      : 'Place Order'} • ₹{finalGrandTotal.toFixed(2)}
                  </span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium">
            <span>🔒 Safe & Secure Checkout</span>
            <span>⚡ 10-Min Fast Delivery</span>
          </div>
        </div>
        </div> {/* End Right Column */}

        {/* Extra bottom padding to ensure Order Summary is fully visible above sticky footer (Mobile only) */}
        <div className="h-[140px] shrink-0 md:hidden"></div>
      </div>

      {/* Sticky Place Order Footer (Mobile Only) — fixed so it stays above system UI / nav chrome */}
      <div className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] py-4 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-200/80 z-[80] flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[11px] font-medium text-slate-500 block">Total Payable</span>
          <span className="text-[18px] font-extrabold text-slate-900">₹{finalGrandTotal.toFixed(2)}</span>
        </div>
        <button
          disabled={placingOrder || walletInsufficient}
          className="bg-[#ff5500] hover:bg-[#e04b00] disabled:opacity-60 text-white border-none rounded-xl py-3.5 px-7 text-[15px] font-bold cursor-pointer shadow-[0_4px_12px_rgba(255,85,0,0.25)] transition-transform duration-200 active:scale-[0.98] flex items-center gap-2"
          onClick={handlePlaceOrder}
        >
          {placingOrder ? (
            <>
              <Loader2 size={18} className="animate-spin" /> {isOnlinePay || isWalletPay ? 'Processing...' : 'Placing...'}
            </>
          ) : (
            <>
              <span>{isOnlinePay || isWalletPay ? (paymentNotFinished ? 'Retry Payment' : 'Pay') : 'Place Order'}</span>
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>

      {/* Complete Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-[480px] sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-fade-in-up flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-[16px] font-extrabold text-slate-900 m-0">Complete Your Profile</h3>
              {userName && userName !== 'Customer' && userName !== 'User' && (
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <p className="text-[12px] text-slate-500 font-medium mb-4">
              Please enter your full name and contact information to proceed with placing your order.
            </p>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Full Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={profileForm.phone || userPhone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#ff5500] hover:bg-[#e04b00] text-white rounded-xl py-3.5 mt-2 font-bold text-[14px] cursor-pointer shadow-[0_4px_12px_rgba(255,85,0,0.2)]"
              >
                Save Profile & Continue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Address Selection Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-[480px] sm:max-w-xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-fade-in-up flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-[16px] font-extrabold text-slate-900 m-0">Select Delivery Address</h3>
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex flex-col gap-3 py-1 [&::-webkit-scrollbar]:hidden">
              {addresses.map((addr, idx) => {
                const isSelected = selectedAddress && (
                  (selectedAddress._id && addr._id && String(selectedAddress._id) === String(addr._id)) ||
                  (selectedAddress.id && addr.id && String(selectedAddress.id) === String(addr.id)) ||
                  ((selectedAddress.addressLine1 || selectedAddress.address) === (addr.addressLine1 || addr.address) &&
                   (selectedAddress.pincode || selectedAddress.zip) === (addr.pincode || addr.zip))
                );

                const displayName = (!addr.fullName || addr.fullName === 'User' || addr.fullName === 'Customer')
                  ? (userName && userName !== 'User' && userName !== 'Customer' ? userName : addr.fullName || 'Customer')
                  : addr.fullName;

                return (
                  <div
                    key={addr._id || addr.id || idx}
                    onClick={() => handleSelectAddress(addr)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected ? 'border-[#ff5500] bg-orange-50/40 shadow-sm ring-1 ring-[#ff5500]' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${isSelected ? 'border-[#ff5500] bg-[#ff5500] text-white' : 'border-slate-300'}`}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-bold text-slate-900">{displayName}</span>
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="text-[9px] font-extrabold uppercase bg-[#ff5500] text-white px-2 py-0.5 rounded-md">
                              Selected
                            </span>
                          )}
                          <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {addr.addressType || addr.type || 'Home'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[12px] text-slate-600 leading-snug m-0">
                        {addr.addressLine1 || addr.address}, {addr.city}, {addr.state} - {addr.pincode || addr.zip}
                      </p>
                      <p className="text-[11px] text-slate-400 m-0 mt-1">{addr.phone || userPhone}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                setIsAddressModalOpen(false);
                setIsNewAddressModalOpen(true);
              }}
              className="mt-4 w-full py-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 text-[#ff5500] font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-orange-50 transition-colors"
            >
              <Plus size={16} /> Add New Address
            </button>
          </div>
        </div>
      )}

      {/* New Address Modal */}
      {isNewAddressModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-[480px] sm:max-w-xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-fade-in-up flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-[16px] font-extrabold text-slate-900 m-0">Add New Delivery Address</h3>
              <button
                onClick={() => setIsNewAddressModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Address Tag</label>
                  <select
                    value={newAddrForm.addressType}
                    onChange={(e) => setNewAddrForm({ ...newAddrForm, addressType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-bold text-slate-800 outline-none"
                  >
                    <option value="Home">Home</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Full Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="Full Name"
                    value={newAddrForm.fullName}
                    onChange={(e) => setNewAddrForm({ ...newAddrForm, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">Street Address *</label>
                <input
                  required
                  type="text"
                  placeholder="Flat No, Building, Street"
                  value={newAddrForm.addressLine1}
                  onChange={(e) => setNewAddrForm({ ...newAddrForm, addressLine1: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">City *</label>
                  <input
                    required
                    type="text"
                    placeholder="City"
                    value={newAddrForm.city}
                    onChange={(e) => setNewAddrForm({ ...newAddrForm, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-semibold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">State *</label>
                  <input
                    required
                    type="text"
                    placeholder="State"
                    value={newAddrForm.state}
                    onChange={(e) => setNewAddrForm({ ...newAddrForm, state: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Pincode *</label>
                  <input
                    required
                    type="text"
                    placeholder="Pincode"
                    value={newAddrForm.pincode}
                    onChange={(e) => setNewAddrForm({ ...newAddrForm, pincode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-semibold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Phone Number *</label>
                  <input
                    required
                    type="tel"
                    placeholder="Phone"
                    value={newAddrForm.phone}
                    onChange={(e) => setNewAddrForm({ ...newAddrForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[12px] font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#ff5500] text-white rounded-xl py-3 mt-2 font-bold text-[14px] cursor-pointer"
              >
                Save Address
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {placedOrder && (placedOrder.paymentMethod === 'COD' || placedOrder.paymentStatus === 'Paid') && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center px-5 overflow-hidden">
          <div className="flex flex-col items-center justify-center w-full max-w-[400px]">
            <div className="w-20 h-20 bg-[#22c55e] rounded-full flex items-center justify-center shadow-lg mb-4">
              <Check size={40} color="white" strokeWidth={3.5} />
            </div>

            <h2 className="text-[20px] font-extrabold text-slate-900 mb-1 text-center">
              Order Placed Successfully! 🎉
            </h2>
            <p className="text-[12px] font-medium text-slate-500 mb-6 text-center">
              Thank you {placedOrder.shippingAddress?.fullName || userName}. Your order is confirmed.
            </p>

            <div className="w-full bg-white border border-slate-100 rounded-[16px] p-4 mb-6 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Order ID</span>
                <span className="text-[14px] font-extrabold text-slate-900">{placedOrder.orderId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Grand Total</span>
                <span className="text-[15px] font-extrabold text-slate-900">₹{placedOrder.grandTotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Payment Mode</span>
                <span className="text-[12px] font-bold text-slate-800">{placedOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Estimated Delivery</span>
                <span className="text-[12px] font-bold text-emerald-600">{placedOrder.deliverySlot?.date} ({placedOrder.deliverySlot?.time})</span>
              </div>
            </div>

            <button
              className="w-full bg-[#0f172a] text-white border-none rounded-xl py-3.5 text-[14px] font-bold cursor-pointer mb-3"
              onClick={() => navigate('/orders')}
            >
              View My Orders
            </button>
            <button
              className="bg-transparent border-none text-[#ff5500] text-[13px] font-semibold cursor-pointer py-2"
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

export default Checkout;

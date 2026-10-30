import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Store, MapPin, FileText, CheckCircle, Check, Loader2, Search, Navigation, AlertCircle, Crown, Zap, Star, CreditCard, Banknote, Wallet, Building2, Smartphone, UploadCloud, Image, X, FileCheck, Layers, Eye, EyeOff, Lock, ShieldCheck, RotateCcw, DollarSign, Sparkles, Gift } from 'lucide-react';
import { authService, categoryService, sellerRegistrationFeeService, referralService } from '../../../../services/authService';
import { MapService } from '../../../../services/MapService';
import LocationSearchModal from '../../../../components/LocationSearchModal';
import { loadRazorpaySdk } from '../../../../utils/razorpay';
import { uploadRegistrationImage } from '../../../../utils/uploadRegistrationImage';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const FSSAI_REGEX = /^[0-9]{14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const FALLBACK_CATEGORIES = [
  'Grocery Essentials',
  'Grains & Flours',
  'Oil & Ghee',
  'Spices & Masala',
  'Sugar & Sweeteners',
  'Fruits',
  'Vegetables',
  'Ready-to-Cook',
  'Bakery & Cakes',
  'Fast Food',
  'Personal Care',
  'Home Care',
  'Stationary',
  'Beauty',
  'Electronics',
  'Fashion'
];

const CATEGORY_TRANSLATIONS = {
  'Grocery Essentials': 'किराना सामग्री',
  'Grains & Flours': 'अनाज और आटा',
  'Oil & Ghee': 'तेल और घी',
  'Spices & Masala': 'मसाले',
  'Sugar & Sweeteners': 'चीनी और मिठास',
  'Fruits': 'फल',
  'Vegetables': 'सब्जियां',
  'Ready-to-Cook': 'पकाने के लिए तैयार खाद्य',
  'Bakery & Cakes': 'बेकरी और केक',
  'Fast Food': 'फास्ट फूड',
  'Personal Care': 'व्यक्तिगत देखभाल',
  'Home Care': 'घर की देखभाल',
  'Stationary': 'स्टेशनरी',
  'Beauty': 'सौंदर्य प्रसाधन',
  'Electronics': 'इलेक्ट्रॉनिक्स',
  'Fashion': 'फैशन',
};

const getCategoryBilingualLabel = (catName) => {
  const hindi = CATEGORY_TRANSLATIONS[catName];
  return hindi ? `${catName} / ${hindi}` : catName;
};

const SellerRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCodeFromUrl = searchParams.get('ref') || '';
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Dynamic Seller Registration Fee States
  const [feeConfig, setFeeConfig] = useState({
    amount: 150,
    currency: 'INR',
    isActive: true,
    description: '',
    loading: true,
  });
  const [pendingSellerId, setPendingSellerId] = useState(null);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState('');
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  const [availableCategories, setAvailableCategories] = useState(FALLBACK_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [referrerName, setReferrerName] = useState('');
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralError, setReferralError] = useState('');

  // Password Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Verification States (Step 5)
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');

  // Fetch Dynamic Registration Fee Config on Mount
  const fetchFeeConfig = async () => {
    try {
      setFeeConfig(prev => ({ ...prev, loading: true }));
      const res = await sellerRegistrationFeeService.getPublicFeeConfig();
      if (res && res.success) {
        setFeeConfig({
          amount: res.amount !== undefined ? res.amount : 150,
          currency: res.currency || 'INR',
          isActive: Boolean(res.isActive),
          description: res.description || '',
          loading: false,
        });
      } else {
        setFeeConfig(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.warn('Could not fetch registration fee config, using defaults:', err);
      setFeeConfig(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchFeeConfig();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        // forceRefresh so admin-created categories appear immediately (#24)
        const res = await categoryService.getCategories(true);
        if (res?.categories && Array.isArray(res.categories) && res.categories.length > 0) {
          const names = res.categories.map(c => c.name || c.label || c).filter(Boolean);
          if (names.length > 0) {
            setAvailableCategories(names);
          }
        }
      } catch (err) {
        console.warn('Could not fetch categories from server, using fallback list', err);
      }
    };
    loadCategories();
  }, []);

  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    email: '',
    businessType: '',
    storeLogo: '',
    completeAddress: '',
    city: '',
    state: '',
    pincode: '',
    lat: null,
    lng: null,
    serviceRadius: '5',
    gstNumber: '',
    panNumber: '',
    fssaiLicense: '',
    gstPhoto: '',
    bankPassbookPhoto: '',
    planId: '',
    referralCode: (refCodeFromUrl || (typeof window !== 'undefined' ? sessionStorage.getItem('seller_referral_code') : '') || '').trim().toUpperCase(),
  });

  const validateReferralCode = async (code) => {
    const trimmed = String(code || '').trim().toUpperCase();
    if (!trimmed) {
      setReferrerName('');
      setReferralError('');
      return true;
    }
    setReferralValidating(true);
    setReferralError('');
    try {
      const res = await referralService.validate(trimmed, 'seller');
      if (res?.valid && res?.referrerName) {
        setReferrerName(res.referrerName);
        setReferralError('');
        return true;
      }
      setReferrerName('');
      setReferralError('Invalid referral code. Please check and try again, or leave it blank.');
      return false;
    } catch (err) {
      setReferrerName('');
      setReferralError(err.response?.data?.message || 'Could not validate referral code.');
      return false;
    } finally {
      setReferralValidating(false);
    }
  };

  useEffect(() => {
    if (refCodeFromUrl) {
      sessionStorage.setItem('seller_referral_code', refCodeFromUrl.trim().toUpperCase());
      setFormData(prev => ({ ...prev, referralCode: refCodeFromUrl.trim().toUpperCase() }));
    } else {
      const savedRef = sessionStorage.getItem('seller_referral_code');
      if (savedRef) {
        setFormData(prev => ({ ...prev, referralCode: savedRef }));
      }
    }
  }, [refCodeFromUrl]);

  useEffect(() => {
    const code = formData.referralCode || refCodeFromUrl;
    if (!code) {
      setReferrerName('');
      setReferralError('');
      return undefined;
    }
    const timer = setTimeout(() => {
      validateReferralCode(code);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.referralCode, refCodeFromUrl]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleCategory = (catName) => {
    setErrorMessage('');
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, storeLogo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('File size must be less than 5MB / फ़ाइल का आकार 5MB से कम होना चाहिए');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [fieldName]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeDocFile = (fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: '' }));
  };

  // Google Maps GPS Geolocation Auto-Detection
  const handleGetGpsLocation = async () => {
    setGpsLoading(true);
    setErrorMessage('');
    try {
      const coords = await MapService.getCurrentCoordinates();
      const detailed = await MapService.reverseGeocode(coords.lat, coords.lng);
      setFormData(prev => ({
        ...prev,
        completeAddress: detailed.formattedAddress || detailed.address,
        city: detailed.city || prev.city,
        state: detailed.state || prev.state,
        pincode: detailed.postalCode || detailed.pincode || prev.pincode,
        lat: detailed.latitude || detailed.lat,
        lng: detailed.longitude || detailed.lng,
      }));
    } catch (err) {
      console.error('Seller register GPS error:', err);
      setErrorMessage(err.message || 'Could not detect GPS location. Please search on map. / जीपीएस स्थान का पता नहीं लगाया जा सका। कृपया मानचित्र पर खोजें।');
    } finally {
      setGpsLoading(false);
    }
  };

  // Map Modal Selection
  const handleMapLocationSelect = (loc) => {
    if (!loc) return;
    setFormData(prev => ({
      ...prev,
      completeAddress: loc.formattedAddress || loc.address,
      city: loc.city || prev.city,
      state: loc.state || prev.state,
      pincode: loc.postalCode || loc.pincode || prev.pincode,
      lat: loc.latitude || loc.lat,
      lng: loc.longitude || loc.lng,
    }));
  };

  // OTP Input Handlers
  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < clean.length && index + i < 6; i++) {
        newOtp[index + i] = clean[i];
      }
      setOtp(newOtp);
      const nextIdx = Math.min(index + clean.length, 5);
      const nextInput = document.getElementById(`seller-reg-otp-${nextIdx}`);
      if (nextInput) nextInput.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);

    if (clean && index < 5) {
      const nextInput = document.getElementById(`seller-reg-otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`seller-reg-otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage('');
    setResendSuccessMsg('');
    try {
      setIsResendingOtp(true);
      await authService.sendSellerOtp(formData.phone);
      setResendSuccessMsg('A new OTP has been sent to your mobile number. / आपके मोबाइल नंबर पर एक नया ओटीपी भेज दिया गया है।');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to resend OTP. Please try again. / ओटीपी पुनः भेजने में विफल। कृपया पुनः प्रयास करें।');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const enteredOtp = otp.join('').trim();
    if (enteredOtp.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code / कृपया पूरा 6-अंकीय सत्यापन कोड दर्ज करें');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const res = await authService.verifySellerOtp(formData.phone, enteredOtp);
      if (res && res.success) {
        setIsSubmitted(true);
      } else {
        setErrorMessage(res?.message || 'OTP verification failed. Please try again. / ओटीपी सत्यापन विफल रहा। कृपया पुनः प्रयास करें।');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Verification failed. Please check the code. / सत्यापन विफल रहा। कृपया कोड की जांच करें।');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLaunchRazorpayCheckout = async (orderData) => {
    try {
      const isLoaded = await loadRazorpaySdk();
      if (!isLoaded || !window.Razorpay) {
        setPaymentFailed(true);
        setPaymentErrorMessage('Razorpay SDK failed to load. Please check your internet connection. / रेज़रपे एसडीके लोड करने में विफल रहा। कृपया अपना इंटरनेट कनेक्शन जांचें।');
        return;
      }

      const amountRupees = Number(orderData.amount);
      if (!orderData.orderId || !Number.isFinite(amountRupees) || amountRupees <= 0) {
        setPaymentFailed(true);
        setPaymentErrorMessage('Invalid payment order. Please retry. / अमान्य भुगतान ऑर्डर। कृपया पुनः प्रयास करें।');
        return;
      }

      // Razorpay checkout amount must be in paise and match the server order
      const amountPaise = Math.round(amountRupees * 100);

      const options = {
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
        amount: amountPaise,
        currency: orderData.currency || 'INR',
        name: 'Sathi Seller Marketplace / शिपनेक्स मार्केटप्लेस',
        description: `One-Time Seller Registration Fee (₹${amountRupees}) / एकमुश्त विक्रेता पंजीकरण शुल्क (₹${amountRupees})`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            setIsSubmitting(true);
            setPaymentErrorMessage('');
            const verifyPayload = {
              sellerId: orderData.sellerId || pendingSellerId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            };
            const verifyRes = await sellerRegistrationFeeService.verifyPayment(verifyPayload);
            if (verifyRes && verifyRes.success) {
              setPaymentSuccessMsg('Registration payment successful. / पंजीकरण भुगतान सफल रहा।');
              setPaymentFailed(false);
              setStep(5); // Advance to OTP verification only after successful payment
            } else {
              setPaymentFailed(true);
              setPaymentErrorMessage(verifyRes?.message || 'Payment verification failed. Please retry. / भुगतान सत्यापन विफल रहा। कृपया पुनः प्रयास करें।');
            }
          } catch (err) {
            setPaymentFailed(true);
            setPaymentErrorMessage(err.response?.data?.message || err.message || 'Payment verification error. / भुगतान सत्यापन में त्रुटि।');
          } finally {
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            // #29 — cancel must NOT complete registration / advance to OTP
            setIsSubmitting(false);
            setPaymentFailed(true);
            setPaymentErrorMessage('Payment cancelled or closed. Your registration has not been completed. Please retry. / भुगतान रद्द या बंद कर दिया गया। आपका पंजीकरण पूरा नहीं हुआ है। कृपया पुनः प्रयास करें।');
          },
          escape: true,
          confirm_close: true,
        },
        prefill: {
          name: formData.ownerName || formData.businessName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: '#ff5500',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setIsSubmitting(false);
        setPaymentFailed(true);
        setPaymentErrorMessage(response.error?.description || 'Payment failed. Your registration has not been completed. Please retry. / भुगतान विफल रहा। आपका पंजीकरण पूरा नहीं हुआ है। कृपया पुनः प्रयास करें।');
      });
      rzp.open();
    } catch (err) {
      console.error('Razorpay launch error:', err);
      setPaymentFailed(true);
      setPaymentErrorMessage(err.message || 'Unable to open payment gateway. Please retry.');
    }
  };

  const handleRetryPayment = async () => {
    setIsRetryingPayment(true);
    setPaymentErrorMessage('');
    try {
      const res = await sellerRegistrationFeeService.retryOrder({
        sellerId: pendingSellerId,
        phone: formData.phone,
      });
      if (res && res.alreadyPaid) {
        setPaymentSuccessMsg('Registration payment already verified. / पंजीकरण भुगतान पहले ही सत्यापित हो चुका है।');
        setPaymentFailed(false);
        setStep(5);
        return;
      }
      if (res && res.success && res.orderId) {
        handleLaunchRazorpayCheckout(res);
      } else {
        setPaymentErrorMessage(res?.message || 'Unable to retry payment. Please re-submit. / भुगतान का पुन: प्रयास करने में असमर्थ। कृपया पुनः सबमिट करें।');
      }
    } catch (err) {
      setPaymentErrorMessage(err.response?.data?.message || err.message || 'Error initializing retry payment. / पुनः भुगतान प्रारंभ करने में त्रुटि।');
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const nextStep = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (step === 1) {
      if (!formData.businessName?.trim()) {
        setErrorMessage('Business / Store name is required. / व्यवसाय या दुकान का नाम आवश्यक है।');
        return;
      }
      if (!formData.ownerName?.trim()) {
        setErrorMessage('Owner full name is required. / मालिक का पूरा नाम आवश्यक है।');
        return;
      }
      if (!PHONE_REGEX.test(String(formData.phone || '').trim())) {
        setErrorMessage('Enter a valid 10-digit mobile number starting with 6–9. / 6–9 से शुरू होने वाला वैध 10 अंकों का मोबाइल नंबर दर्ज करें।');
        return;
      }
      if (!EMAIL_REGEX.test(String(formData.email || '').trim())) {
        setErrorMessage('Enter a valid email address. / वैध ईमेल पता दर्ज करें।');
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        setErrorMessage('Password is required and must be at least 6 characters long. / पासवर्ड आवश्यक है और कम से कम 6 वर्णों का होना चाहिए।');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify. / पासवर्ड मेल नहीं खाते। कृपया पुष्टि करें।');
        return;
      }
      if (selectedCategories.length === 0) {
        setErrorMessage('Please select at least one store category for your business. / कृपया अपने व्यवसाय के लिए कम से कम एक स्टोर श्रेणी चुनें।');
        return;
      }
      if (formData.referralCode?.trim()) {
        const ok = await validateReferralCode(formData.referralCode);
        if (!ok) {
          setErrorMessage(referralError || 'Invalid referral code. Please check and try again, or leave it blank.');
          return;
        }
      }
    }

    if (step === 2) {
      if (!formData.completeAddress?.trim()) {
        setErrorMessage('Complete warehouse address is required. / पूरा वेयरहाउस पता आवश्यक है।');
        return;
      }
      if (!formData.city?.trim() || !formData.state?.trim()) {
        setErrorMessage('City and state are required. / शहर और राज्य आवश्यक हैं।');
        return;
      }
      if (!PINCODE_REGEX.test(String(formData.pincode || '').trim())) {
        setErrorMessage('Enter a valid 6-digit PIN code. / वैध 6 अंकों का पिन कोड दर्ज करें।');
        return;
      }
      if (!formData.lat || !formData.lng) {
        setErrorMessage('Please set warehouse location via GPS or map search. / कृपया जीपीएस या मानचित्र से वेयरहाउस स्थान सेट करें।');
        return;
      }
      const radius = Number(formData.serviceRadius);
      if (!Number.isFinite(radius) || radius < 1) {
        setErrorMessage('Service radius must be at least 1 km. / सेवा दायरा कम से कम 1 किमी होना चाहिए।');
        return;
      }
    }

    if (step === 3) {
      const pan = String(formData.panNumber || '').trim().toUpperCase();
      if (!PAN_REGEX.test(pan)) {
        setErrorMessage('Enter a valid PAN (e.g. ABCDE1234F). / वैध पैन दर्ज करें (जैसे: ABCDE1234F)।');
        return;
      }
      const gst = String(formData.gstNumber || '').trim().toUpperCase();
      if (gst && !GST_REGEX.test(gst)) {
        setErrorMessage('Enter a valid 15-character GSTIN, or leave GST blank. / वैध 15 अक्षर का जीएसटीआईएन दर्ज करें, या खाली छोड़ें।');
        return;
      }
      const fssai = String(formData.fssaiLicense || '').trim();
      if (fssai && !FSSAI_REGEX.test(fssai)) {
        setErrorMessage('FSSAI license must be exactly 14 digits, or leave blank. / एफएसएसएआई लाइसेंस ठीक 14 अंकों का होना चाहिए।');
        return;
      }
      if (!formData.bankPassbookPhoto) {
        setErrorMessage('Bank passbook or cancelled cheque photo is required. / बैंक पासबुक या रद्द चेक का फोटो आवश्यक है।');
        return;
      }
      // Normalize uppercase formats into form state
      setFormData((prev) => ({
        ...prev,
        panNumber: pan,
        gstNumber: gst,
        fssaiLicense: fssai,
      }));
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      // Step 4: Seller Registration Fee Payment
      setIsSubmitting(true);
      setErrorMessage('');
      setPaymentErrorMessage('');
      setPaymentSuccessMsg('');
      setPaymentFailed(false);

      try {
        // Upload photos first. Do not send multi-MB base64 in initiate-order —
        // nginx rejects that with 413 Request Entity Too Large.
        const [storeLogoUrl, gstPhotoUrl, bankPassbookPhotoUrl] = await Promise.all([
          uploadRegistrationImage(formData.storeLogo, 'profiles'),
          uploadRegistrationImage(formData.gstPhoto, 'misc'),
          uploadRegistrationImage(formData.bankPassbookPhoto, 'misc'),
        ]);

        setFormData((prev) => ({
          ...prev,
          storeLogo: storeLogoUrl || prev.storeLogo,
          gstPhoto: gstPhotoUrl || prev.gstPhoto,
          bankPassbookPhoto: bankPassbookPhotoUrl || prev.bankPassbookPhoto,
        }));

        const basePayload = {
          businessName: formData.businessName,
          ownerName: formData.ownerName,
          phone: formData.phone,
          password: formData.password,
          email: formData.email,
          businessType: formData.businessType || 'Retail',
          storeLogo: storeLogoUrl,
          categories: selectedCategories,
          serviceRadius: formData.serviceRadius ? Number(formData.serviceRadius) : 5,
          completeAddress: formData.completeAddress,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          lat: formData.lat,
          lng: formData.lng,
          gstNumber: formData.gstNumber,
          panNumber: formData.panNumber,
          fssaiLicense: formData.fssaiLicense,
          gstPhoto: gstPhotoUrl,
          bankPassbookPhoto: bankPassbookPhotoUrl,
          referralCode: (formData.referralCode || refCodeFromUrl || (typeof window !== 'undefined' ? sessionStorage.getItem('seller_referral_code') : '') || '').trim().toUpperCase(),
        };

        const res = await sellerRegistrationFeeService.initiateOrder(basePayload);

        const resolvedSellerId = res?.sellerId || res?.seller?.id || res?.seller?._id || null;
        if (resolvedSellerId) {
          setPendingSellerId(resolvedSellerId);
        }

        if (res && res.alreadyPaid) {
          setPaymentSuccessMsg('Registration fee has already been paid for this account. / इस खाते के लिए पंजीकरण शुल्क का भुगतान पहले ही किया जा चुका है।');
          setStep(5); // Move to OTP verification
          return;
        }

        if (res && res.registrationFeeRequired === false) {
          // Fee waived by admin / not required
          setPaymentSuccessMsg('Registration fee is currently waived. / पंजीकरण शुल्क वर्तमान में माफ है।');
          setStep(5); // Move to OTP verification
          return;
        }

        if (res && res.registrationFeeRequired && res.orderId) {
          await handleLaunchRazorpayCheckout({
            ...res,
            sellerId: resolvedSellerId || res.sellerId,
          });
          return;
        }

        setErrorMessage(res?.message || 'Failed to initiate registration fee order. / पंजीकरण शुल्क ऑर्डर प्रारंभ करने में विफल।');
      } catch (err) {
        console.error('Registration order initiation error:', err);
        const status = err?.response?.status;
        if (status === 413) {
          setErrorMessage(
            'Document photos are too large for the server. Please use smaller images (under 2MB) and try again. / दस्तावेज़ की फ़ोटो सर्वर के लिए बहुत बड़ी हैं। कृपया छोटी छवियाँ (2MB से कम) उपयोग करें।'
          );
        } else {
          setErrorMessage(
            err.response?.data?.message ||
              err.message ||
              'Server error occurred during payment initiation. / भुगतान प्रारंभ करने के दौरान सर्वर त्रुटि हुई।'
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const prevStep = () => {
    setErrorMessage('');
    if (step > 1 && step <= 4) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* #16 — sticky registration header */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-1">
            <img src="/Logo.png" alt="Sathi Seller" className="h-9 object-contain mx-auto" />
          </Link>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            Seller Registration <span className="font-bold text-slate-500 text-lg">/ विक्रेता पंजीकरण</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Start selling on Sathi Seller Marketplace <span className="text-slate-400">/ शिपनेक्स मार्केटप्लेस पर बेचना शुरू करें</span>
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-6 px-5 shadow-xl sm:rounded-2xl sm:px-8 border border-slate-100">
          {isSubmitted ? (
            <div className="text-center py-5 animate-in zoom-in-95 duration-300 space-y-3.5">
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                <CheckCircle size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Registration Successful <span className="text-slate-500 font-semibold text-base">/ पंजीकरण सफल रहा</span></h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal max-w-md mx-auto">
                Your account is currently <strong className="text-slate-900 font-semibold">under review / समीक्षाधीन है</strong>. Once the admin approves your account, you will be able to log in using your <strong className="text-slate-900 font-semibold">registered mobile number and password / पंजीकृत मोबाइल नंबर और पासवर्ड</strong>.
              </p>
              
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2 my-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span className="font-semibold">Business / Store Name <span className="font-normal text-slate-500">/ व्यवसाय का नाम</span>:</span>
                  <span className="font-bold text-slate-900">{formData.businessName}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span className="font-semibold">Registered Phone <span className="font-normal text-slate-500">/ मोबाइल नंबर</span>:</span>
                  <span className="font-bold text-slate-900">+91 {formData.phone}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span className="font-semibold">Account Status <span className="font-normal text-slate-500">/ स्थिति</span>:</span>
                  <span className="font-bold text-amber-600 uppercase text-[11px]">Under Review (Pending Approval) / समीक्षाधीन</span>
                </div>
              </div>

              <Link
                to="/seller/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-[#ff5500] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[#e64d00] transition-colors no-underline cursor-pointer"
              >
                Go to Seller Login / विक्रेता लॉगिन पर जाएं
              </Link>
            </div>
          ) : (
          <form onSubmit={step === 5 ? handleVerifyOtpSubmit : nextStep}>
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-6 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-100 -z-0"></div>
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 1 ? 'bg-[#ff5500] text-white ring-4 ring-orange-50' : 'bg-slate-100 text-slate-400'}`}>1</div>
                  <span className={`text-[10px] font-semibold text-center ${step >= 1 ? 'text-[#ff5500]' : 'text-slate-500'}`}>Store / दुकान</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? 'bg-[#ff5500] text-white ring-4 ring-orange-50' : 'bg-slate-100 text-slate-400'}`}>2</div>
                  <span className={`text-[10px] font-semibold text-center ${step >= 2 ? 'text-[#ff5500]' : 'text-slate-500'}`}>Address / पता</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 3 ? 'bg-[#ff5500] text-white ring-4 ring-orange-50' : 'bg-slate-100 text-slate-400'}`}>3</div>
                  <span className={`text-[10px] font-semibold text-center ${step >= 3 ? 'text-[#ff5500]' : 'text-slate-500'}`}>Legal / दस्तावेज</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 4 ? 'bg-[#ff5500] text-white ring-4 ring-orange-50' : 'bg-slate-100 text-slate-400'}`}>4</div>
                  <span className={`text-[10px] font-semibold text-center ${step >= 4 ? 'text-[#ff5500]' : 'text-slate-500'}`}>Fee / शुल्क</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 5 ? 'bg-[#ff5500] text-white ring-4 ring-orange-50' : 'bg-slate-100 text-slate-400'}`}>5</div>
                  <span className={`text-[10px] font-semibold text-center ${step >= 5 ? 'text-[#ff5500]' : 'text-slate-500'}`}>Verify / ओटीपी</span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {resendSuccessMsg && (
              <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            {/* STEP 1: STORE & CREDENTIALS */}
            {step === 1 && (
              <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-100">
                  <div className="p-1.5 bg-orange-50 text-[#ff5500] rounded-lg"><Store size={18} /></div>
                  <h3 className="text-base font-bold text-slate-800 m-0">Store Information & Password <span className="font-semibold text-slate-500 text-sm">/ दुकान की जानकारी और पासवर्ड</span></h3>
                </div>

                {(refCodeFromUrl || formData.referralCode) && referrerName && !referralError && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Gift size={16} className="text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Referred by: <span className="font-bold text-emerald-900">{referrerName}</span>
                        <span className="font-mono font-bold tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded ml-1.5 text-[10px]">{formData.referralCode || refCodeFromUrl}</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-normal shrink-0">Referral Applied ✓</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="col-span-1 sm:col-span-2 flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Business / Store Name <span className="font-normal text-slate-500">/ व्यवसाय या दुकान का नाम</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="businessName" value={formData.businessName} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="e.g. Super Mart / जैसे: सुपर मार्ट" />
                  </div>
                  
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Owner Full Name <span className="font-normal text-slate-500">/ मालिक का पूरा नाम</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="Full name / पूरा नाम" />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Business Type <span className="font-normal text-slate-500">/ व्यवसाय का प्रकार</span>
                    </label>
                    <select name="businessType" value={formData.businessType} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all bg-white text-slate-800">
                      <option value="">Select Type / प्रकार चुनें</option>
                      <option value="Retail">Retail Store / खुदरा दुकान (रिटेल)</option>
                      <option value="Wholesale">Wholesale / थोक व्यापार (होलसेल)</option>
                      <option value="Manufacturer">Manufacturer / निर्माता (मैन्युफैक्चरर)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Registered Mobile Number <span className="font-normal text-slate-500">/ पंजीकृत मोबाइल नंबर</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required maxLength={10} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="10-digit mobile / 10 अंकों का नंबर" />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Email Address <span className="font-normal text-slate-500">/ ईमेल पता</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="store@example.com / स्टोर@उदाहरण.कॉम" />
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Create Password <span className="font-normal text-slate-500">/ पासवर्ड बनाएं</span> <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        minLength={6}
                        className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs"
                        placeholder="Min 6 chars / कम से कम 6 वर्ण"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Confirm Password <span className="font-normal text-slate-500">/ पासवर्ड की पुष्टि करें</span> <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        minLength={6}
                        className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs"
                        placeholder="Re-enter password / पासवर्ड दोबारा दर्ज करें"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Upload Store Logo or Image <span className="font-normal text-slate-500">/ दुकान का लोगो या फोटो अपलोड करें</span>
                    </label>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-[#ff5500] hover:file:bg-orange-100 cursor-pointer" />
                    <span className="text-[10.5px] text-slate-400 block mt-0.5">Upload business logo or storefront image (JPG, PNG) / व्यवसाय का लोगो या दुकान का फोटो अपलोड करें (JPG, PNG)</span>
                  </div>

                  {/* Referral Code (Optional) */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Referral Code (Optional) <span className="font-normal text-slate-500">/ रेफरल कोड (वैकल्पिक)</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        name="referralCode" 
                        value={formData.referralCode} 
                        onChange={(e) => {
                          setReferrerName('');
                          setReferralError('');
                          setFormData(prev => ({ ...prev, referralCode: e.target.value.toUpperCase() }));
                        }}
                        onBlur={() => validateReferralCode(formData.referralCode)}
                        className={`w-full pl-9 pr-9 py-2 border rounded-lg outline-none font-mono text-xs uppercase tracking-wider transition-all placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal placeholder:text-xs ${
                          referralError
                            ? 'border-rose-300 focus:border-rose-500'
                            : referrerName
                              ? 'border-emerald-300 focus:border-emerald-500'
                              : 'border-slate-200 focus:border-[#ff5500]'
                        }`}
                        placeholder="e.g. SELL12345" 
                      />
                      <Gift size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      {referralValidating && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                      )}
                    </div>
                    {referrerName && !referralError && (
                      <p className="text-[11px] text-emerald-600 font-medium mt-1">Referred by {referrerName}</p>
                    )}
                    {referralError && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{referralError}</p>
                    )}
                  </div>

                  {/* Store Categories Selection */}
                  <div className="col-span-1 sm:col-span-2 space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">
                        Store Product Categories <span className="font-normal text-slate-500">/ दुकान के उत्पाद की श्रेणियां</span> <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">Multiple allowed / एकाधिक चयन की अनुमति</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {availableCategories.map((cat) => {
                        const catLabel = typeof cat === 'string' ? cat : (cat.name || cat.label);
                        const isSelected = selectedCategories.includes(catLabel);
                        const bilingualCat = getCategoryBilingualLabel(catLabel);
                        return (
                          <div
                            key={catLabel}
                            onClick={() => toggleCategory(catLabel)}
                            className={`p-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all select-none ${
                              isSelected
                                ? 'bg-orange-50 border-[#ff5500] text-[#ff5500]'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                              isSelected ? 'bg-[#ff5500] border-[#ff5500] text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check size={9} strokeWidth={3} />}
                            </div>
                            <span className="truncate" title={bilingualCat}>{bilingualCat}</span>
                          </div>
                        );
                      })}
                    </div>
                    {selectedCategories.length === 0 ? (
                      <p className="text-[10.5px] text-amber-600 font-medium">Please select at least 1 category for your store. / कृपया अपनी दुकान के लिए कम से कम 1 श्रेणी चुनें।</p>
                    ) : (
                      <p className="text-[10.5px] text-emerald-600 font-semibold">{selectedCategories.length} category(s) selected / {selectedCategories.length} श्रेणी(यां) चयनित</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: ADDRESS */}
            {step === 2 && (
              <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><MapPin size={18} /></div>
                    <h3 className="text-base font-bold text-slate-800 m-0">Warehouse Address <span className="font-semibold text-slate-500 text-sm">/ वेयरहाउस का पता</span></h3>
                  </div>
                  <span className="text-[10.5px] font-semibold text-slate-400">Powered by Google Maps / गूगल मैप्स द्वारा संचालित</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button" 
                    disabled={gpsLoading}
                    onClick={handleGetGpsLocation}
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    <span>{gpsLoading ? 'Detecting GPS... / जीपीएस...' : 'Use Current GPS / वर्तमान जीपीएस'}</span>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setIsMapModalOpen(true)}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Search size={14} />
                    <span>Search on Map / मानचित्र पर खोजें</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="col-span-1 sm:col-span-2 flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Complete Address <span className="font-normal text-slate-500">/ पूरा पता</span> <span className="text-red-500">*</span>
                    </label>
                    <textarea name="completeAddress" value={formData.completeAddress} onChange={handleInputChange} required rows="2" className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all resize-none placeholder:text-slate-400 placeholder:text-xs" placeholder="Building, street address, locality... / भवन, सड़क का पता, इलाका..."></textarea>
                  </div>
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      City <span className="font-normal text-slate-500">/ शहर</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="city" value={formData.city} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="City / शहर" />
                  </div>
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      State <span className="font-normal text-slate-500">/ राज्य</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="state" value={formData.state} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="State / राज्य" />
                  </div>
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      PIN Code <span className="font-normal text-slate-500">/ पिन कोड</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="pincode" value={formData.pincode} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="6-digit PIN / 6 अंकों का पिन" />
                  </div>
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      Service Radius (km) <span className="font-normal text-slate-500">/ डिलीवरी दायरा (किमी)</span> <span className="text-red-500">*</span>
                    </label>
                    <input type="number" name="serviceRadius" value={formData.serviceRadius} onChange={handleInputChange} required min="1" className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" placeholder="e.g. 5 / जैसे: 5" />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: LEGAL DOCUMENTS */}
            {step === 3 && (
              <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-100">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><FileText size={18} /></div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 m-0">Legal Documents <span className="font-semibold text-slate-500 text-sm">/ कानूनी दस्तावेज</span></h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Upload business compliance & banking proof / व्यवसाय अनुपालन और बैंकिंग प्रमाण अपलोड करें</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="col-span-1 sm:col-span-2 space-y-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                    <label className="block text-xs font-bold text-slate-800">
                      GST Registration <span className="font-normal text-slate-500 text-[11px]">/ जीएसटी पंजीकरण (Optional / वैकल्पिक)</span>
                    </label>
                    <input 
                      type="text" 
                      name="gstNumber" 
                      value={formData.gstNumber} 
                      onChange={handleInputChange} 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs uppercase transition-all placeholder:text-slate-400 placeholder:text-xs" 
                      placeholder="e.g. 22AAAAA0000A1Z5 / जैसे: 22AAAAA0000A1Z5" 
                    />
                    
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">GST Certificate or Document Photo <span className="font-normal text-slate-500">/ जीएसटी प्रमाणपत्र या दस्तावेज का फोटो</span></span>
                      {formData.gstPhoto ? (
                        <div className="relative p-2 bg-white border border-emerald-200 rounded-lg flex items-center justify-between gap-2.5 shadow-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={formData.gstPhoto} alt="GST Preview" className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-emerald-700 truncate flex items-center gap-1">
                                <FileCheck size={13} className="text-emerald-600 shrink-0" /> GST Document Uploaded / अपलोड हो गया
                              </p>
                              <p className="text-[10.5px] text-slate-400 font-medium">Ready for verification / सत्यापन के लिए तैयार</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocFile('gstPhoto')}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors cursor-pointer border-none bg-transparent"
                            title="Remove GST document / जीएसटी दस्तावेज हटाएं"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 border-dashed rounded-lg cursor-pointer hover:bg-orange-50/40 hover:border-[#ff5500]/50 transition-all group">
                          <UploadCloud size={18} className="text-slate-400 group-hover:text-[#ff5500] transition-colors mb-0.5" />
                          <span className="text-xs font-bold text-slate-700 group-hover:text-[#ff5500]">Upload GST Certificate Photo / जीएसटी प्रमाणपत्र फोटो अपलोड करें</span>
                          <span className="text-[10px] text-slate-400">JPG, PNG or WebP up to 5MB / जेपीजी, पीएनजी या वेबपी (अधिकतम 5MB)</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleDocFileChange(e, 'gstPhoto')} 
                            className="hidden" 
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      PAN Number <span className="font-normal text-slate-500">/ पैन नंबर</span> <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      name="panNumber" 
                      value={formData.panNumber} 
                      onChange={handleInputChange} 
                      required 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs uppercase transition-all placeholder:text-slate-400 placeholder:text-xs" 
                      placeholder="e.g. ABCDE1234F / जैसे: ABCDE1234F" 
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 leading-snug">
                      FSSAI License <span className="font-normal text-slate-500">/ एफएसएसएआई लाइसेंस (Optional / वैकल्पिक)</span>
                    </label>
                    <input 
                      type="text" 
                      name="fssaiLicense" 
                      value={formData.fssaiLicense} 
                      onChange={handleInputChange} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] font-medium text-xs transition-all placeholder:text-slate-400 placeholder:text-xs" 
                      placeholder="14-digit License No. / 14 अंकों का नंबर" 
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 space-y-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                    <label className="block text-xs font-bold text-slate-800">
                      Bank Account Proof <span className="font-normal text-slate-500 text-[11px]">/ बैंक खाते का प्रमाण</span> <span className="text-[#ff5500]">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 -mt-0.5 font-medium leading-tight">Upload Bank Passbook front page or Cancelled Cheque photo / बैंक पासबुक या रद्द चेक (कैंसिल्ड चेक) का फोटो अपलोड करें</p>
                    
                    {formData.bankPassbookPhoto ? (
                      <div className="relative p-2 bg-white border border-emerald-200 rounded-lg flex items-center justify-between gap-2.5 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={formData.bankPassbookPhoto} alt="Passbook Preview" className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-700 truncate flex items-center gap-1">
                              <FileCheck size={13} className="text-emerald-600 shrink-0" /> Passbook or Cheque Uploaded / पासबुक या चेक अपलोड हो गया
                            </p>
                            <p className="text-[10.5px] text-slate-400 font-medium">Ready for banking verification / बैंक सत्यापन के लिए तैयार</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocFile('bankPassbookPhoto')}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors cursor-pointer border-none bg-transparent"
                          title="Remove bank passbook photo / बैंक पासबुक फोटो हटाएं"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 border-dashed rounded-lg cursor-pointer hover:bg-orange-50/40 hover:border-[#ff5500]/50 transition-all group">
                        <UploadCloud size={20} className="text-slate-400 group-hover:text-[#ff5500] transition-colors mb-0.5" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-[#ff5500]">Upload Bank Passbook or Cancelled Cheque / बैंक पासबुक या रद्द चेक अपलोड करें</span>
                        <span className="text-[10px] text-slate-400">JPG, PNG or WebP up to 5MB / जेपीजी, पीएनजी या वेबपी (अधिकतम 5MB)</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleDocFileChange(e, 'bankPassbookPhoto')} 
                          className="hidden" 
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: SELLER REGISTRATION FEE */}
            {step === 4 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-orange-50 text-[#ff5500] rounded-lg border border-orange-100">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 m-0">One-Time Registration Fee <span className="font-semibold text-slate-500 text-sm">/ एकमुश्त पंजीकरण शुल्क</span></h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Complete onboarding payment to activate account / अपना विक्रेता खाता सक्रिय करने के लिए ऑनबोर्डिंग भुगतान पूरा करें</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={fetchFeeConfig}
                    className="text-xs font-bold text-[#ff5500] hover:text-[#e64d00] flex items-center gap-1 cursor-pointer bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-md transition-colors border-none"
                  >
                    Refresh / रीफ्रेश
                  </button>
                </div>

                {feeConfig.loading ? (
                  <div className="py-8 flex flex-col items-center justify-center">
                    <Loader2 size={26} className="animate-spin text-[#ff5500] mb-1.5" />
                    <p className="text-xs text-slate-500 font-medium">Fetching fee configuration... / विन्यास प्राप्त किया जा रहा है...</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Dynamic Fee Card */}
                    <div className="relative overflow-hidden rounded-xl border-2 border-orange-200 bg-gradient-to-br from-white via-orange-50/20 to-orange-100/30 p-4 sm:p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold tracking-wide uppercase mb-1.5">
                            <Sparkles size={11} />
                            One-Time Onboarding Fee / एकमुश्त ऑनबोर्डिंग शुल्क
                          </div>
                          <h4 className="text-base sm:text-lg font-bold text-slate-900">Seller Registration Fee / विक्रेता पंजीकरण शुल्क</h4>
                          <p className="text-xs text-slate-600 mt-0.5 max-w-sm leading-snug">
                            {feeConfig.description || 'Mandatory one-time fee for business onboarding, KYC document verification, and platform access. / व्यवसाय ऑनबोर्डिंग, केवाईसी सत्यापन और प्लेटफ़ॉर्म एक्सेस के लिए एकमुश्त शुल्क।'}
                          </p>
                        </div>

                        <div className="text-right bg-white/90 backdrop-blur-xs p-3 rounded-lg border border-orange-100 shadow-2xs">
                          <span className="text-[10.5px] text-slate-400 font-bold uppercase block tracking-wider">Payable Now / अभी देय</span>
                          {feeConfig.isActive ? (
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-2xl font-black text-slate-900">
                                ₹{feeConfig.amount}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">one-time / एकमुश्त</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-emerald-600 font-bold">
                              <span className="text-xl font-black">₹0</span>
                              <span className="text-[11px] bg-emerald-100 px-2 py-0.5 rounded-full font-bold">Waived / माफ</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-orange-100/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                          <span className="text-[11px]">Identity & KYC Verification / केवाईसी सत्यापन</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                          <span className="text-[11px]">Lifetime Store Access / आजीवन स्टोर पहुंच</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                          <span className="text-[11px]">Zero Renewal / शून्य नवीनीकरण</span>
                        </div>
                      </div>
                    </div>

                    {/* Informational Notice */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                      <ShieldCheck size={16} className="text-orange-500 shrink-0 mt-0.5" />
                      <p className="m-0 leading-relaxed text-[11.5px] font-normal">
                        This registration fee is completely separate from any future store services or optional subscription plans. Once payment is verified, your account moves to the final OTP verification step. / यह पंजीकरण शुल्क भविष्य की स्टोर सेवाओं या वैकल्पिक सदस्यता योजनाओं से अलग है। भुगतान के बाद खाता अंतिम ओटीपी सत्यापन पर जाएगा।
                      </p>
                    </div>

                    {/* Payment Success Alert */}
                    {paymentSuccessMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-emerald-900 m-0 text-xs">Registration Payment Successful! / पंजीकरण भुगतान सफल रहा!</p>
                          <p className="font-normal text-emerald-700 m-0 text-[11px] mt-0.5">{paymentSuccessMsg}</p>
                        </div>
                      </div>
                    )}

                    {/* Payment Failed / Retry Alert */}
                    {paymentFailed && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-2.5 animate-in fade-in">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-rose-900 m-0 text-xs">
                              Payment failed. Your registration has not been completed. Please retry. / भुगतान विफल रहा। कृपया पुनः प्रयास करें।
                            </p>
                            {paymentErrorMessage && (
                              <p className="text-rose-700 font-medium m-0 mt-0.5 text-[11px]">{paymentErrorMessage}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={handleRetryPayment}
                            disabled={isRetryingPayment}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isRetryingPayment ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                Preparing Retry... / पुनः प्रयास...
                              </>
                            ) : (
                              <>
                                <RotateCcw size={13} />
                                Retry Payment Now (₹{feeConfig.amount}) / अभी पुनः भुगतान करें (₹{feeConfig.amount})
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: IN-FLOW OTP VERIFICATION SCREEN */}
            {step === 5 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 py-1">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 bg-orange-50 text-[#ff5500] rounded-full mx-auto flex items-center justify-center border border-orange-200 mb-1.5">
                    <ShieldCheck size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Verify Mobile Number <span className="font-semibold text-slate-500 text-base">/ मोबाइल नंबर सत्यापित करें</span></h3>
                  <p className="text-xs text-slate-500 font-normal">
                    Enter OTP sent to <strong className="font-semibold text-slate-800">+91 {formData.phone}</strong> <span className="text-slate-400">/ पर भेजा गया ओटीपी दर्ज करें</span>
                    <span className="ml-1.5 inline-block text-[11px] font-bold text-[#ea580c] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      Mock OTP: 123456
                    </span>
                  </p>
                </div>

                {/* 6 Digit OTP Boxes */}
                <div className="flex justify-between gap-1.5 py-1.5 max-w-xs mx-auto">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`seller-reg-otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="flex-1 min-w-0 aspect-square max-h-[44px] text-center text-lg font-bold text-slate-900 border border-slate-200 rounded-lg outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-orange-100 bg-slate-50 transition-all"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 font-normal max-w-xs mx-auto">
                  <span>Didn't receive code? / कोड नहीं मिला?</span>
                  <button
                    type="button"
                    disabled={isResendingOtp}
                    onClick={handleResendOtp}
                    className="text-[#ff5500] font-bold hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer disabled:opacity-50 text-xs"
                  >
                    <RotateCcw size={11} className={isResendingOtp ? 'animate-spin' : ''} />
                    {isResendingOtp ? 'Sending... / भेजा जा रहा है...' : 'Resend OTP / ओटीपी पुनः भेजें'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between gap-3">
              {step > 1 && step <= 4 ? (
                <button type="button" onClick={prevStep} disabled={isSubmitting} className="flex-1 py-2 px-3.5 border border-slate-200 rounded-xl shadow-2xs text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50">
                  Back / वापस
                </button>
              ) : step === 5 ? (
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-2 px-3.5 border border-slate-200 rounded-xl shadow-2xs text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors text-center cursor-pointer">
                  Edit Details / विवरण संपादित करें
                </button>
              ) : (
                <Link to="/seller/login" className="flex-1 py-2 px-3.5 border border-slate-200 rounded-xl shadow-2xs text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors text-center cursor-pointer">
                  Cancel / रद्द करें
                </Link>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting || isVerifyingOtp || (step === 5 && otp.join('').length < 6)}
                className="flex-1 py-2 px-3.5 border border-transparent rounded-xl shadow-2xs text-xs font-bold text-white bg-[#ff5500] hover:bg-[#e64d00] transition-colors cursor-pointer disabled:opacity-70 flex justify-center items-center gap-1.5"
              >
                {isSubmitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Processing... / प्रक्रिया जारी...</>
                ) : isVerifyingOtp ? (
                  <><Loader2 size={14} className="animate-spin" /> Verifying OTP... / सत्यापन जारी...</>
                ) : (
                  step === 4 ? (
                    feeConfig.isActive 
                      ? `Pay ₹${feeConfig.amount} & Continue / भुगतान करें (₹${feeConfig.amount})` 
                      : 'Continue (Waived) / आगे बढ़ें (माफ)'
                  ) : (step === 5 ? 'Verify OTP & Complete / पूर्ण करें' : 'Continue / आगे बढ़ें')
                )}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>

      {/* Google Maps Search Modal for Seller Warehouse */}
      <LocationSearchModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelect={handleMapLocationSelect}
        title="Select Warehouse Location / वेयरहाउस का स्थान चुनें"
        placeholder="Search warehouse building, industrial area, street, city... / वेयरहाउस भवन, औद्योगिक क्षेत्र, सड़क, शहर खोजें..."
        accentColor="#ff5500"
      />
      </div>
    </div>
  );
};

export default SellerRegister;

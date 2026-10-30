import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Bike, 
  Truck, 
  Check, 
  Camera, 
  RefreshCw, 
  Upload, 
  X, 
  Trash2, 
  UserCheck, 
  RotateCcw, 
  AlertCircle, 
  Sparkles,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  CreditCard,
  Banknote,
  Wallet,
  DollarSign,
  Gift
} from 'lucide-react';
import { authService, captainRegistrationFeeService, vehicleService } from '../../../services/authService';
import { loadRazorpaySdk } from '../../../utils/razorpay';

const FALLBACK_VEHICLE_TYPES = [
  { name: 'Motorcycle', capacity: 'Up to 20 kg', icon: 'bike' },
  { name: '3 Wheeler', capacity: 'Up to 500 kg', icon: 'truck' },
  { name: 'Mini Truck', capacity: 'Up to 750 kg', icon: 'truck' },
  { name: 'Pickup 8ft', capacity: 'Up to 1200 kg', icon: 'truck' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
import { uploadRegistrationImage } from '../../../utils/uploadRegistrationImage';

const VEHICLE_FIELD_CLASS =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d] placeholder:text-slate-400';

/**
 * Native type="date" does not show custom placeholders reliably.
 * Start as text with "dd-mm-yyyy", switch to date on focus so the picker still works.
 */
const DatePlaceholderInput = ({ name, value, onChange, className = VEHICLE_FIELD_CLASS }) => {
  const [inputType, setInputType] = useState(value ? 'date' : 'text');

  useEffect(() => {
    if (value) setInputType('date');
  }, [value]);

  return (
    <input
      type={inputType}
      name={name}
      value={value || ''}
      onChange={onChange}
      placeholder="dd-mm-yyyy"
      onFocus={() => setInputType('date')}
      onBlur={(e) => {
        if (!e.target.value) setInputType('text');
      }}
      className={className}
    />
  );
};

const CaptainRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCodeFromUrl = searchParams.get('ref') || '';
  const [formData, setFormData] = useState({
    // Personal Details
    fullName: '',
    mobileNumber: '',
    alternateMobile: '',
    email: '',
    dob: '',
    age: '',
    fatherName: '',

    // Address & Identity
    currentAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    pinCode: '',
    emergencyContact: '',
    aadhaarNumber: '',

    // Vehicle Details
    vehicleType: 'Motorcycle',
    drivingLicenseNumber: '',
    rcNumber: '',
    vehicleInsuranceNumber: '',
    insuranceValidTill: '',
    pucNumber: '',
    pucValidTill: '',
    permitNumber: '',
    permitValidTill: '',
    fitnessCertNumber: '',
    fitnessValidTill: '',
    roadTaxNumber: '',
    roadTaxValidTill: '',
    gpsEnabled: true,
    gpsDeviceId: '',

    // Bank Details
    panCardNumber: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',

    // Password
    password: '',
    confirmPassword: '',

    // Referral Code
    referralCode: (refCodeFromUrl || (typeof window !== 'undefined' ? sessionStorage.getItem('captain_referral_code') : '') || '').trim().toUpperCase(),
  });

  useEffect(() => {
    if (refCodeFromUrl) {
      sessionStorage.setItem('captain_referral_code', refCodeFromUrl.trim().toUpperCase());
      setFormData(prev => ({ ...prev, referralCode: refCodeFromUrl.trim().toUpperCase() }));
    } else {
      const savedRef = sessionStorage.getItem('captain_referral_code');
      if (savedRef) {
        setFormData(prev => ({ ...prev, referralCode: savedRef }));
      }
    }
  }, [refCodeFromUrl]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState(FALLBACK_VEHICLE_TYPES);
  const [registrationStep, setRegistrationStep] = useState('form'); // 'form' | 'payment' | 'otp' | 'under_review'

  useEffect(() => {
    // #46 — load admin-configured vehicle types
    vehicleService.getActiveVehicles()
      .then((res) => {
        const list = res?.vehicles || res?.data || (Array.isArray(res) ? res : []);
        if (!Array.isArray(list) || list.length === 0) return;
        const mapped = list
          .filter((v) => v && (v.isActive !== false) && (v.name || v.label || v.slug))
          .map((v) => ({
            name: v.name || v.label || v.slug,
            capacity: v.capacityLabel || v.capacity || v.description || '',
            icon: /bike|motor|scooter|2.?wheel/i.test(String(v.name || v.slug || '')) ? 'bike' : 'truck',
            slug: v.slug || '',
          }));
        if (mapped.length) {
          setVehicleTypes(mapped);
          setFormData((prev) => {
            if (mapped.some((m) => m.name === prev.vehicleType)) return prev;
            return { ...prev, vehicleType: mapped[0].name };
          });
        }
      })
      .catch(() => {});
  }, []);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');

  // Dynamic Captain Registration Fee States
  const [feeConfig, setFeeConfig] = useState({
    amount: 150,
    currency: 'INR',
    isActive: true,
    description: '',
    loading: true,
  });
  const [pendingCaptainId, setPendingCaptainId] = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState('');
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  // Fetch Registration Fee Config on Mount
  useEffect(() => {
    const fetchFeeConfig = async () => {
      try {
        setFeeConfig(prev => ({ ...prev, loading: true }));
        const res = await captainRegistrationFeeService.getPublicFeeConfig();
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
        console.warn('Could not fetch captain registration fee config:', err);
        setFeeConfig(prev => ({ ...prev, loading: false }));
      }
    };
    fetchFeeConfig();
  }, []);

  const [files, setFiles] = useState({
    drivingLicense: null,
    rcDocument: null,
    aadhaarFront: null,
    aadhaarBack: null,
    pucDocument: null,
    permitDocument: null,
    fitnessDocument: null,
    roadTaxDocument: null,
    form21Document: null,
    panCardDocument: null,
    profilePhoto: null,
    bankPassbook: null,
  });

  // Live Selfie & Camera States
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [cameraError, setCameraError] = useState('');
  const [capturedSelfiePreview, setCapturedSelfiePreview] = useState('');
  const [tempCapturedImage, setTempCapturedImage] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  /** 'uploading' | 'registering' — shown while submit is in progress */
  const [submitPhase, setSubmitPhase] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Stop camera tracks helper
  const stopTracks = (stream) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  useEffect(() => {
    return () => {
      stopTracks(cameraStream);
    };
  }, [cameraStream]);

  // Attach video stream whenever camera modal opens or stream changes
  useEffect(() => {
    if (isCameraModalOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => console.error('Video play error:', err));
    }
  }, [isCameraModalOpen, cameraStream, tempCapturedImage]);

  const startCamera = async (facing = cameraFacingMode) => {
    setCameraError('');
    setIsCameraModalOpen(true);
    setTempCapturedImage('');

    if (cameraStream) {
      stopTracks(cameraStream);
      setCameraStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            if (err.name !== 'AbortError') console.warn('Video play error:', err);
          });
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device found on your device.');
      } else {
        setCameraError('Could not start camera. Please check your camera permissions.');
      }
    }
  };

  const stopCamera = () => {
    stopTracks(cameraStream);
    setCameraStream(null);
    setIsCameraModalOpen(false);
    setTempCapturedImage('');
    setCameraError('');
  };

  const switchCamera = () => {
    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextMode);
    startCamera(nextMode);
  };

  const snapSelfie = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Mirror horizontal if user-facing for natural selfie
    if (cameraFacingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setTempCapturedImage(dataUrl);
  };

  const confirmSelfie = () => {
    if (tempCapturedImage) {
      setFiles((prev) => ({ ...prev, profilePhoto: tempCapturedImage }));
      setCapturedSelfiePreview(tempCapturedImage);
    }
    stopCamera();
  };

  const removeSelfie = () => {
    setFiles((prev) => ({ ...prev, profilePhoto: null }));
    setCapturedSelfiePreview('');
  };

  const handleTextChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [field]: file }));
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    const focusIdx = Math.min(pasted.length, 5);
    const targetInput = document.getElementById(`captain-reg-otp-${focusIdx}`);
    if (targetInput) targetInput.focus();
  };

  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < clean.length && index + i < 6; i++) {
        newOtp[index + i] = clean[i];
      }
      setOtp(newOtp);
      const nextIdx = Math.min(index + clean.length, 5);
      const nextInput = document.getElementById(`captain-reg-otp-${nextIdx}`);
      if (nextInput) nextInput.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);

    if (clean && index < 5) {
      const nextInput = document.getElementById(`captain-reg-otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`captain-reg-otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg('');
    setOtpSuccessMsg('');
    const cleanPhone = formData.mobileNumber.replace(/\D/g, '').slice(-10);
    try {
      setIsResendingOtp(true);
      await authService.sendCaptainOtp(cleanPhone, { purpose: 'register' });
      setOtpSuccessMsg('A new OTP has been sent to your registered mobile number.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setOtpSuccessMsg('');

    const enteredOtp = otp.join('').trim();
    if (enteredOtp.length < 6) {
      setErrorMsg('Please enter the complete 6-digit OTP');
      return;
    }

    const cleanPhone = formData.mobileNumber.replace(/\D/g, '').slice(-10);

    try {
      setIsVerifyingOtp(true);
      const res = await authService.verifyCaptainOtp(cleanPhone, enteredOtp);

      if (res.success || res.accountStatus === 'under_review') {
        setRegistrationStep('under_review');
      } else {
        setErrorMsg(res.message || 'Verification failed. Please try again.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'OTP verification failed.';
      setErrorMsg(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Launch Razorpay Checkout for Captain Registration Fee
  const handleLaunchRazorpayCheckout = async (orderData) => {
    const isLoaded = await loadRazorpaySdk();
    if (!isLoaded || !window.Razorpay) {
      setPaymentFailed(true);
      setPaymentErrorMessage('Razorpay SDK failed to load. Please check your internet connection and retry.');
      return;
    }

    const options = {
      key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
      amount: Math.round(orderData.amount * 100),
      currency: orderData.currency || 'INR',
      name: 'Sathi Seller Delivery Fleet',
      description: `Captain Registration & Onboarding Fee (₹${orderData.amount})`,
      order_id: orderData.orderId,
      handler: async function (response) {
        try {
          setIsSubmitting(true);
          setPaymentErrorMessage('');
          const verifyPayload = {
            captainId: orderData.captainId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          };
          const verifyRes = await captainRegistrationFeeService.verifyPayment(verifyPayload);
          if (verifyRes && verifyRes.success) {
            setOtpSuccessMsg(`Payment of ₹${orderData.amount} received successfully! Please verify your mobile number with the OTP.`);
            setPaymentFailed(false);
            setRegistrationStep('otp');
          } else {
            setPaymentFailed(true);
            setPaymentErrorMessage(verifyRes?.message || 'Payment verification failed. Please retry.');
          }
        } catch (err) {
          setPaymentFailed(true);
          setPaymentErrorMessage(err.response?.data?.message || err.message || 'Payment verification error.');
        } finally {
          setIsSubmitting(false);
        }
      },
      modal: {
        ondismiss: function () {
          setIsSubmitting(false);
          setPaymentFailed(true);
          setPaymentErrorMessage('Payment was cancelled or closed. Your application details are saved. Please complete payment to proceed.');
        },
      },
      prefill: {
        name: formData.fullName,
        email: formData.email,
        contact: formData.mobileNumber,
      },
      theme: {
        color: '#15803d',
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      setPaymentFailed(true);
      setPaymentErrorMessage(resp.error?.description || 'Payment failed. Please try again.');
    });
    rzp.open();
  };

  // Retry payment handler
  const handleRetryPayment = async () => {
    try {
      setIsRetryingPayment(true);
      setPaymentErrorMessage('');
      const cleanPhone = formData.mobileNumber.replace(/\D/g, '').slice(-10);
      const res = await captainRegistrationFeeService.retryOrder({
        captainId: pendingCaptainId,
        phone: cleanPhone,
      });

      if (res && res.alreadyPaid) {
        setRegistrationStep('otp');
        return;
      }

      if (res && res.orderId) {
        setPendingOrderData(res);
        setPendingCaptainId(res.captainId);
        await handleLaunchRazorpayCheckout(res);
      } else {
        setPaymentErrorMessage(res?.message || 'Unable to initialize retry payment.');
      }
    } catch (err) {
      setPaymentErrorMessage(err.response?.data?.message || 'Failed to retry payment. Please try again.');
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const REQUIRED_DOCUMENTS = [
    { key: 'profilePhoto', label: 'Live Selfie / Profile Photo' },
    { key: 'drivingLicense', label: 'Driving License' },
    { key: 'aadhaarFront', label: 'Aadhaar Front' },
    { key: 'aadhaarBack', label: 'Aadhaar Back' },
    { key: 'rcDocument', label: 'RC Document' },
    { key: 'bankPassbook', label: 'Bank Passbook Photo' },
  ];

  const OPTIONAL_DOCUMENTS = [
    { key: 'pucDocument', label: 'Pollution (PUC) Certificate' },
    { key: 'permitDocument', label: 'Commercial Vehicle Permit' },
    { key: 'fitnessDocument', label: 'Fitness Certificate' },
    { key: 'roadTaxDocument', label: 'Road Tax Receipt' },
    { key: 'form21Document', label: 'Form-21' },
    { key: 'panCardDocument', label: 'PAN Card', payloadKey: 'panCard' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');
    setPaymentErrorMessage('');
    setPaymentFailed(false);

    if (!formData.fullName?.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }

    const cleanPhone = formData.mobileNumber.replace(/\D/g, '').slice(-10);
    if (!PHONE_REGEX.test(cleanPhone)) {
      setErrorMsg('Please enter a valid 10-digit mobile number starting with 6–9.');
      return;
    }

    if (formData.email?.trim() && !EMAIL_REGEX.test(formData.email.trim())) {
      setErrorMsg('Please enter a valid email address, or leave it blank.');
      return;
    }

    if (formData.pinCode && !PINCODE_REGEX.test(String(formData.pinCode).trim())) {
      setErrorMsg('Please enter a valid 6-digit PIN code.');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    const cleanAadhaar = String(formData.aadhaarNumber || '').replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      setErrorMsg('Please enter a valid 12-digit Aadhaar card number.');
      return;
    }

    if (formData.ifscCode?.trim() && !IFSC_REGEX.test(String(formData.ifscCode).trim().toUpperCase())) {
      setErrorMsg('Please enter a valid IFSC code (e.g. SBIN0001234), or leave it blank.');
      return;
    }

    const emergency = String(formData.emergencyContact || '').replace(/\D/g, '').slice(-10);
    if (formData.emergencyContact && !PHONE_REGEX.test(emergency)) {
      setErrorMsg('Please enter a valid 10-digit emergency contact number.');
      return;
    }

    if (!formData.vehicleType?.trim()) {
      setErrorMsg('Please select a vehicle type.');
      return;
    }

    const missingDocs = REQUIRED_DOCUMENTS.filter((doc) => !files[doc.key]);
    if (missingDocs.length > 0) {
      setErrorMsg(
        `Please upload all required documents: ${missingDocs.map((d) => d.label).join(', ')}.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitPhase('uploading');
    try {
      // Upload via /api/upload first (parallel — sequential was very slow with many docs).
      const CAPTAIN_DOC_COMPRESS = { maxWidth: 1024, quality: 0.65 };
      const allDocs = [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS];
      const docsToUpload = allDocs.filter((doc) => files[doc.key]);

      const uploadResults = await Promise.all(
        docsToUpload.map(async (doc) => {
          const payloadKey = doc.payloadKey || doc.key;
          try {
            const url = await uploadRegistrationImage(
              files[doc.key],
              'misc',
              CAPTAIN_DOC_COMPRESS
            );
            return { payloadKey, url };
          } catch (err) {
            const apiMsg = err.response?.data?.message || err.message || 'Upload failed';
            throw new Error(`${doc.label}: ${apiMsg}`);
          }
        })
      );

      const documentUrls = Object.fromEntries(
        uploadResults.map(({ payloadKey, url }) => [payloadKey, url])
      );

      setSubmitPhase('registering');

      const payload = {
        ...formData,
        aadhaarNumber: cleanAadhaar,
        mobileNumber: cleanPhone,
        documents: documentUrls,
      };

      const res = await captainRegistrationFeeService.initiateOrder(payload);

      if (res && res.success) {
        if (res.registrationFeeRequired && res.orderId) {
          setPendingCaptainId(res.captainId);
          setPendingOrderData(res);
          setRegistrationStep('payment');
          await handleLaunchRazorpayCheckout(res);
        } else {
          // Fee is inactive, ₹0, or waived
          setRegistrationStep('otp');
        }
      } else {
        setErrorMsg(res?.message || 'Failed to submit registration');
      }
    } catch (err) {
      console.error('API submission failed:', err);
      if (err.response?.status === 413) {
        setErrorMsg('Uploaded documents are too large for the server. Please use clearer, smaller photos (or PDF under 10MB) and try again.');
      } else {
        setErrorMsg(err.response?.data?.message || err.message || 'Failed to submit registration application.');
      }
    } finally {
      setIsSubmitting(false);
      setSubmitPhase(null);
    }
  };

  const submitButtonBusyLabel =
    submitPhase === 'uploading'
      ? 'Uploading documents…'
      : submitPhase === 'registering'
        ? 'Submitting application…'
        : 'Submitting Application...';

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* #16 sticky registration header */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80 px-4 py-3">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/captain/login')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-xs"
          >
            <ArrowLeft size={15} />
            <span>Back to Login</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img src="/DeliveryLogo.png" alt="Sathi Seller" className="h-9 object-contain" />
            <span className="text-sm font-bold text-[#002625] truncate hidden sm:inline">Captain Registration</span>
          </div>
        </div>
      </div>

      <div className="flex-1 py-8 px-4 md:px-8 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-8">
          <img src="/DeliveryLogo.png" alt="Sathi Seller Logo" className="h-16 object-contain mb-3" />
          <h1 className="text-2xl font-bold text-[#002625]">Captain Registration</h1>
          <p className="text-xs text-slate-500 text-center mt-1">
            Fill in your details and document verification to register as a Captain.
          </p>
        </div>

        {registrationStep === 'under_review' ? (
          <div className="text-center py-10 space-y-6">
            <div className="w-20 h-20 bg-emerald-50 text-[#15803d] rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200 animate-pulse">
              <ShieldCheck size={44} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-[#002625]">Registration Successful!</h2>
              <p className="text-base font-semibold text-emerald-700">Your Account is Currently Under Review</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed pt-1">
                Your captain registration application and documents have been submitted and your mobile number is verified. Once the Sathi Seller admin team approves your account, you will be able to log in using your registered mobile number and password.
              </p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 max-w-md mx-auto text-left flex items-start gap-3">
              <CheckCircle2 size={20} className="text-[#15803d] shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950 space-y-1">
                <p className="font-bold">Next Steps:</p>
                <p className="text-emerald-800 leading-relaxed">
                  Verification usually takes 24–48 hours. Our team will review your driving license, RC, and background details. Once approved, you can directly log in with your password.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/captain/login')}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#97fc43] hover:bg-[#86e835] text-[#002625] font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer"
              >
                Go to Captain Login
              </button>
            </div>
          </div>
        ) : registrationStep === 'payment' ? (
          /* 💳 REGISTRATION FEE PAYMENT STEP */
          <div className="py-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-50 text-[#15803d] rounded-2xl mx-auto flex items-center justify-center border border-emerald-200 mb-2 shadow-xs">
                <CreditCard size={32} />
              </div>
              <h2 className="text-xl font-bold text-[#002625]">Captain Registration Fee</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your registration application is saved. Please complete the one-time registration fee payment to proceed with verification.
              </p>
            </div>

            {/* Payment Summary Box */}
            <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 border border-emerald-200 rounded-3xl p-6 shadow-sm space-y-4 max-w-md mx-auto">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registration Amount</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                    ₹{pendingOrderData?.amount || feeConfig.amount || 150}
                  </h3>
                </div>
                <div className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-full flex items-center gap-1">
                  <ShieldCheck size={13} />
                  <span>One-Time Fee</span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Background & Driving License Verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Delivery Partner ID Card & Welcome Kit</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Accidental Insurance & Instant Order Allocation</span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 bg-white/80 rounded-xl p-3 border border-emerald-100/60 flex items-center justify-between">
                <span>Payment Gateway</span>
                <span className="font-bold text-slate-700">Razorpay (Cards / UPI / NetBanking)</span>
              </div>
            </div>

            {paymentErrorMessage && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800 flex items-start gap-2.5 max-w-md mx-auto">
                <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <span>{paymentErrorMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setRegistrationStep('form')}
                className="order-2 sm:order-1 sm:w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
              >
                <ArrowLeft size={15} />
                <span>Edit Details</span>
              </button>

              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={isRetryingPayment || isSubmitting}
                className="order-1 sm:order-2 flex-1 py-3.5 bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRetryingPayment || isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard size={16} /> Pay ₹{pendingOrderData?.amount || feeConfig.amount || 150} & Continue
                  </>
                )}
              </button>
            </div>
          </div>
        ) : registrationStep === 'otp' ? (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-50 text-[#15803d] rounded-full mx-auto flex items-center justify-center border border-emerald-200 mb-1">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-xl font-bold text-[#002625]">Verify Your Mobile Number</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                We sent a 6-digit OTP to <strong className="text-slate-800">+91 {formData.mobileNumber}</strong> to complete your application.
                <span className="ml-1.5 inline-block text-[11px] font-bold text-[#15803d] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Mock OTP: 123456
                </span>
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {otpSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2.5">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              {/* 6 Digit OTP Boxes */}
              <div className="flex justify-between gap-2 py-1 max-w-sm mx-auto" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`captain-reg-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="flex-1 min-w-0 aspect-square max-h-[52px] text-center text-xl font-bold text-slate-900 border border-slate-200 rounded-xl outline-none focus:border-[#15803d] focus:ring-2 focus:ring-emerald-100 bg-slate-50 transition-all"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 max-w-sm mx-auto">
                <span>Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResendingOtp}
                  className="text-[#15803d] font-bold hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  {isResendingOtp ? 'Resending...' : 'Resend OTP'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => setRegistrationStep('form')}
                  className="order-2 sm:order-1 sm:w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
                >
                  <ArrowLeft size={15} />
                  <span>Edit Form</span>
                </button>

                <button
                  type="submit"
                  disabled={isVerifyingOtp || otp.join('').length < 6}
                  className="order-1 sm:order-2 flex-1 py-3.5 bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Verify OTP & Finish
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Referral Applied Banner */}
            {(refCodeFromUrl || formData.referralCode) && (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Gift size={16} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Referred by Captain</span>
                    <span className="font-mono text-xs font-black text-emerald-950 bg-emerald-100/90 px-2 py-0.5 rounded tracking-wider">
                      {formData.referralCode || refCodeFromUrl}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/60 px-2.5 py-1 rounded-full">
                  Applied ✓
                </span>
              </div>
            )}

            {/* Dynamic Registration Fee Banner */}
            {!feeConfig.loading && feeConfig.isActive && feeConfig.amount > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">Registration & Onboarding Fee</span>
                      <span className="text-[10px] bg-emerald-200/70 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                        ₹{feeConfig.amount}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {feeConfig.description || 'One-time fee for onboarding and verification payable upon completing the form.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 1. PERSONAL DETAILS */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b pb-2 border-slate-100">
                Personal Details
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input
                  required
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleTextChange}
                  placeholder="Enter full name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mobile Number *</label>
                  <input
                    required
                    type="tel"
                    maxLength={10}
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleTextChange}
                    placeholder="Enter mobile number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Alternate Mobile</label>
                  <input
                    type="tel"
                    maxLength={10}
                    name="alternateMobile"
                    value={formData.alternateMobile}
                    onChange={handleTextChange}
                    placeholder="Enter alternate mobile"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email ID</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleTextChange}
                  placeholder="Enter email id"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleTextChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleTextChange}
                    placeholder="Enter age"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Father's Name</label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleTextChange}
                  placeholder="Enter father's name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>
            </div>


            {/* 2. ADDRESS & IDENTITY DETAILS */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b pb-2 border-slate-100">
                Address & Identity Details
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Current Address</label>
                <input
                  type="text"
                  name="currentAddress"
                  value={formData.currentAddress}
                  onChange={handleTextChange}
                  placeholder="Enter current address"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Permanent Address</label>
                <input
                  type="text"
                  name="permanentAddress"
                  value={formData.permanentAddress}
                  onChange={handleTextChange}
                  placeholder="Enter permanent address"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleTextChange}
                    placeholder="Enter city"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleTextChange}
                    placeholder="Enter state"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">PIN Code</label>
                  <input
                    type="text"
                    name="pinCode"
                    value={formData.pinCode}
                    onChange={handleTextChange}
                    placeholder="Enter pin code"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Emergency Contact Number</label>
                <input
                  type="tel"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleTextChange}
                  placeholder="Enter emergency contact number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Aadhaar Card Number <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  name="aadhaarNumber"
                  value={formData.aadhaarNumber}
                  onChange={handleTextChange}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="Enter 12-digit Aadhaar card number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>
            </div>


            {/* 3. VEHICLE & DRIVING DETAILS */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b pb-2 border-slate-100">
                Vehicle & Driving Details
              </h2>

              {/* Vehicle Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Select Vehicle Type <span className="text-red-500">*</span></span>
                  <span className="text-[11px] font-bold text-[#15803d]">{formData.vehicleType || 'Motorcycle'}</span>
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  {vehicleTypes.map((v) => {
                    const isSelected = formData.vehicleType === v.name;
                    const VehicleIcon = v.icon === 'bike' ? Bike : Truck;
                    return (
                      <div
                        key={v.name}
                        onClick={() => setFormData((prev) => ({ ...prev, vehicleType: v.name }))}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#15803d] bg-emerald-50/40 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-emerald-100 text-[#15803d]' : 'bg-slate-100 text-slate-600'}`}>
                            <VehicleIcon size={18} />
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#15803d] text-white flex items-center justify-center">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-800 m-0">{v.name}</h4>
                          <p className="text-[10.5px] font-medium text-slate-500 m-0 mt-0.5">{v.capacity}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Driving License Number</label>
                <input
                  type="text"
                  name="drivingLicenseNumber"
                  value={formData.drivingLicenseNumber || ''}
                  onChange={handleTextChange}
                  placeholder="Enter driving license number"
                  className={VEHICLE_FIELD_CLASS}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">RC Number</label>
                <input
                  type="text"
                  name="rcNumber"
                  value={formData.rcNumber || ''}
                  onChange={handleTextChange}
                  placeholder="Enter rc number"
                  className={VEHICLE_FIELD_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Vehicle Insurance Number</label>
                  <input
                    type="text"
                    name="vehicleInsuranceNumber"
                    value={formData.vehicleInsuranceNumber || ''}
                    onChange={handleTextChange}
                    placeholder="Enter vehicle insurance number"
                    className={VEHICLE_FIELD_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Insurance Valid Till</label>
                  <DatePlaceholderInput
                    name="insuranceValidTill"
                    value={formData.insuranceValidTill}
                    onChange={handleTextChange}
                  />
                </div>
              </div>

              {/* 1. Pollution (PUC) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pollution (PUC) Certificate No.</label>
                  <input
                    type="text"
                    name="pucNumber"
                    value={formData.pucNumber || ''}
                    onChange={handleTextChange}
                    placeholder="Enter PUC number"
                    className={VEHICLE_FIELD_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">PUC Valid Till</label>
                  <DatePlaceholderInput
                    name="pucValidTill"
                    value={formData.pucValidTill}
                    onChange={handleTextChange}
                  />
                </div>
              </div>

              {/* 2. Vehicle Permit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Commercial / Goods Permit No.</label>
                  <input
                    type="text"
                    name="permitNumber"
                    value={formData.permitNumber || ''}
                    onChange={handleTextChange}
                    placeholder="Enter permit number"
                    className={VEHICLE_FIELD_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Permit Valid Till</label>
                  <DatePlaceholderInput
                    name="permitValidTill"
                    value={formData.permitValidTill}
                    onChange={handleTextChange}
                  />
                </div>
              </div>

              {/* 3. Fitness Certificate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Fitness Certificate Number</label>
                  <input
                    type="text"
                    name="fitnessCertNumber"
                    value={formData.fitnessCertNumber || ''}
                    onChange={handleTextChange}
                    placeholder="Enter fitness certificate number"
                    className={VEHICLE_FIELD_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Fitness Valid Till</label>
                  <DatePlaceholderInput
                    name="fitnessValidTill"
                    value={formData.fitnessValidTill}
                    onChange={handleTextChange}
                  />
                </div>
              </div>

              {/* 4. Road Tax Receipt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Road Tax Receipt / Challan No.</label>
                  <input
                    type="text"
                    name="roadTaxNumber"
                    value={formData.roadTaxNumber || ''}
                    onChange={handleTextChange}
                    placeholder="Enter road tax receipt number"
                    className={VEHICLE_FIELD_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Road Tax Valid Till</label>
                  <DatePlaceholderInput
                    name="roadTaxValidTill"
                    value={formData.roadTaxValidTill}
                    onChange={handleTextChange}
                  />
                </div>
              </div>

              {/* 📍 GPS Tracking Device */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📍</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 m-0">Vehicle GPS Tracking System</h4>
                      <p className="text-[11px] text-slate-500 m-0">Is your vehicle equipped with active GPS tracking?</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="gpsEnabled"
                      checked={formData.gpsEnabled}
                      onChange={handleTextChange}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#15803d]"></div>
                  </label>
                </div>

                {formData.gpsEnabled && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-bold text-slate-700">GPS Device ID / IMEI Number (Optional)</label>
                    <input
                      type="text"
                      name="gpsDeviceId"
                      value={formData.gpsDeviceId}
                      onChange={handleTextChange}
                      placeholder="e.g. GPS-8829103984 or IMEI"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                    />
                  </div>
                )}
              </div>

            </div>


            {/* 4. DOCUMENT UPLOADS & IDENTITY VERIFICATION */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center justify-between">
                <span>Document Uploads & Verification</span>
                <span className="text-[10px] font-semibold text-slate-400 capitalize">Identity & Permits</span>
              </h2>

              {/* 📸 LIVE CAPTAIN SELFIE VERIFICATION */}
              <div className="bg-gradient-to-br from-emerald-50/70 via-slate-50 to-emerald-50/40 border-2 border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#15803d] text-white flex items-center justify-center shadow-sm shrink-0">
                      <Camera size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider m-0">
                          Live Captain Selfie <span className="text-red-500">*</span>
                        </h3>
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Required for KYC
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 m-0">
                        Take a clear live front-facing photo of yourself for identity verification.
                      </p>
                    </div>
                  </div>

                  {capturedSelfiePreview && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                      <Check size={12} strokeWidth={3} /> Attached
                    </span>
                  )}
                </div>

                {/* Selfie Preview or Camera/Upload Trigger */}
                {capturedSelfiePreview ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-2xl border border-emerald-200/90 shadow-2xs">
                    <div className="relative group shrink-0">
                      <img
                        src={capturedSelfiePreview}
                        alt="Captain Live Selfie"
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm"
                      />
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#15803d] text-white rounded-full flex items-center justify-center shadow-sm">
                        <Check size={13} strokeWidth={3} />
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-1.5 m-0">
                          <UserCheck size={15} className="text-[#15803d]" />
                          Live Selfie Photo Ready
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 m-0">
                          Your photo has been captured and attached to your onboarding application.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#15803d] text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw size={13} /> Retake Selfie
                        </button>
                        <button
                          type="button"
                          onClick={removeSelfie}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Live Camera Action Button Only */}
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="w-full py-3.5 px-4 bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-98"
                    >
                      <Camera size={18} />
                      <span>Take Live Selfie (Camera)</span>
                    </button>

                    {/* Guidelines */}
                    <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-2.5 flex items-center gap-2.5 text-[11px] text-slate-600">
                      <Sparkles size={15} className="text-emerald-600 shrink-0" />
                      <span>Look directly at the camera in good lighting. Please avoid wearing masks or sunglasses.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Driving License Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Upload Driving License <span className="text-red-500">*</span></label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-slate-400">upload</span>
                  <span className="text-xs font-bold text-slate-600 truncate">
                    {files.drivingLicense ? files.drivingLicense.name : 'TAP TO UPLOAD DRIVING LICENSE'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'drivingLicense')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Aadhaar Front & Back Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Aadhaar Front <span className="text-red-500">*</span></label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-slate-400">upload</span>
                    <span className="text-xs font-bold text-slate-600 truncate">
                      {files.aadhaarFront ? files.aadhaarFront.name : 'TAP TO UPLOAD'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'aadhaarFront')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Aadhaar Back <span className="text-red-500">*</span></label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-slate-400">upload</span>
                    <span className="text-xs font-bold text-slate-600 truncate">
                      {files.aadhaarBack ? files.aadhaarBack.name : 'TAP TO UPLOAD'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'aadhaarBack')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* RC Document Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">RC Document (Registration Certificate) <span className="text-red-500">*</span></label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-slate-400">upload</span>
                  <span className="text-xs font-bold text-slate-600 truncate">
                    {files.rcDocument ? files.rcDocument.name : 'TAP TO UPLOAD RC'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'rcDocument')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 1. Pollution (PUC) & 2. Vehicle Permit Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Pollution (PUC) Certificate</label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-slate-400">upload</span>
                    <span className="text-xs font-bold text-slate-600 truncate">
                      {files.pucDocument ? files.pucDocument.name : 'TAP TO UPLOAD PUC'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'pucDocument')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Commercial Vehicle Permit</label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-slate-400">upload</span>
                    <span className="text-xs font-bold text-slate-600 truncate">
                      {files.permitDocument ? files.permitDocument.name : 'TAP TO UPLOAD PERMIT'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'permitDocument')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* 3. Fitness Certificate & 4. Road Tax Receipt Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Fitness Certificate</label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-slate-400">upload</span>
                    <span className="text-xs font-bold text-slate-600 truncate">
                      {files.fitnessDocument ? files.fitnessDocument.name : 'TAP TO UPLOAD FITNESS'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'fitnessDocument')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Road Tax Receipt</label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-slate-400">upload</span>
                    <span className="text-xs font-bold text-slate-600 truncate">
                      {files.roadTaxDocument ? files.roadTaxDocument.name : 'TAP TO UPLOAD ROAD TAX'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'roadTaxDocument')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* 5. Form-21 (Sale Certificate) Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Form-21 (Sale / Manufacturer Certificate)</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-slate-400">upload</span>
                  <span className="text-xs font-bold text-slate-600 truncate">
                    {files.form21Document ? files.form21Document.name : 'TAP TO UPLOAD FORM-21'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'form21Document')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* PAN Card Document Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Upload PAN Card Document (Optional)</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-slate-400">upload</span>
                  <span className="text-xs font-bold text-slate-600 truncate">
                    {files.panCardDocument ? files.panCardDocument.name : 'TAP TO UPLOAD PAN CARD'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'panCardDocument')}
                    className="hidden"
                  />
                </label>
              </div>

            </div>


            {/* 5. BANK DETAILS */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b pb-2 border-slate-100">
                Bank Details
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">PAN Card Number</label>
                <input
                  type="text"
                  name="panCardNumber"
                  value={formData.panCardNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, panCardNumber: e.target.value.toUpperCase() }))}
                  placeholder="Enter 10-digit PAN card number (e.g. ABCDE1234F)"
                  maxLength={10}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 uppercase outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleTextChange}
                  placeholder="Enter bank name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Account Holder Name</label>
                <input
                  type="text"
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleTextChange}
                  placeholder="Enter account holder name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleTextChange}
                  placeholder="Enter account number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">IFSC Code</label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleTextChange}
                    placeholder="Enter ifsc code"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Branch Name</label>
                  <input
                    type="text"
                    name="branchName"
                    value={formData.branchName}
                    onChange={handleTextChange}
                    placeholder="Enter branch name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Bank Passbook Photo <span className="text-red-500">*</span></label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-4 px-3 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-slate-400">upload</span>
                  <span className="text-xs font-bold text-slate-600 truncate">
                    {files.bankPassbook ? files.bankPassbook.name : 'TAP TO UPLOAD BANK PASSBOOK PHOTO'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'bankPassbook')}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">UPI ID (Optional)</label>
                <input
                  type="text"
                  name="upiId"
                  value={formData.upiId}
                  onChange={handleTextChange}
                  placeholder="Enter upi id (optional)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d]"
                />
              </div>
            </div>

            {/* 6. ACCOUNT SECURITY & PASSWORD SETUP */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center justify-between">
                <span>Account Security & Password</span>
                <span className="text-[10px] font-semibold text-slate-400">Used for Login</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Create Password *</label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleTextChange}
                      placeholder="Min 6 characters"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirm Password *</label>
                  <div className="relative">
                    <input
                      required
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleTextChange}
                      placeholder="Re-enter password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-[#15803d] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 m-0">You will use your registered mobile number and this password to log in to your Captain account once approved.</p>
            </div>

            {/* Error Message Display */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Referral Code (Optional) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Gift size={15} className="text-[#15803d]" />
                <span>Referral Code (Optional)</span>
              </label>
              <input
                type="text"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleTextChange}
                placeholder="e.g. CAP12345"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-slate-800 outline-none focus:border-[#15803d] placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
              />
            </div>

            {/* Submit & Back Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate('/captain/login')}
                className="order-2 sm:order-1 sm:w-1/3 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="order-1 sm:order-2 flex-1 py-4 bg-[#ea580c] hover:bg-[#c2410c] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg transition-all transform active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {submitButtonBusyLabel}
                  </>
                ) : feeConfig.isActive && feeConfig.amount > 0 ? (
                  <>
                    <CreditCard size={18} /> Proceed & Pay ₹{feeConfig.amount}
                  </>
                ) : (
                  'Submit & Verify Mobile'
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/captain/login')}
                  className="text-[#15803d] font-bold hover:underline cursor-pointer"
                >
                  Log In Here
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
      </div>

      {/* 📷 LIVE SELFIE CAMERA MODAL */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/70 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Camera size={18} className="text-emerald-400" />
                <span className="font-bold text-xs">Live Captain Selfie Capture</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!tempCapturedImage && !cameraError && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    title="Switch Camera (Front/Back)"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                  >
                    <RefreshCw size={14} />
                    <span className="hidden sm:inline">Flip</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Viewfinder / Preview Area */}
            <div className="relative bg-black flex items-center justify-center min-h-[340px] max-h-[420px] overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center space-y-3 max-w-xs">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-200">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-md mx-auto"
                  >
                    <RotateCcw size={14} /> Try Again
                  </button>
                </div>
              ) : tempCapturedImage ? (
                /* Snapped Photo Preview */
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={tempCapturedImage}
                    alt="Captured Selfie"
                    className="w-full h-auto max-h-[380px] object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                    <Check size={12} strokeWidth={3} /> Photo Captured
                  </div>
                </div>
              ) : (
                /* Live Camera Stream with Face Oval Guide */
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-auto max-h-[380px] object-cover ${cameraFacingMode === 'user' ? '-scale-x-100' : ''}`}
                  />

                  {/* Oval Face Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                    <div className="w-48 h-60 sm:w-56 sm:h-72 border-2 border-dashed border-emerald-400/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-emerald-300/90 bg-black/60 px-2 py-0.5 rounded-full">
                        Fit Face Here
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-slate-300 font-medium whitespace-nowrap">
                    Keep your head centered & look at camera
                  </div>
                </div>
              )}
            </div>

            {/* Modal Controls / Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              {tempCapturedImage ? (
                /* Confirm / Retake Controls */
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTempCapturedImage('')}
                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={14} /> Retake
                  </button>
                  <button
                    type="button"
                    onClick={confirmSelfie}
                    className="flex-1 py-3 px-4 bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <Check size={15} strokeWidth={3} /> Use This Photo
                  </button>
                </div>
              ) : !cameraError ? (
                /* Shutter Button */
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={snapSelfie}
                    className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 p-1 flex items-center justify-center shadow-lg transition-transform transform active:scale-90 cursor-pointer"
                  >
                    <div className="w-13 h-13 rounded-full border-2 border-slate-900 bg-[#15803d] flex items-center justify-center text-white">
                      <Camera size={22} />
                    </div>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
};

export default CaptainRegister;

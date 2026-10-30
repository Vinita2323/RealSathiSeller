import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import DeliveryMap from '../components/DeliveryMap';
import TransportPhotoUploader from '../components/TransportPhotoUploader';
import { captainService, returnService } from '../../../services/authService';
import { transportService } from '../../../services/transportService';
import RatingModal from '../../../components/RatingModal';
import { geocodeAddress, getCurrentLocation, calculateDistanceKm } from '../../../utils/geocodeUtils';

const TRANSPORT_STEP_MAP = {
  SEARCHING_CAPTAIN: 1,
  CAPTAIN_ASSIGNED: 1,
  CAPTAIN_ARRIVING: 1,
  CAPTAIN_REACHED_PICKUP: 2,
  RIDE_STARTED: 3,
  CAPTAIN_REACHED_DROP: 4,
  RIDE_COMPLETED: 5,
};

const ORDER_STEP_MAP = {
  Assigned: 1,
  Accepted: 1,
  'At Pickup': 2,
  'Picked Up': 3,
  'In Transit': 3,
  Delivered: 4,
};

const RETURN_STEP_MAP = {
  CAPTAIN_ASSIGNED: 1,
  PICKUP_STARTED: 1,
  PICKUP_ARRIVED: 2,
  PICKED_UP: 3,
  IN_TRANSIT_TO_SELLER: 3,
  RECEIVED_BY_SELLER: 4,
  DELIVERED_TO_SELLER: 4,
};

const ActiveDelivery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requestedType = searchParams.get('type') || location.state?.type; // 'order' | 'transport' | 'return'
  const requestedOrderId = searchParams.get('orderId') || location.state?.orderId;
  const requestedBookingId = searchParams.get('bookingId') || location.state?.bookingId;
  const requestedReturnId = searchParams.get('returnId') || location.state?.returnId;

  const [activeItem, setActiveItem] = useState(null);
  const [isTransport, setIsTransport] = useState(false);
  const [isReturn, setIsReturn] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeTransport, setActiveTransport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [showCallingModal, setShowCallingModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'dispatch',
      text: 'You have an active mission assigned. Proceed to the pickup location.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // OTP & Verification Modals (Used for Product Delivery, Transport & Return Delivery)
  const [showProductDeliveryModal, setShowProductDeliveryModal] = useState(false);
  const [showSellerPickupOtpModal, setShowSellerPickupOtpModal] = useState(false);
  const [showCustomerDeliveryOtpModal, setShowCustomerDeliveryOtpModal] = useState(false);
  const [showPickupOtpModal, setShowPickupOtpModal] = useState(false);
  const [showDropOtpModal, setShowDropOtpModal] = useState(false);
  const [showReturnOtpModal, setShowReturnOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Return Doorstep Quality Inspection State
  const [returnChecklist, setReturnChecklist] = useState({
    correctItem: true,
    undamaged: true,
    originalTagsPresent: true,
    packagingIntact: true,
    notes: '',
  });
  const [showFailReasonModal, setShowFailReasonModal] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [failingInspection, setFailingInspection] = useState(false);

  // Proof of delivery
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [locationNotice, setLocationNotice] = useState('');
  const [returnCompleting, setReturnCompleting] = useState(false);
  const lastLocationPostRef = useRef(0);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCaptainRatingModal, setShowCaptainRatingModal] = useState(false);
  const fileInputRef = useRef(null);

  // Map locations
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [captainCoords, setCaptainCoords] = useState(null);
  const [loadingCoords, setLoadingCoords] = useState(false);

  const fetchActiveDelivery = useCallback(async () => {
    setLoading(true);
    try {
      if (requestedType === 'return' || requestedReturnId) {
        let returnDoc = null;
        if (requestedReturnId) {
          const res = await returnService.getReturnById(requestedReturnId).catch(() => null);
          returnDoc = res?.returnRequest || null;
        }
        if (!returnDoc) {
          const res = await returnService.getCaptainReturnJobs('active').catch(() => null);
          returnDoc = res?.returnJobs?.[0] || null;
        }
        if (returnDoc) {
          setActiveItem(returnDoc);
          setIsReturn(true);
          setIsTransport(false);
          setCurrentStep(RETURN_STEP_MAP[returnDoc.status] || 1);
          setLoading(false);
          return;
        }
      }

      if (requestedType === 'order' || requestedOrderId) {
        const orderRes = await captainService.getActiveDelivery();
        if (orderRes.success && orderRes.order) {
          setActiveItem(orderRes.order);
          setActiveOrder(orderRes.order);
          setIsTransport(false);
          setIsReturn(false);
          setCurrentStep(ORDER_STEP_MAP[orderRes.order.captainStatus] || 1);
        } else {
          setActiveItem(null);
        }
        setLoading(false);
        return;
      }

      if (requestedType === 'transport' || requestedBookingId) {
        const transportRes = await transportService.captainGetActiveRide();
        if (transportRes.success && transportRes.booking) {
          setActiveItem(transportRes.booking);
          setActiveTransport(transportRes.booking);
          setIsTransport(true);
          setIsReturn(false);
          setCurrentStep(TRANSPORT_STEP_MAP[transportRes.booking.status] || 1);
        } else {
          setActiveItem(null);
        }
        setLoading(false);
        return;
      }

      // If no explicit preference passed, check all concurrently
      const [orderRes, transportRes, returnRes] = await Promise.allSettled([
        captainService.getActiveDelivery(),
        transportService.captainGetActiveRide(),
        returnService.getCaptainReturnJobs('active'),
      ]);

      const foundOrder = orderRes.status === 'fulfilled' && orderRes.value?.success ? orderRes.value.order : null;
      const foundTransport = transportRes.status === 'fulfilled' && transportRes.value?.success ? transportRes.value.booking : null;
      const foundReturn = returnRes.status === 'fulfilled' && returnRes.value?.success ? returnRes.value.returnJobs?.[0] : null;

      if (foundReturn) {
        setActiveItem(foundReturn);
        setIsReturn(true);
        setIsTransport(false);
        setCurrentStep(RETURN_STEP_MAP[foundReturn.status] || 1);
      } else if (foundOrder) {
        setActiveItem(foundOrder);
        setIsTransport(false);
        setIsReturn(false);
        setCurrentStep(ORDER_STEP_MAP[foundOrder.captainStatus] || 1);
      } else if (foundTransport) {
        setActiveItem(foundTransport);
        setIsTransport(true);
        setIsReturn(false);
        setCurrentStep(TRANSPORT_STEP_MAP[foundTransport.status] || 1);
      } else {
        setActiveItem(null);
      }
    } catch (err) {
      console.error('Fetch active delivery error:', err);
      setActiveItem(null);
    } finally {
      setLoading(false);
    }
  }, [requestedType, requestedOrderId, requestedBookingId, requestedReturnId]);

  useEffect(() => {
    fetchActiveDelivery();
  }, [fetchActiveDelivery]);

  // Geocode addresses and get captain location
  useEffect(() => {
    if (!activeItem) return;

    const loadLocations = async () => {
      setLoadingCoords(true);
      try {
        // Derive pickup address from activeItem
        let pickupAddr = '';
        if (isReturn) {
          const cust = activeItem.customerAddress || activeItem.pickupAddress;
          const custCoords = cust?.location?.coordinates;
          if (Array.isArray(custCoords) && custCoords.length === 2 && Number(custCoords[1]) && Number(custCoords[0])) {
            setPickupCoords({ lat: Number(custCoords[1]), lng: Number(custCoords[0]) });
          }
          pickupAddr = typeof cust === 'string'
            ? cust
            : cust
            ? [cust.addressLine1 || cust.street || cust.line1, cust.area, cust.city, cust.pincode || cust.postalCode].filter(Boolean).join(', ')
            : '';
        } else if (isTransport) {
          pickupAddr = activeItem.pickupLocation?.address || '';
          if (activeItem.pickupLocation?.lat != null && activeItem.pickupLocation?.lng != null && !pickupCoords) {
            setPickupCoords({ lat: Number(activeItem.pickupLocation.lat), lng: Number(activeItem.pickupLocation.lng) });
          }
        } else {
          // Standard product delivery pickup: seller store
          if (activeItem.sellerDetails?.coordinates && Array.isArray(activeItem.sellerDetails.coordinates) && activeItem.sellerDetails.coordinates.length === 2) {
            const [lng, lat] = activeItem.sellerDetails.coordinates;
            if (lat && lng && !pickupCoords) {
              setPickupCoords({ lat, lng });
            }
          }
          pickupAddr = activeItem.sellerDetails?.address
            ? `${activeItem.sellerDetails.address}, ${activeItem.sellerDetails.city || ''} ${activeItem.sellerDetails.pincode || ''}`
            : (activeItem.sellerDetails?.storeName || activeItem.items?.[0]?.seller || 'Seller Store');
        }

        // Derive drop address from activeItem
        let dropAddr = '';
        if (isReturn) {
          const sell = activeItem.sellerAddress || activeItem.seller;
          dropAddr = typeof sell === 'string'
            ? sell
            : sell
            ? (sell.storeAddress || sell.warehouseLocation?.storeAddress || sell.address ||
              [sell.storeName || sell.businessName || sell.name, sell.city].filter(Boolean).join(' — ') ||
              'Seller Store / Warehouse')
            : (activeItem.sellerName || 'Seller Store / Warehouse');
        } else if (isTransport) {
          dropAddr = activeItem.dropLocation?.address || '';
          if (activeItem.dropLocation?.lat != null && activeItem.dropLocation?.lng != null && !dropCoords) {
            setDropCoords({ lat: Number(activeItem.dropLocation.lat), lng: Number(activeItem.dropLocation.lng) });
          }
        } else {
          const ship = activeItem.shippingAddress || {};
          dropAddr = [ship.addressLine1, ship.addressLine2, ship.city, ship.state, ship.pincode].filter(Boolean).join(', ');
          if (ship.coordinates && Array.isArray(ship.coordinates) && ship.coordinates.length === 2 && !dropCoords) {
            const [lng, lat] = ship.coordinates;
            if (lat && lng) setDropCoords({ lat, lng });
          }
        }

        const pickupAlreadyKnown = isTransport && activeItem.pickupLocation?.lat != null && activeItem.pickupLocation?.lng != null;
        const dropAlreadyKnown = isTransport && activeItem.dropLocation?.lat != null && activeItem.dropLocation?.lng != null;

        // Get pickup coordinates
        if (pickupAddr && !pickupCoords && !pickupAlreadyKnown) {
          try {
            const coords = await geocodeAddress(pickupAddr);
            setPickupCoords(coords);
          } catch (err) {
            console.warn('Could not geocode pickup address:', err);
          }
        }

        // Get drop-off coordinates
        if (dropAddr && !dropCoords && !dropAlreadyKnown) {
          try {
            const coords = await geocodeAddress(dropAddr);
            setDropCoords(coords);
          } catch (err) {
            console.warn('Could not geocode drop address:', err);
          }
        }

        // Get captain's current location
        if (!captainCoords) {
          try {
            const coords = await getCurrentLocation();
            setCaptainCoords(coords);
          } catch (err) {
            console.warn('Could not get captain location:', err);
          }
        }
      } catch (err) {
        console.error('Geocoding error:', err);
      } finally {
        setLoadingCoords(false);
      }
    };

    loadLocations();
  }, [activeItem, isReturn, isTransport, pickupCoords, dropCoords, captainCoords]);

  // Share captain GPS while a transport trip is active. Stops after completion or cancel.
  useEffect(() => {
    if (!isTransport || !activeItem?.status) return undefined;
    if (['RIDE_COMPLETED', 'CANCELLED'].includes(activeItem.status)) {
      setLocationNotice('');
      return undefined;
    }
    if (!navigator.geolocation) {
      setLocationNotice('This device cannot share GPS. You can still open navigation and mark arrival manually.');
      return undefined;
    }

    const bookingId = activeItem.bookingId || activeItem._id;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCaptainCoords(coords);
        setLocationNotice('');
        const now = Date.now();
        if (now - lastLocationPostRef.current < 8000) return;
        lastLocationPostRef.current = now;
        transportService.captainUpdateLocation(bookingId, {
          lat: coords.lat,
          lng: coords.lng,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
        }).catch(() => {
          setLocationNotice('Live location could not be sent. The next GPS update will retry.');
        });
      },
      (err) => {
        setLocationNotice(
          err?.code === 1
            ? 'Location permission is off. Allow location to share your position and see distance.'
            : 'GPS is unavailable. You can still open navigation and mark arrival manually.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTransport, activeItem?.status, activeItem?.bookingId, activeItem?._id]);

  // ── Status Updates for Standard Order ──
  const handleUpdateOrderStatus = async (newStatus, explicitProofUrl = null) => {
    if (!activeItem) return;

    const finalProof = explicitProofUrl || proofUrl || capturedPhoto;
    if (newStatus === 'Delivered' && (!finalProof || !String(finalProof).trim())) {
      setShowProductDeliveryModal(true);
      return;
    }

    setStatusUpdating(true);
    try {
      await captainService.updateDeliveryStatus(activeItem.orderId || activeItem._id, newStatus, {
        proofUrl: finalProof,
        proofOfDeliveryUrl: finalProof,
      });
      setCurrentStep(ORDER_STEP_MAP[newStatus] || 1);
      setActiveItem((prev) => ({
        ...prev,
        captainStatus: newStatus,
        orderStatus: newStatus === 'Delivered' ? 'Delivered' : prev?.orderStatus,
        proofOfDeliveryUrl: finalProof || prev?.proofOfDeliveryUrl,
      }));

      if (newStatus === 'Delivered') {
        setShowProductDeliveryModal(false);
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error('Status update error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to update status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleConfirmProductDelivery = async () => {
    if (!activeItem?.deliveryOtpVerified) {
      setShowProductDeliveryModal(false);
      setOtpDigits(['', '', '', '']);
      setOtpError('');
      setShowCustomerDeliveryOtpModal(true);
      return;
    }
    const finalProof = proofUrl || capturedPhoto;
    if (!finalProof || !String(finalProof).trim()) {
      setOtpError('Product delivery photo is mandatory. Please capture a photo of the product.');
      return;
    }
    setOtpError('');
    const isCodOrder = activeItem?.paymentMethod === 'COD' || activeItem?.paymentMethod === 'CASH' || activeItem?.paymentStatus === 'Pending';
    if (isCodOrder && activeItem?.orderId) {
      try {
        await captainService.confirmCodCollection(activeItem.orderId || activeItem._id);
      } catch (codErr) {
        console.warn('COD collection confirmation note:', codErr.message);
      }
    }
    await handleUpdateOrderStatus('Delivered', finalProof);
  };

  // ── Verify Seller Store Pickup OTP ──
  const handleVerifySellerPickupOtp = async () => {
    const otpStr = otpDigits.join('');
    if (otpStr.length < 4) {
      setOtpError('Please enter the 4-digit Seller Store Pickup OTP.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const orderId = activeItem.orderId || activeItem._id;
      await captainService.verifyOrderPickupOtp(orderId, otpStr);
      setActiveItem((prev) => ({
        ...prev,
        captainStatus: 'In Transit',
        orderStatus: 'Out for Delivery',
        pickupOtpVerified: true,
      }));
      setCurrentStep(3); // In Transit / Out for Delivery
      setShowSellerPickupOtpModal(false);
      setOtpDigits(['', '', '', '']);
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.message || 'Invalid Seller Store Pickup OTP. Please ask the seller.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleVerifyCustomerDeliveryOtp = async () => {
    const otpStr = otpDigits.join('');
    if (otpStr.length < 4) {
      setOtpError('Please enter the 4-digit delivery OTP from the customer.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const orderId = activeItem.orderId || activeItem._id;
      await captainService.verifyDeliveryOtp(orderId, otpStr);
      setActiveItem((prev) => ({
        ...prev,
        deliveryOtpVerified: true,
      }));
      setShowCustomerDeliveryOtpModal(false);
      setOtpDigits(['', '', '', '']);
      setCapturedPhoto(null);
      setProofUrl('');
      setShowProductDeliveryModal(true);
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.message || 'Invalid delivery OTP. Please ask the customer.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── Status Updates for Return Mission ──
  const handleUpdateReturnStatus = async (newStatus) => {
    if (!activeItem) return;
    setStatusUpdating(true);
    try {
      const returnId = activeItem._id || activeItem.returnId;
      const res = await returnService.captainUpdateReturnStatus(returnId, newStatus);
      setActiveItem(res.returnRequest || { ...activeItem, status: newStatus });
      setCurrentStep(RETURN_STEP_MAP[newStatus] || 1);
      if (newStatus === 'RECEIVED_BY_SELLER' || newStatus === 'DELIVERED_TO_SELLER') {
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error('Return status update error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to update return status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // ── Status Updates for Transport Mission ──
  const handleUpdateTransportStatus = async (newStatus) => {
    if (!activeItem) return;
    setStatusUpdating(true);
    try {
      const bookingId = activeItem._id || activeItem.bookingId;
      const res = await transportService.captainUpdateStatus(bookingId, newStatus);
      setActiveItem(res.booking || { ...activeItem, status: newStatus });
      setCurrentStep(TRANSPORT_STEP_MAP[newStatus] || 1);
      if (newStatus === 'RIDE_COMPLETED') {
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error('Transport status update error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to update transport status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const openExternalNavigation = (coords, address) => {
    const destination = coords?.lat != null
      ? `${coords.lat},${coords.lng}`
      : encodeURIComponent(address || '');
    if (!destination) {
      alert('This stop does not have a location yet.');
      return;
    }
    const origin = captainCoords ? `&origin=${captainCoords.lat},${captainCoords.lng}` : '';
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}${origin}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleNavigateToPickup = async () => {
    openExternalNavigation(pickupCoords, activeItem?.pickupLocation?.address);
    if (activeItem?.status === 'CAPTAIN_ASSIGNED') {
      await handleUpdateTransportStatus('CAPTAIN_ARRIVING');
    }
  };

  const handleSaveTransportPhotos = async (stage, photos) => {
    const bookingId = activeItem.bookingId || activeItem._id;
    const res = stage === 'pickup'
      ? await transportService.captainUploadPickupPhotos(bookingId, photos)
      : await transportService.captainUploadDropPhotos(bookingId, photos);
    if (res?.booking) setActiveItem(res.booking);
  };

  const handleCompleteReturnRoute = async () => {
    if (!activeItem) return;
    setReturnCompleting(true);
    try {
      const bookingId = activeItem.bookingId || activeItem._id;
      await transportService.captainCompleteReturn(bookingId);
      setActiveItem(null);
      setShowSuccessModal(false);
      navigate('/captain/dashboard');
    } catch (err) {
      alert(err?.message || err?.response?.data?.message || 'Could not complete the return route.');
    } finally {
      setReturnCompleting(false);
    }
  };

  // ── Verify Return Pickup OTP with Quality Inspection ──
  const handleVerifyReturnOtp = async () => {
    const allChecked =
      returnChecklist.correctItem &&
      returnChecklist.undamaged &&
      returnChecklist.originalTagsPresent &&
      returnChecklist.packagingIntact;

    if (!allChecked) {
      setOtpError('Please verify and confirm all 4 quality inspection checklist items before proceeding.');
      return;
    }

    const otpStr = otpDigits.join('');
    if (otpStr.length < 4) {
      setOtpError('Please enter the 4-digit Return OTP.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    try {
      const returnId = activeItem._id || activeItem.returnId;
      const res = await returnService.captainVerifyReturnOtp(
        returnId,
        otpStr,
        returnChecklist.notes || '',
        proofUrl,
        returnChecklist
      );
      setActiveItem(res.returnRequest || { ...activeItem, status: 'PICKED_UP' });
      setCurrentStep(RETURN_STEP_MAP['PICKED_UP'] || 3);
      setShowReturnOtpModal(false);
      setOtpDigits(['', '', '', '']);
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.message || 'Invalid Return OTP. Customer must provide the 4-digit code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── Fail Doorstep Quality Inspection ──
  const handleFailReturnInspection = async () => {
    if (!failReason || !failReason.trim()) {
      alert('Please select or specify the reason for inspection failure.');
      return;
    }
    setFailingInspection(true);
    try {
      const returnId = activeItem._id || activeItem.returnId;
      const res = await returnService.captainFailInspection(returnId, failReason, returnChecklist.notes);
      setActiveItem(res.returnRequest || { ...activeItem, status: 'VERIFICATION_FAILED' });
      setShowFailReasonModal(false);
      setShowReturnOtpModal(false);
      alert('Return pickup marked as failed due to quality inspection.');
      navigate('/captain/dashboard');
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to submit inspection failure.');
    } finally {
      setFailingInspection(false);
    }
  };

  // ── OTP input helpers ──
  const handleOtpChange = (index, value) => {
    if (/^\d?$/.test(value)) {
      const newOtp = [...otpDigits];
      newOtp[index] = value;
      setOtpDigits(newOtp);
      setOtpError('');
      if (value && index < 3) {
        const next = document.getElementById(`modal-otp-input-${index + 1}`);
        if (next) next.focus();
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prev = document.getElementById(`modal-otp-input-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  // ── Verify Pickup OTP (Transport Stage 1) ──
  const handleVerifyPickupOtp = async () => {
    const otpStr = otpDigits.join('');
    if (otpStr.length < 4) {
      setOtpError('Please enter the 4-digit Pickup OTP.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const bookingId = activeItem.bookingId || activeItem._id;
      const res = await transportService.captainVerifyPickupOtp(bookingId, otpStr);
      setActiveItem(res.booking);
      setCurrentStep(3); // RIDE_STARTED
      setShowPickupOtpModal(false);
      setOtpDigits(['', '', '', '']);
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.message || 'Invalid Pickup OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── Verify Drop OTP & Complete (Transport Stage 2) ──
  const handleVerifyDropOtp = async () => {
    const otpStr = otpDigits.join('');
    if (otpStr.length < 4) {
      setOtpError('Please enter the 4-digit Drop OTP.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const bookingId = activeItem.bookingId || activeItem._id;
      const deliveryPhoto = activeItem.dropPhotos?.[0]?.url || activeItem.proofOfDeliveryUrl || proofUrl;
      const res = await transportService.captainVerifyDropOtp(bookingId, otpStr, deliveryPhoto);
      setActiveItem(res.booking);
      setCurrentStep(5); // RIDE_COMPLETED
      setShowDropOtpModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.message || 'Invalid Drop OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── Photo upload handler ──
  const handlePhotoCapture = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProofUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setCapturedPhoto(base64);
      setProofUrl(base64);
      setProofUploading(false);
    };
    reader.onerror = () => setProofUploading(false);
    reader.readAsDataURL(file);
  };

  const handleCall = () => {
    const phone = isReturn
      ? (activeItem.customer?.phone || activeItem.user?.phone || activeItem.pickupAddress?.phone || activeItem.seller?.phone)
      : isTransport
      ? activeItem?.user?.phone
      : activeItem?.shippingAddress?.phone || activeItem?.user?.phone;
    if (phone) window.location.href = `tel:${phone}`;
    else setShowCallingModal(true);
  };

  const handleSendChatMessage = (textToSend) => {
    const msg = textToSend || newMessage;
    if (!msg.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages((prev) => [...prev, { sender: 'captain', text: msg, time: now }]);
    setNewMessage('');
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'dispatch',
          text: 'Message received. Update logged in dispatch center.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-5xl text-secondary animate-spin">sync</span>
        <p className="text-sm font-semibold text-on-surface-variant">Loading active delivery…</p>
      </div>
    );
  }

  if (!activeItem) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant/30">local_shipping</span>
        <h2 className="font-bold text-lg text-primary">No Active Mission</h2>
        <p className="text-sm text-on-surface-variant">
          You don't have any active trip right now. Accept a return pickup, transport request, or job from your queue.
        </p>
        <button
          onClick={() => navigate('/captain/jobs')}
          className="mt-2 px-6 py-3 bg-[#366b00] text-white font-bold text-sm rounded-2xl shadow-md cursor-pointer"
        >
          View Job Queue
        </button>
        <CaptainBottomNav />
      </div>
    );
  }

  // Display normalization
  const tripId = isReturn
    ? activeItem.returnId || (activeItem._id ? `RET-${activeItem._id.toString().slice(-6).toUpperCase()}` : 'RETURN')
    : isTransport
    ? activeItem.bookingId
    : activeItem.orderId;

  const recipientName = isReturn
    ? (activeItem.sellerName ||
        activeItem.sellerAddress?.storeName ||
        activeItem.seller?.storeName ||
        activeItem.seller?.name ||
        'Seller Warehouse')
    : isTransport
    ? activeItem.user?.name || 'Transport Customer'
    : activeItem.shippingAddress?.fullName || activeItem.user?.name || 'Customer';

  const recipientPhone = isReturn
    ? (activeItem.sellerAddress?.phone || activeItem.seller?.phone || activeItem.customer?.phone || '')
    : isTransport
    ? activeItem.user?.phone || ''
    : activeItem.shippingAddress?.phone || activeItem.user?.phone || '';

  const customerName = isReturn
    ? (activeItem.customerAddress?.fullName ||
        activeItem.customer?.name ||
        activeItem.user?.name ||
        activeItem.pickupAddress?.fullName ||
        'Customer')
    : null;

  const customerPhone = isReturn
    ? (activeItem.customerAddress?.phone ||
        activeItem.customer?.phone ||
        activeItem.user?.phone ||
        activeItem.pickupAddress?.phone ||
        '')
    : null;

  const sellerStoreName = activeItem.sellerDetails?.storeName || activeItem.items?.[0]?.seller || 'Seller Warehouse';

  const formatAddrObj = (a) => {
    if (!a) return '';
    if (typeof a === 'string') return a;
    return [
      a.addressLine1 || a.street || a.line1 || a.storeAddress || a.warehouseLocation?.storeAddress,
      a.area,
      a.city,
      a.state,
      a.pincode || a.postalCode,
    ]
      .filter(Boolean)
      .join(', ');
  };

  const pickupAddress = isReturn
    ? (formatAddrObj(activeItem.customerAddress || activeItem.pickupAddress) || 'Customer Pickup Address')
    : isTransport
    ? activeItem.pickupLocation?.address
    : (activeItem.sellerDetails?.address
        ? `${activeItem.sellerDetails.address}, ${activeItem.sellerDetails.city || ''} ${activeItem.sellerDetails.pincode || ''}`
        : `${sellerStoreName} (Store Pickup)`);

  const dropAddress = isReturn
    ? (formatAddrObj(activeItem.sellerAddress) ||
        activeItem.seller?.storeAddress ||
        activeItem.seller?.address ||
        formatAddrObj(activeItem.seller) ||
        `${activeItem.sellerName || activeItem.seller?.storeName || 'Seller'} Store / Warehouse`)
    : isTransport
    ? activeItem.dropLocation?.address
    : `${activeItem.shippingAddress?.addressLine1}, ${activeItem.shippingAddress?.city}`;

  const transportStops = isTransport && Array.isArray(activeItem.stops)
    ? activeItem.stops.filter(Boolean)
    : [];

  const payout = isReturn
    ? (activeItem.captainFee || activeItem.captainEarnings || 60)
    : (activeItem.captainEarnings || 0);
  const commissionRate = Number(activeItem.captainCommissionRate || 0);
  const commissionAmount = Number(
    activeItem.captainCommissionAmount != null
      ? activeItem.captainCommissionAmount
      : commissionRate && activeItem.fareBreakdown?.totalFare
        ? (Number(activeItem.fareBreakdown.totalFare) * commissionRate) / 100
        : 0
  );

  const returnPending = isTransport
    && activeItem.status === 'RIDE_COMPLETED'
    && Boolean(activeItem.returnRoute?.required)
    && activeItem.returnRoute?.status !== 'COMPLETED';
  const returnDestination = activeItem.returnRoute?.destination || null;
  const returnCoords = returnDestination?.lat != null && returnDestination?.lng != null
    ? { lat: Number(returnDestination.lat), lng: Number(returnDestination.lng) }
    : pickupCoords;
  const returnDistanceKm = returnPending
    ? (calculateDistanceKm(captainCoords, returnCoords) ?? activeItem.returnRoute?.distanceKm)
    : null;
  const returnEtaMin = returnDistanceKm != null ? Math.max(2, Math.round((Number(returnDistanceKm) / 25) * 60)) : activeItem.returnRoute?.estimatedDurationMin;

  const statusBadgeText = isReturn
    ? activeItem.status
    : isTransport
    ? activeItem.status
    : activeItem.captainStatus;

  // Real-time live distance calculations from Captain GPS to Pickup & Drop locations
  const distanceToSellerKm = calculateDistanceKm(captainCoords, pickupCoords);
  const distanceToCustomerKm = calculateDistanceKm(captainCoords, dropCoords);

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen pb-24">
      {/* Top AppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-3 bg-gradient-to-r from-[#002625] to-[#0a3d16] shadow-lg rounded-b-2xl md:rounded-b-3xl border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-white/20 border-2 border-[#97fc43] shrink-0">
            <img
              className="w-full h-full object-cover"
              alt="Captain Profile"
              src={
                localStorage.getItem('sathiseller_captain_avatar') ||
                'https://ui-avatars.com/api/?name=Captain&background=366b00&color=fff'
              }
            />
          </div>
          <div className="leading-tight mt-0.5">
            <h1 className="font-headline-md text-sm md:text-base font-bold text-white tracking-wide">
              {isReturn ? 'Return Pickup Nav' : isTransport ? 'Transport Ride' : 'Delivery Nav'}
            </h1>
            <p className="text-[9px] md:text-[10px] text-[#97fc43] uppercase font-bold tracking-widest mt-0.5">
              #{tripId} • {isReturn ? 'Reverse Logistics' : isTransport ? 'Goods Haulage' : 'Standard'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/captain/notifications')}
          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors relative cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
        </button>
      </header>

      <main className="pt-20 md:pt-24 px-3.5 max-w-3xl mx-auto space-y-3 mt-2.5">
        {/* Active Card Header */}
        <div className="glass-panel p-3.5 rounded-2xl shadow-xs border-white/60 flex justify-between items-center gap-2">
          <div className="min-w-0">
            <span className="font-label-sm text-[10px] text-[#366b00] tracking-widest uppercase font-black block">
              {isReturn ? 'Active Return Pickup Mission' : isTransport ? 'Active Transport Ride' : 'Active Product Delivery'}
            </span>
            <h2 className="font-headline-md text-base md:text-lg font-black text-primary truncate mt-0.5">
              #{tripId}
            </h2>
          </div>
          <div className="bg-emerald-100 text-[#15803d] px-3 py-1 rounded-full font-label-sm text-xs font-bold shadow-xs shrink-0 whitespace-nowrap uppercase">
            {statusBadgeText || 'ACTIVE'}
          </div>
        </div>

        {/* Quick Contact Buttons */}
        <div className="glass-panel p-3 rounded-2xl shadow-xs border-white/60 flex justify-around items-center">
          <button
            onClick={handleCall}
            className="flex-1 flex flex-col items-center gap-1 group cursor-pointer border-r border-outline-variant/20"
          >
            <div className="w-11 h-11 rounded-full bg-secondary-container text-secondary flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
              <span className="material-symbols-outlined text-xl">call</span>
            </div>
            <span className="text-xs font-bold text-primary">
              {isReturn ? 'Call Customer' : isTransport ? 'Call Customer' : 'Call Customer'}
            </span>
          </button>

          <button
            onClick={() => setShowChatModal(true)}
            className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-primary-container text-primary-fixed-dim flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs relative">
              <span className="material-symbols-outlined text-xl">chat</span>
            </div>
            <span className="text-xs font-bold text-primary">Chat Support</span>
          </button>
        </div>

        {/* Live Distance & Route ETA Banner */}
        {((!isReturn && !isTransport && currentStep <= 2 && distanceToSellerKm !== null) ||
          (!isReturn && !isTransport && currentStep >= 3 && distanceToCustomerKm !== null) ||
          (isTransport && distanceToSellerKm !== null) ||
          (isReturn && distanceToSellerKm !== null)) && (
          <div className="bg-gradient-to-r from-[#002625] via-[#053d25] to-[#0a3d16] text-white p-3.5 rounded-2xl flex items-center justify-between shadow-md border border-[#97fc43]/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#97fc43]/20 flex items-center justify-center text-[#97fc43] shrink-0">
                <span className="material-symbols-outlined text-xl animate-pulse">
                  {currentStep <= 2 ? 'near_me' : 'sports_motorsports'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#97fc43] block">
                  {isReturn
                    ? (currentStep <= 2 ? 'DISTANCE TO CUSTOMER PICKUP' : 'DISTANCE TO SELLER')
                    : currentStep <= 2
                      ? 'DISTANCE TO SELLER / STORE'
                      : 'DISTANCE TO CUSTOMER DROP'}
                </span>
                <p className="text-xs font-bold text-white m-0 flex items-center gap-1.5 mt-0.5">
                  <span className="text-base md:text-lg font-black text-white">
                    {currentStep <= 2 ? `${distanceToSellerKm} KM` : `${distanceToCustomerKm} KM`}
                  </span>
                  <span className="text-white/70 font-medium text-[11px]">• from your location</span>
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[9px] text-white/70 font-bold uppercase block">ESTIMATED TIME</span>
              <span className="text-xs md:text-sm font-black text-[#97fc43]">
                ~{Math.max(2, Math.round(((currentStep <= 2 ? distanceToSellerKm : distanceToCustomerKm) / 25) * 60))} MINS
              </span>
            </div>
          </div>
        )}

        {/* Delivery Navigation Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#047857] text-base">map</span>
              <h3 className="font-label-sm text-[10px] font-black text-[#047857] uppercase tracking-wider">
                LIVE DIRECTIONS & ROUTE MAP
              </h3>
            </div>
            <button
              onClick={async () => {
                try {
                  const coords = await getCurrentLocation();
                  setCaptainCoords(coords);
                } catch (err) {
                  console.error('Error updating location:', err);
                }
              }}
              className="p-1.5 bg-[#047857] hover:bg-[#035d45] text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold px-2.5 shadow-xs active:scale-95"
              title="Refresh your GPS location"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              <span>Refresh GPS</span>
            </button>
          </div>
          {isTransport && locationNotice && (
            <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {locationNotice}
            </p>
          )}
          <DeliveryMap
            pickupLocation={returnPending ? dropCoords : pickupCoords}
            dropLocation={returnPending ? returnCoords : dropCoords}
            captainLocation={captainCoords}
            pickupAddress={returnPending ? dropAddress : pickupAddress}
            dropAddress={returnPending ? (returnDestination?.address || 'Return destination') : dropAddress}
            sellerStoreName={returnPending ? 'Completed drop' : sellerStoreName}
            recipientName={returnPending ? 'Return destination' : recipientName}
            currentStep={returnPending ? 3 : currentStep}
            isReturn={isReturn}
            isTransport={isTransport}
            stops={transportStops}
          />
        </div>

        {/* Route Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="glass-panel p-3.5 rounded-2xl border border-white/60 shadow-xs space-y-1">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#047857] text-base">
                  {isReturn ? 'person_pin_circle' : 'storefront'}
                </span>
                <span className="font-label-sm text-[10px] font-black text-[#047857] uppercase tracking-wider">
                  {isReturn ? 'CUSTOMER PICKUP ADDRESS' : isTransport ? 'PICKUP LOCATION' : 'SELLER STORE PICKUP'}
                </span>
              </div>
              {distanceToSellerKm !== null && (
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  📍 {distanceToSellerKm} km away
                </span>
              )}
            </div>
            {!isReturn && !isTransport && sellerStoreName && (
              <p className="font-bold text-xs text-slate-800">{sellerStoreName}</p>
            )}
            {isReturn && customerName && (
              <p className="font-bold text-xs text-slate-800">{customerName} {customerPhone ? `(${customerPhone})` : ''}</p>
            )}
            <p className="font-extrabold text-sm text-on-surface leading-snug">{pickupAddress}</p>
          </div>

          <div className="glass-panel p-3.5 rounded-2xl border border-white/60 shadow-xs space-y-1">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ff5500] text-base">store</span>
                <span className="font-label-sm text-[10px] font-black text-[#ff5500] uppercase tracking-wider">
                  {isReturn ? 'SELLER RETURN DESTINATION' : 'DROP-OFF DESTINATION'}
                </span>
              </div>
              {distanceToCustomerKm !== null && (
                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  🏁 {distanceToCustomerKm} km away
                </span>
              )}
            </div>
            <p className="font-extrabold text-sm text-on-surface leading-snug">{recipientName}</p>
            <p className="text-on-surface-variant text-xs truncate">{dropAddress}</p>
          </div>
        </div>

        {/* Return Item Details Card */}
        {isReturn && (
          <div className="glass-panel p-3.5 rounded-2xl border border-white/60 shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest">
                ITEM TO COLLECT
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                Order #{activeItem.orderId || (activeItem.order?._id ? activeItem.order._id.slice(-6) : '')}
              </span>
            </div>
            <div className="flex gap-3 items-center">
              {activeItem.productImage && (
                <img
                  src={activeItem.productImage}
                  alt={activeItem.productName}
                  className="w-12 h-12 object-cover rounded-xl border border-slate-200"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-slate-900 truncate">{activeItem.productName || 'Returned Product'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Quantity: <span className="font-bold text-slate-800">{activeItem.quantity || 1}</span> • Refund Est: <span className="font-bold text-[#15803d]">₹{activeItem.refundAmount || 0}</span>
                </p>
                {activeItem.reason && (
                  <p className="text-[10px] text-red-600 font-medium mt-0.5 truncate">
                    Reason: {activeItem.reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Goods / Item Details (Transport specifics) */}
        {isTransport && activeItem.goods && (
          <div className="glass-panel p-3.5 rounded-2xl border border-white/60 shadow-xs flex justify-between items-center text-xs">
            <div>
              <span className="font-black text-[9px] text-slate-400 uppercase tracking-widest block">
                CARGO DETAILS
              </span>
              <p className="font-bold text-slate-800 mt-0.5">
                {activeItem.goods.category} • {activeItem.goods.weightKg} KG • {activeItem.goods.packages} Boxes
              </p>
              {activeItem.goods.instructions && (
                <p className="text-[11px] text-slate-500 italic mt-0.5">"{activeItem.goods.instructions}"</p>
              )}
            </div>
            <div className="text-right">
              <span className="font-black text-[9px] text-slate-400 uppercase tracking-widest block">VEHICLE</span>
              <p className="font-bold text-primary">{activeItem.vehicleSnapshot?.name || 'Truck'}</p>
            </div>
          </div>
        )}

        {/* Intermediate stops (#60) */}
        {transportStops.length > 0 && (
          <div className="glass-panel p-3.5 rounded-2xl border border-white/60 shadow-xs space-y-2">
            <span className="font-black text-[9px] text-slate-400 uppercase tracking-widest block">
              STOP LOCATIONS ({transportStops.length})
            </span>
            {transportStops.map((stop, idx) => {
              const stopAddr =
                typeof stop === 'string'
                  ? stop
                  : stop?.address ||
                    stop?.formattedAddress ||
                    [stop?.addressLine1, stop?.city, stop?.pincode].filter(Boolean).join(', ') ||
                    `Stop ${idx + 1}`;
              return (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-black text-[10px] shrink-0">
                    {idx + 1}
                  </span>
                  <p className="font-bold text-slate-800 leading-snug m-0">{stopAddr}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PROGRESS & ACTION BUTTONS ── */}
        <div className="glass-panel p-4 rounded-2xl shadow-xs border-white/60 space-y-3.5">
          <h3 className="font-label-sm text-xs text-outline tracking-widest uppercase font-black">
            {isReturn ? 'Return Reverse Pickup Milestones' : isTransport ? 'Transport Ride Milestones' : 'Product Delivery Progress'}
          </h3>

          {/* Return Milestones */}
          {isReturn ? (
            <div className="space-y-3.5 relative before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-outline-variant/40">
              {[
                { step: 1, label: 'Captain Assigned / Pickup Started', sub: 'Proceeding to customer address for doorstep collection' },
                { step: 2, label: 'Arrived at Customer', sub: 'Inspect item & verify 4-digit Customer Return OTP' },
                { step: 3, label: 'Item Picked Up & In Transit', sub: 'Transporting returned item to seller store / warehouse' },
                { step: 4, label: 'Delivered to Seller', sub: 'Handed over to seller for inspection & payout credited' },
              ].map(({ step, label, sub }) => (
                <div key={step} className="flex gap-3 relative z-10 items-start">
                  <div
                    className={`w-4.5 h-4.5 rounded-full border-2 border-surface shrink-0 mt-0.5 ${
                      currentStep >= step
                        ? step === currentStep
                          ? 'bg-[#366b00] ring-2 ring-[#97fc43]'
                          : 'bg-[#366b00]'
                        : 'bg-slate-300'
                    }`}
                  />
                  <div>
                    <p className={`font-bold text-xs md:text-sm ${currentStep >= step ? 'text-primary' : 'text-slate-400'}`}>
                      {label}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : isTransport ? (
            // Transport Milestones
            <div className="space-y-3.5 relative before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-outline-variant/40">
              {[
                { step: 1, label: 'Navigate to Pickup', sub: 'Follow the map. Arrival is confirmed only when you tap Arrived' },
                { step: 2, label: 'Arrived at Pickup', sub: 'Photograph the goods, then enter the pickup OTP' },
                { step: 3, label: 'Ride Started', sub: 'Navigate to the drop. Your live location is shared with the customer' },
                { step: 4, label: 'Arrived at Drop', sub: 'Photograph the delivery, then enter the drop OTP' },
                { step: 5, label: 'Delivered & Completed', sub: 'Payout credited. Return route appears only when this booking requires it' },
              ].map(({ step, label, sub }) => (
                <div key={step} className="flex gap-3 relative z-10 items-start">
                  <div
                    className={`w-4.5 h-4.5 rounded-full border-2 border-surface shrink-0 mt-0.5 ${
                      currentStep >= step
                        ? step === currentStep
                          ? 'bg-[#366b00] ring-2 ring-[#97fc43]'
                          : 'bg-[#366b00]'
                        : 'bg-slate-300'
                    }`}
                  />
                  <div>
                    <p className={`font-bold text-xs md:text-sm ${currentStep >= step ? 'text-primary' : 'text-slate-400'}`}>
                      {label}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Standard Delivery Milestones
            <div className="space-y-3.5 relative before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-outline-variant/40">
              {[
                { step: 1, label: 'Order Accepted', sub: 'Proceed to store / seller' },
                { step: 2, label: 'Reached Store', sub: 'Verify 4-digit Seller Pickup OTP to collect package' },
                { step: 3, label: 'Out for Delivery', sub: 'At the customer door, verify the delivery OTP, then take a photo' },
                { step: 4, label: 'Delivered', sub: 'Package handed over & payout credited' },
              ].map(({ step, label, sub }) => (
                <div key={step} className="flex gap-3 relative z-10 items-start">
                  <div
                    className={`w-4.5 h-4.5 rounded-full border-2 border-surface shrink-0 mt-0.5 ${
                      currentStep >= step ? 'bg-[#366b00]' : 'bg-slate-300'
                    }`}
                  />
                  <div>
                    <p className={`font-bold text-xs md:text-sm ${currentStep >= step ? 'text-primary' : 'text-slate-400'}`}>
                      {label}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTION BUTTONS ── */}
          <div className="space-y-2 pt-2">
            {/* Return Action 1: Start Pickup Route */}
            {isReturn && (activeItem.status === 'CAPTAIN_ASSIGNED' || activeItem.status === 'APPROVED') && (
              <button
                onClick={() => handleUpdateReturnStatus('PICKUP_STARTED')}
                disabled={statusUpdating}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {statusUpdating ? (
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">navigation</span>
                )}
                Start Pickup Route to Customer
              </button>
            )}

            {/* Return Action 2: Mark Arrived at Customer */}
            {isReturn && activeItem.status === 'PICKUP_STARTED' && (
              <button
                onClick={() => handleUpdateReturnStatus('PICKUP_ARRIVED')}
                disabled={statusUpdating}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {statusUpdating ? (
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">location_on</span>
                )}
                Arrived at Customer Doorstep
              </button>
            )}

            {/* Return Action 3: Enter Customer Return OTP & Quality Inspection */}
            {isReturn && activeItem.status === 'PICKUP_ARRIVED' && (
              <button
                onClick={() => {
                  setOtpDigits(['', '', '', '']);
                  setOtpError('');
                  setShowReturnOtpModal(true);
                }}
                className="w-full py-3.5 bg-[#366b00] hover:bg-[#2d5800] text-white rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
              >
                <span className="material-symbols-outlined text-base">verified_user</span>
                Inspect Quality Checklist & Verify Return OTP
              </button>
            )}

            {/* Return Action 4: Transit to Seller */}
            {isReturn && activeItem.status === 'PICKED_UP' && (
              <button
                onClick={() => handleUpdateReturnStatus('IN_TRANSIT_TO_SELLER')}
                disabled={statusUpdating}
                className="w-full py-3.5 bg-[#002625] hover:bg-[#003837] text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {statusUpdating ? (
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">local_shipping</span>
                )}
                Start Route to Seller Store / Warehouse
              </button>
            )}

            {/* Return Action 5: Deliver to Seller Store */}
            {isReturn && (activeItem.status === 'IN_TRANSIT_TO_SELLER' || activeItem.status === 'PICKED_UP') && (
              <button
                onClick={() => handleUpdateReturnStatus('RECEIVED_BY_SELLER')}
                disabled={statusUpdating}
                className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {statusUpdating ? (
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">task_alt</span>
                )}
                Hand Over to Seller & Complete Return Pickup
              </button>
            )}

            {/* Transport: navigate, then the captain confirms arrival. Navigation does not mark arrival. */}
            {isTransport && (activeItem.status === 'CAPTAIN_ASSIGNED' || activeItem.status === 'CAPTAIN_ARRIVING') && (
              <>
                <button
                  onClick={handleNavigateToPickup}
                  disabled={statusUpdating}
                  className="w-full py-3.5 bg-[#002625] hover:bg-[#003837] text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">navigation</span>
                  Navigate to Pickup
                </button>
                <button
                  onClick={() => handleUpdateTransportStatus('CAPTAIN_REACHED_PICKUP')}
                  disabled={statusUpdating}
                  className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {statusUpdating ? (
                    <span className="material-symbols-outlined animate-spin text-base">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-base">store</span>
                  )}
                  Arrived at Pickup
                </button>
              </>
            )}

            {isTransport && activeItem.status === 'CAPTAIN_REACHED_PICKUP' && (
              <>
                <TransportPhotoUploader
                  title="Goods photos"
                  hint="Photograph the packages before the pickup OTP. At least one saved photo is required."
                  photos={activeItem.pickupPhotos || []}
                  onSave={(photos) => handleSaveTransportPhotos('pickup', photos)}
                />
                <button
                  onClick={() => {
                    if (!activeItem.pickupPhotos?.length) {
                      alert('Save at least one goods photo before entering the pickup OTP.');
                      return;
                    }
                    setOtpDigits(['', '', '', '']);
                    setOtpError('');
                    setShowPickupOtpModal(true);
                  }}
                  disabled={!activeItem.pickupPhotos?.length}
                  className="w-full py-3.5 bg-[#366b00] hover:bg-[#2d5800] text-white rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:animate-none animate-pulse"
                >
                  <span className="material-symbols-outlined text-base">pin</span>
                  Enter Pickup OTP & Start Ride
                </button>
              </>
            )}

            {isTransport && activeItem.status === 'RIDE_STARTED' && (
              <>
                <button
                  onClick={() => openExternalNavigation(dropCoords, activeItem.dropLocation?.address)}
                  className="w-full py-3.5 bg-[#002625] hover:bg-[#003837] text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">navigation</span>
                  Navigate to Drop
                </button>
                <button
                  onClick={() => handleUpdateTransportStatus('CAPTAIN_REACHED_DROP')}
                  disabled={statusUpdating}
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {statusUpdating ? (
                    <span className="material-symbols-outlined animate-spin text-base">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-base">location_on</span>
                  )}
                  Arrived at Drop
                </button>
              </>
            )}

            {isTransport && activeItem.status === 'CAPTAIN_REACHED_DROP' && (
              <>
                <TransportPhotoUploader
                  title="Delivery photo"
                  hint="Photograph the handover before the drop OTP. At least one saved photo is required."
                  photos={activeItem.dropPhotos || []}
                  onSave={(photos) => handleSaveTransportPhotos('drop', photos)}
                />
                <button
                  onClick={() => {
                    if (!activeItem.dropPhotos?.length && !activeItem.proofOfDeliveryUrl) {
                      alert('Save at least one delivery photo before entering the drop OTP.');
                      return;
                    }
                    setOtpDigits(['', '', '', '']);
                    setOtpError('');
                    setShowDropOtpModal(true);
                  }}
                  disabled={!activeItem.dropPhotos?.length && !activeItem.proofOfDeliveryUrl}
                  className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:animate-none animate-pulse"
                >
                  <span className="material-symbols-outlined text-base">verified</span>
                  Enter Drop OTP & Complete Delivery
                </button>
              </>
            )}

            {returnPending && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-sky-800">Return route · original trip {tripId}</p>
                <p className="text-xs font-bold text-slate-800">{returnDestination?.address || pickupAddress}</p>
                <p className="text-[11px] text-slate-600">
                  {returnDistanceKm != null ? `${returnDistanceKm} km` : 'Distance unavailable'}
                  {returnEtaMin ? ` · about ${returnEtaMin} min` : ''}
                </p>
                <button
                  onClick={() => openExternalNavigation(returnCoords, returnDestination?.address || pickupAddress)}
                  className="w-full py-3 bg-[#002625] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Navigate return route
                </button>
                <button
                  onClick={handleCompleteReturnRoute}
                  disabled={returnCompleting}
                  className="w-full py-3 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {returnCompleting ? 'Saving...' : 'Return route complete'}
                </button>
              </div>
            )}

            {/* ── Standard Product Delivery Actions (OTP Required at Seller Store Pickup) ── */}
            {!isTransport && !isReturn && activeItem.captainStatus === 'Accepted' && (
              <button
                onClick={() => handleUpdateOrderStatus('At Pickup')}
                disabled={statusUpdating}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {statusUpdating ? (
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">store</span>
                )}
                Arrived at Store / Pickup
              </button>
            )}

            {!isTransport && !isReturn && (activeItem.captainStatus === 'At Pickup' || activeItem.captainStatus === 'Reached Store') && (
              <button
                onClick={() => {
                  setOtpDigits(['', '', '', '']);
                  setOtpError('');
                  setShowSellerPickupOtpModal(true);
                }}
                className="w-full py-3.5 bg-[#366b00] hover:bg-[#2d5800] text-white rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
              >
                <span className="material-symbols-outlined text-base">verified_user</span>
                Enter Seller Pickup OTP & Collect Package
              </button>
            )}

            {!isTransport && !isReturn &&
              (activeItem.captainStatus === 'In Transit' || activeItem.captainStatus === 'Picked Up') && (
                <div className="space-y-2">
                  {activeItem.deliveryOtpVerified ? (
                    <button
                      onClick={() => {
                        setOtpError('');
                        setShowProductDeliveryModal(true);
                      }}
                      disabled={statusUpdating}
                      className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-bold text-xs shadow-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {statusUpdating ? (
                        <span className="material-symbols-outlined animate-spin text-base">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-base">photo_camera</span>
                      )}
                      Take Product Photo & Complete Delivery
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setOtpDigits(['', '', '', '']);
                        setOtpError('');
                        setShowCustomerDeliveryOtpModal(true);
                      }}
                      className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-bold text-xs shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">pin</span>
                      Enter Customer Delivery OTP
                    </button>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Payment & Cash Collection Notice (Crucial for COD vs Prepaid) */}
        {!isReturn && (
          <div
            className={`p-4 rounded-2xl border shadow-xs transition-all ${
              (activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending')
                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    (activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending')
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-emerald-600 text-white shadow-xs'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {(activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending')
                      ? 'payments'
                      : 'check_circle'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                    CUSTOMER PAYMENT STATUS
                  </span>
                  <p className="font-extrabold text-sm md:text-base leading-tight">
                    {(activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending')
                      ? 'Cash on Delivery (COD)'
                      : `Prepaid (${activeItem.paymentMethod || 'Online Paid'})`}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                {(activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending') ? (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">
                      COLLECT FROM CUSTOMER
                    </span>
                    <span className="text-lg md:text-xl font-black text-amber-900 font-mono">
                      ₹{Number(activeItem.fareBreakdown?.totalFare || activeItem.grandTotal || activeItem.totalAmount || activeItem.price || 0).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Do Not Collect Cash
                  </span>
                )}
              </div>
            </div>

            {(activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending') && (
              <p className="text-[11px] text-amber-800 font-semibold mt-2 pt-2 border-t border-amber-200/80 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm shrink-0">info</span>
                Please collect exact cash amount of ₹{Number(activeItem.fareBreakdown?.totalFare || activeItem.grandTotal || activeItem.totalAmount || activeItem.price || 0).toFixed(2)} before handing over the parcel.
              </p>
            )}
          </div>
        )}

        {/* Payout Card */}
        <div className="glass-panel p-4 rounded-2xl border border-white/60 flex justify-between items-center">
          <div>
            <p className="text-xs font-black text-on-surface-variant uppercase tracking-wider">Your Captain Earnings</p>
            <p className="text-2xl font-extrabold text-[#15803d] mt-1">₹{Number(payout || 0).toFixed(2)}</p>
            {isTransport && commissionRate > 0 && (
              <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                Platform fee {commissionRate}%{commissionAmount > 0 ? ` (−₹${commissionAmount.toFixed(2)})` : ''}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-on-surface-variant">
            <p className="font-bold text-primary">
              {isReturn ? 'Return Delivery Fee' : isTransport ? 'Transport Fare' : 'Delivery Fee'}
            </p>
            <p className="font-semibold text-slate-700">{activeItem.paymentMethod || 'Prepaid'}</p>
          </div>
        </div>
      </main>

      {/* ── MODAL: PRODUCT QUALITY INSPECTION & RETURN OTP VERIFICATION (Return Pickup Only) ── */}
      {showReturnOtpModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto pb-24">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 my-auto border border-slate-100 mb-8">
            {/* Header matching screenshot */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-orange-600 text-lg">verified_user</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 uppercase tracking-tight">
                    Product Quality Inspection Checklist
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Verify product condition before accepting return</p>
                </div>
              </div>
              <button
                onClick={() => setShowReturnOtpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Product Summary Banner */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
              {activeItem.productImage ? (
                <img
                  src={activeItem.productImage}
                  alt={activeItem.productName}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-orange-500 text-xl">inventory_2</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{activeItem.productName || 'Returned Product'}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                  <span>Qty: <strong className="text-slate-800">{activeItem.quantity || 1}</strong></span>
                  <span>•</span>
                  <span>Order: <strong className="text-slate-800">#{activeItem.orderId}</strong></span>
                </div>
              </div>
            </div>

            {/* Inspection Checklist Grid (Matching the Screenshot) */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                Doorstep Quality Checks (Must Confirm All)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  returnChecklist.correctItem ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={returnChecklist.correctItem}
                    onChange={(e) => setReturnChecklist((prev) => ({ ...prev, correctItem: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#15803d] focus:ring-emerald-500 cursor-pointer accent-[#15803d]"
                  />
                  <span className="font-bold text-xs">Correct Product & Variant</span>
                </label>

                <label className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  returnChecklist.undamaged ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={returnChecklist.undamaged}
                    onChange={(e) => setReturnChecklist((prev) => ({ ...prev, undamaged: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#15803d] focus:ring-emerald-500 cursor-pointer accent-[#15803d]"
                  />
                  <span className="font-bold text-xs">No Physical Damage</span>
                </label>

                <label className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  returnChecklist.originalTagsPresent ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={returnChecklist.originalTagsPresent}
                    onChange={(e) => setReturnChecklist((prev) => ({ ...prev, originalTagsPresent: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#15803d] focus:ring-emerald-500 cursor-pointer accent-[#15803d]"
                  />
                  <span className="font-bold text-xs">Original Tags & Labels Intact</span>
                </label>

                <label className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  returnChecklist.packagingIntact ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={returnChecklist.packagingIntact}
                    onChange={(e) => setReturnChecklist((prev) => ({ ...prev, packagingIntact: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#15803d] focus:ring-emerald-500 cursor-pointer accent-[#15803d]"
                  />
                  <span className="font-bold text-xs">Original Packaging Available</span>
                </label>
              </div>
            </div>

            {/* Inspection Notes (Optional) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Inspection Notes (Optional):</label>
              <textarea
                value={returnChecklist.notes}
                onChange={(e) => setReturnChecklist((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes regarding condition, packaging, or inspection..."
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#366b00] focus:ring-1 focus:ring-[#366b00] resize-none"
              />
            </div>

            {/* Optional Photo Proof */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base text-[#366b00]">
                {capturedPhoto ? 'check_circle' : 'photo_camera'}
              </span>
              {capturedPhoto ? 'Package Condition Photo Attached ✓' : 'Take Return Item Condition Photo (Optional)'}
            </button>

            {/* 4-Digit Return OTP Section */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#366b00]">pin</span>
                  Enter Customer Return OTP
                </label>
                <span className="text-[10px] font-semibold text-slate-400">Ask Customer</span>
              </div>

              <div className="flex justify-between gap-2 max-w-xs mx-auto py-1">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`modal-otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    placeholder="•"
                    className="w-11 h-12 sm:w-12 sm:h-13 text-center text-xl sm:text-2xl font-bold rounded-2xl border border-slate-300 bg-slate-50 focus:border-[#366b00] focus:ring-2 focus:ring-[#97fc43]/30 outline-none"
                  />
                ))}
              </div>
              {otpError && <p className="text-center text-xs text-red-500 font-semibold">{otpError}</p>}
            </div>

            {/* Action Buttons: Fail Inspection vs Pass Inspection & Verify OTP */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowFailReasonModal(true)}
                disabled={verifyingOtp}
                className="flex-1 py-3 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 cursor-pointer transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                Fail Inspection
              </button>

              <button
                type="button"
                onClick={handleVerifyReturnOtp}
                disabled={verifyingOtp || otpDigits.join('').length < 4}
                className="flex-[2] py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyingOtp ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">package_2</span>
                )}
                {verifyingOtp ? 'Verifying OTP…' : 'Pass Inspection & Confirm Pickup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FAIL INSPECTION REASON ── */}
      {showFailReasonModal && (
        <div className="fixed inset-0 z-[130] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 mb-16">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-rose-600">report_problem</span>
                Reject / Fail Return Inspection
              </h3>
              <button
                onClick={() => setShowFailReasonModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Please select or enter why this return item cannot be accepted from the customer.
            </p>

            <div className="space-y-1.5">
              {[
                'Physical damage / broken item',
                'Wrong product or variant provided',
                'Original tags / labels missing or torn',
                'Original box / packaging missing',
                'Used / altered / counterfeit condition',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setFailReason(reason)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    failReason === reason
                      ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Or type specific rejection reason..."
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500 resize-none"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFailReasonModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFailReturnInspection}
                disabled={failingInspection || !failReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {failingInspection ? 'Submitting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PRODUCT DELIVERY CONFIRMATION & MANDATORY PHOTO PROOF ── */}
      {showProductDeliveryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4 border border-slate-100 my-auto animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#15803d] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">photo_camera</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm md:text-base text-slate-900 leading-tight">
                    Confirm Product Delivery
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    Order #{tripId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductDeliveryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer border-none"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Recipient & Drop Info */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">RECIPIENT</span>
                <span className="font-extrabold text-slate-900">{recipientName}</span>
              </div>
              <p className="text-[11.5px] text-slate-600 truncate m-0">
                {dropAddress}
              </p>
            </div>

            {/* COD Payment Alert */}
            {(activeItem.paymentMethod === 'COD' || activeItem.paymentMethod === 'CASH' || activeItem.paymentStatus === 'Pending') ? (
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl flex items-center justify-between gap-2 text-amber-950">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-xl">payments</span>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">
                      CASH ON DELIVERY (COD)
                    </span>
                    <span className="text-xs font-bold text-amber-950">
                      Collect Cash from Customer
                    </span>
                  </div>
                </div>
                <span className="text-base font-black text-amber-900 font-mono">
                  ₹{Number(activeItem.grandTotal || activeItem.totalAmount || activeItem.price || 0).toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-2xl flex items-center gap-2 text-emerald-900 text-xs font-bold">
                <span className="material-symbols-outlined text-emerald-600 text-lg">verified</span>
                <span>Prepaid Order — Do not collect any cash.</span>
              </div>
            )}

            {/* MANDATORY PHOTO CAPTURE FOR SELLER */}
            <div className="bg-emerald-50/60 p-4 rounded-2xl border-2 border-emerald-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#15803d] text-base">photo_camera</span>
                  Product Handover Photo <span className="text-red-600 font-black">* Required</span>
                </span>
                {capturedPhoto && (
                  <span className="text-[10px] font-extrabold bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-400">
                    ✓ Attached
                  </span>
                )}
              </div>

              <p className="text-[11.5px] text-slate-600 leading-snug m-0">
                Please take a clear photo of the parcel/package being handed over to the customer. <strong className="text-slate-800">This photo will be visible to the seller</strong> in their dashboard.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {capturedPhoto ? (
                <div className="space-y-2">
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 shadow-xs">
                    <img src={capturedPhoto} alt="Delivered Product" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                      <span>✓ Photo Verified</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    Retake Product Photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 px-4 bg-white border-2 border-dashed border-emerald-400 hover:bg-emerald-50/80 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs group"
                >
                  {proofUploading ? (
                    <span className="material-symbols-outlined animate-spin text-2xl text-[#15803d]">sync</span>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-emerald-100 group-hover:scale-105 text-[#15803d] flex items-center justify-center transition-transform">
                        <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-950">
                        Tap to Capture Product Photo *
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Mandatory proof for seller order verification
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {otpError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl text-center font-bold">
                {otpError}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowProductDeliveryModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmProductDelivery}
                disabled={statusUpdating || !capturedPhoto}
                className="flex-2 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-2xl shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {statusUpdating ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-base">task_alt</span>
                )}
                {statusUpdating ? 'Finalizing…' : capturedPhoto ? 'Confirm Delivery & Mark Delivered' : 'Capture Photo to Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomerDeliveryOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-700">pin</span>
                Customer Delivery OTP
              </h3>
              <button
                onClick={() => setShowCustomerDeliveryOtpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Ask the customer for the 4-digit <span className="font-bold text-slate-800">delivery OTP</span> shown on their order tracking screen. The photo step opens after this OTP is verified.
            </p>

            <div className="flex justify-between gap-2 max-w-xs mx-auto py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`modal-otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  placeholder="•"
                  className="w-12 h-14 text-center text-2xl font-bold rounded-2xl border border-slate-300 bg-slate-50 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              ))}
            </div>

            {otpError && <p className="text-center text-xs text-red-500 font-semibold">{otpError}</p>}

            <button
              onClick={handleVerifyCustomerDeliveryOtp}
              disabled={verifyingOtp || otpDigits.join('').length < 4}
              className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {verifyingOtp ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base">check_circle</span>
              )}
              {verifyingOtp ? 'Verifying OTP…' : 'Verify OTP & Take Photo'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 0: SELLER STORE PICKUP OTP VERIFICATION (Standard Product Delivery) ── */}
      {showSellerPickupOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#366b00]">store</span>
                Seller Store Pickup OTP
              </h3>
              <button
                onClick={() => setShowSellerPickupOtpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Ask the seller at the store for the 4-digit <span className="font-bold text-slate-800">Store Pickup OTP</span> shown on their seller screen before picking up packages.
            </p>

            {/* OTP Inputs */}
            <div className="flex justify-between gap-2 max-w-xs mx-auto py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`modal-otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  placeholder="•"
                  className="w-12 h-14 text-center text-2xl font-bold rounded-2xl border border-slate-300 bg-slate-50 focus:border-[#366b00] focus:ring-2 focus:ring-[#97fc43]/30 outline-none"
                />
              ))}
            </div>

            {otpError && <p className="text-center text-xs text-red-500 font-semibold">{otpError}</p>}

            <button
              onClick={handleVerifySellerPickupOtp}
              disabled={verifyingOtp || otpDigits.join('').length < 4}
              className="w-full py-3.5 bg-[#366b00] hover:bg-[#2d5800] text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {verifyingOtp ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base">check_circle</span>
              )}
              {verifyingOtp ? 'Verifying OTP…' : 'Verify Pickup OTP & Start Delivery'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 1: PICKUP OTP VERIFICATION (Transport Only) ── */}
      {showPickupOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#366b00]">pin</span>
                Enter Transport Pickup OTP
              </h3>
              <button
                onClick={() => setShowPickupOtpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Ask the customer at the pickup point for the 4-digit Pickup OTP shown on their screen before loading goods.
            </p>

            {/* OTP Inputs */}
            <div className="flex justify-between gap-2 max-w-xs mx-auto py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`modal-otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  placeholder="•"
                  className="w-12 h-14 text-center text-2xl font-bold rounded-2xl border border-slate-300 bg-slate-50 focus:border-[#366b00] focus:ring-2 focus:ring-[#97fc43]/30 outline-none"
                />
              ))}
            </div>

            {otpError && <p className="text-center text-xs text-red-500 font-semibold">{otpError}</p>}

            <button
              onClick={handleVerifyPickupOtp}
              disabled={verifyingOtp || otpDigits.join('').length < 4}
              className="w-full py-3.5 bg-[#366b00] hover:bg-[#2d5800] text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {verifyingOtp ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base">check_circle</span>
              )}
              {verifyingOtp ? 'Verifying OTP…' : 'Verify Pickup & Start Ride'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: DROP OTP VERIFICATION (Transport Only) ── */}
      {showDropOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ff5500]">verified</span>
                Enter Transport Drop OTP
              </h3>
              <button
                onClick={() => setShowDropOtpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Ask the recipient at the destination for the 4-digit Drop OTP to confirm safe delivery and complete the trip.
            </p>

            {/* OTP Inputs */}
            <div className="flex justify-between gap-2 max-w-xs mx-auto py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`modal-otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  placeholder="•"
                  className="w-12 h-14 text-center text-2xl font-bold rounded-2xl border border-slate-300 bg-slate-50 focus:border-[#366b00] focus:ring-2 focus:ring-[#97fc43]/30 outline-none"
                />
              ))}
            </div>

            {/* Proof Photo (optional) */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />
            <div className="pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-base text-[#366b00]">
                  {capturedPhoto ? 'check_circle' : 'photo_camera'}
                </span>
                {capturedPhoto ? 'Proof Photo Attached ✓' : 'Attach Delivery Photo Proof (Optional)'}
              </button>
            </div>

            {otpError && <p className="text-center text-xs text-red-500 font-semibold">{otpError}</p>}

            <button
              onClick={handleVerifyDropOtp}
              disabled={verifyingOtp || otpDigits.join('').length < 4}
              className="w-full py-3.5 bg-[#366b00] hover:bg-[#2d5800] text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {verifyingOtp ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base">task_alt</span>
              )}
              {verifyingOtp ? 'Completing Ride…' : 'Verify Drop & Complete'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 3: COMPLETION CELEBRATION ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl text-center space-y-4 border border-slate-100">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-[#15803d]">task_alt</span>
            </div>
            <h2 className="font-headline-lg font-extrabold text-2xl text-slate-900">
              {isReturn ? 'Return Delivered to Seller!' : isTransport ? 'Ride Completed!' : 'Order Delivered!'}
            </h2>
            <p className="text-slate-500 text-xs leading-relaxed">
              {isReturn
                ? 'Returned item successfully handed over to seller.'
                : isTransport
                ? 'Transport verified and finished.'
                : 'Product order successfully delivered.'}{' '}
              Your payout of{' '}
              <span className="font-bold text-[#15803d]">₹{payout.toFixed(2)}</span> has been credited to your wallet.
            </p>
            <div className="space-y-2 pt-2">
              {!isReturn && (
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setShowCaptainRatingModal(true);
                  }}
                  className="w-full py-3 bg-[#15803d] hover:bg-[#166534] text-white font-bold rounded-xl shadow-md cursor-pointer transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">star</span>
                  <span>Rate Customer ({recipientName})</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (returnPending) {
                    setShowSuccessModal(false);
                    return;
                  }
                  navigate('/captain/dashboard');
                }}
                className="w-full py-2.5 bg-[#366b00] hover:bg-[#2d5800] text-white font-bold rounded-xl cursor-pointer transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">{returnPending ? 'navigation' : 'home'}</span>
                <span>{returnPending ? 'Continue return route' : 'Back to Dashboard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captain Rates User Modal */}
      <RatingModal
        isOpen={showCaptainRatingModal}
        onClose={() => {
          setShowCaptainRatingModal(false);
          navigate('/captain/dashboard');
        }}
        ride={activeItem}
        role="captain"
        onSuccess={() => {
          setShowCaptainRatingModal(false);
          navigate('/captain/dashboard');
        }}
      />

      {/* Calling Modal */}
      {showCallingModal && (
        <div className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full border-white shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 bg-secondary-container text-secondary rounded-full flex items-center justify-center mx-auto animate-pulse">
              <span className="material-symbols-outlined text-3xl">call</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">Calling Customer...</h3>
              <p className="text-xs text-on-surface-variant mt-1">{recipientPhone}</p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mt-0.5">
                #{tripId}
              </p>
            </div>
            <button
              onClick={() => setShowCallingModal(false)}
              className="w-full py-2.5 bg-error text-white font-bold text-xs rounded-xl hover:bg-error/90 transition-all cursor-pointer"
            >
              End Call
            </button>
          </div>
        </div>
      )}

      {/* Chat Support Modal (#55 — fullscreen above bottom nav) */}
      {showChatModal && (
        <div className="fixed inset-0 z-[120] bg-surface flex flex-col w-full h-[100dvh] overflow-hidden">
          <div className="bg-primary text-white px-4 py-3 flex justify-between items-center shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowChatModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>
              <div className="w-9 h-9 rounded-full bg-secondary-container text-secondary flex items-center justify-center font-bold text-xs shrink-0">
                {isReturn ? 'RS' : 'DP'}
              </div>
              <div className="leading-tight">
                <h3 className="font-bold text-sm text-white">
                  {isReturn ? 'Return Support' : 'Dispatcher Support'}
                </h3>
                <p className="text-[10px] text-secondary-fixed font-medium">#{tripId}</p>
              </div>
            </div>
            <button onClick={() => setShowChatModal(false)} className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-surface-container-lowest">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === 'captain' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[82%] p-3 rounded-2xl text-xs md:text-sm leading-relaxed ${
                    msg.sender === 'captain'
                      ? 'bg-secondary text-white rounded-br-none shadow-xs'
                      : 'bg-surface-container-high text-primary rounded-bl-none border border-outline-variant/30 shadow-xs'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-outline mt-1 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-white border-t border-outline-variant/20 flex gap-2 shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
              placeholder="Type message to dispatcher..."
              className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs md:text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
            />
            <button
              onClick={() => handleSendChatMessage()}
              className="px-4 py-2.5 bg-secondary text-white rounded-xl font-bold text-xs hover:bg-secondary/90 transition-all cursor-pointer flex items-center justify-center shadow-xs"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </div>
        </div>
      )}

      {!showChatModal &&
        !showReturnOtpModal &&
        !showPickupOtpModal &&
        !showDropOtpModal &&
        !showSellerPickupOtpModal &&
        !showCustomerDeliveryOtpModal &&
        !showFailReasonModal &&
        !showProductDeliveryModal && <CaptainBottomNav />}
    </div>
  );
};

export default ActiveDelivery;

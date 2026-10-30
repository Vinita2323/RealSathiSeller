import ProfileEditRequest from '../models/ProfileEditRequest.model.js';
import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

// Helper to label fields nicely
const FIELD_LABELS = {
  // Common / User
  fullName: 'Full Name',
  name: 'Full Name',
  ownerName: 'Owner Name / Full Name',
  email: 'Email Address',
  phone: 'Phone Number',
  dob: 'Date of Birth',
  age: 'Age',
  fatherName: "Father's Name",
  
  // Store / Seller
  storeName: 'Store Name',
  businessName: 'Business Name',
  businessType: 'Business Type',
  tagline: 'Store Tagline',
  serviceRadius: 'Service Radius (KM)',
  storeAddress: 'Store Address',
  storeLocation: 'Store Location',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  pinCode: 'Pincode',
  area: 'Area / Locality',
  lat: 'Store Latitude',
  lng: 'Store Longitude',
  categories: 'Store Categories',
  storeLogo: 'Store Logo',
  gstNumber: 'GSTIN Number',
  gstin: 'GSTIN Number',
  panNumber: 'PAN Number',
  fssaiLicense: 'FSSAI License No.',
  fssai: 'FSSAI License No.',
  bankName: 'Bank Name',
  accountNumber: 'Account Number',
  ifscCode: 'IFSC Code',
  gstPhoto: 'GST Certificate Photo',
  bankPassbookPhoto: 'Bank Passbook / Cheque Photo',

  // Captain
  alternateMobile: 'Alternate Mobile',
  currentAddress: 'Current Address',
  permanentAddress: 'Permanent Address',
  emergencyContact: 'Emergency Contact',
  vehicleType: 'Vehicle Type',
  drivingLicenseNumber: 'Driving License No.',
  rcNumber: 'RC Number',
  vehicleInsuranceNumber: 'Insurance Policy No.',
  insuranceValidTill: 'Insurance Valid Till',
  documents: 'Verification Documents',
  bankDetails: 'Banking Settlement Details',
};

// Canonical normalizer to align field names between database records and incoming requests
export const normalizeRequesterData = (role, rawData) => {
  if (!rawData) return {};
  const d = { ...rawData };

  if (role === 'user') {
    return {
      fullName: d.fullName !== undefined ? d.fullName : (d.name || ''),
      email: d.email || '',
      phone: d.phone || d.mobile || '',
      dob: d.dob || '',
    };
  }

  if (role === 'seller') {
    const wl = d.warehouseLocation || {};
    const coords = wl.location?.coordinates || [d.lng || 0, d.lat || 0];

    return {
      ownerName: d.ownerName !== undefined ? d.ownerName : (d.fullName || ''),
      businessName: d.businessName !== undefined ? d.businessName : (d.storeName || ''),
      email: d.email || '',
      phone: d.phone || d.mobile || '',
      businessType: d.businessType || '',
      tagline: d.tagline || '',
      serviceRadius: d.serviceRadius != null ? Number(d.serviceRadius) : 5,
      storeAddress: d.storeAddress || d.storeLocation || wl.storeAddress || '',
      city: d.city || wl.city || '',
      state: d.state || wl.state || '',
      pincode: d.pincode || d.pinCode || wl.pincode || '',
      area: d.area || wl.area || '',
      lat: d.lat != null ? Number(d.lat) : (coords[1] != null && coords[1] !== 0 ? coords[1] : null),
      lng: d.lng != null ? Number(d.lng) : (coords[0] != null && coords[0] !== 0 ? coords[0] : null),
      gstNumber: d.gstNumber !== undefined ? d.gstNumber : (d.gstin || ''),
      panNumber: d.panNumber || '',
      fssaiLicense: d.fssaiLicense !== undefined ? d.fssaiLicense : (d.fssai || ''),
      bankName: d.bankName || '',
      accountNumber: d.accountNumber || '',
      ifscCode: d.ifscCode || '',
      gstPhoto: d.gstPhoto || '',
      bankPassbookPhoto: d.bankPassbookPhoto || '',
      storeLogo: d.storeLogo || '',
      categories: Array.isArray(d.categories) ? d.categories : [],
    };
  }

  if (role === 'captain') {
    return {
      name: d.name !== undefined ? d.name : (d.fullName || ''),
      email: d.email || '',
      phone: d.phone || d.mobile || '',
      alternateMobile: d.alternateMobile || '',
      dob: d.dob || '',
      age: d.age || '',
      fatherName: d.fatherName || '',
      currentAddress: d.currentAddress || '',
      permanentAddress: d.permanentAddress || '',
      city: d.city || '',
      state: d.state || '',
      pinCode: d.pinCode || d.pincode || '',
      emergencyContact: d.emergencyContact || '',
      vehicleType: d.vehicleType || 'Two Wheeler',
      drivingLicenseNumber: d.drivingLicenseNumber || '',
      rcNumber: d.rcNumber || '',
      vehicleInsuranceNumber: d.vehicleInsuranceNumber || '',
      insuranceValidTill: d.insuranceValidTill || '',
      bankDetails: d.bankDetails || {},
      documents: d.documents || {},
    };
  }

  return d;
};

// Helper to calculate diff between old and new objects
const calculateDiff = (currentObj, newObj, prefix = '') => {
  const diffs = [];
  const allKeys = new Set([...Object.keys(newObj || {})]);

  for (const key of allKeys) {
    if (['password', 'otp', 'otpExpiry', '_id', '__v', 'createdAt', 'updatedAt', 'role'].includes(key)) continue;

    const oldVal = currentObj ? currentObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;

    if (newVal === undefined) continue;

    // Handle nested objects like bankDetails or documents
    if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
      const nestedDiffs = calculateDiff(oldVal || {}, newVal, `${prefix}${key}.`);
      diffs.push(...nestedDiffs);
      continue;
    }

    // Compare arrays
    if (Array.isArray(newVal)) {
      const oldArrStr = JSON.stringify(oldVal || []);
      const newArrStr = JSON.stringify(newVal || []);
      if (oldArrStr !== newArrStr) {
        const fullKey = `${prefix}${key}`;
        diffs.push({
          field: fullKey,
          label: FIELD_LABELS[key] || fullKey,
          oldValue: oldVal || [],
          newValue: newVal,
        });
      }
      continue;
    }

    // Primitive values comparison (normalize null, undefined, empty strings)
    const normalizedOld = oldVal === null || oldVal === undefined ? '' : String(oldVal).trim();
    const normalizedNew = newVal === null || newVal === undefined ? '' : String(newVal).trim();

    if (normalizedOld !== normalizedNew) {
      const fullKey = `${prefix}${key}`;
      diffs.push({
        field: fullKey,
        label: FIELD_LABELS[key] || fullKey,
        oldValue: oldVal ?? '',
        newValue: newVal ?? '',
      });
    }
  }

  return diffs;
};

// 1. Submit Edit Request (For Seller, User, Captain)
export const submitEditRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const rawRole = (req.body.role || req.user.role || 'user').toLowerCase();
    
    let requesterRole = 'user';
    let requesterRoleModel = 'User';
    if (rawRole.includes('seller')) {
      requesterRole = 'seller';
      requesterRoleModel = 'Seller';
    } else if (rawRole.includes('captain') || rawRole.includes('delivery')) {
      requesterRole = 'captain';
      requesterRoleModel = 'Captain';
    }

    // Fetch current profile from DB
    let currentDoc = null;
    let requesterName = '';
    let requesterPhone = '';
    let requesterEmail = '';

    if (requesterRole === 'seller') {
      currentDoc = await Seller.findById(userId);
      if (!currentDoc) return res.status(404).json({ success: false, message: 'Seller not found' });
      requesterName = currentDoc.ownerName || currentDoc.businessName || 'Seller';
      requesterPhone = currentDoc.phone || '';
      requesterEmail = currentDoc.email || '';
    } else if (requesterRole === 'captain') {
      currentDoc = await Captain.findById(userId);
      if (!currentDoc) return res.status(404).json({ success: false, message: 'Captain not found' });
      requesterName = currentDoc.name || 'Captain Partner';
      requesterPhone = currentDoc.phone || '';
      requesterEmail = currentDoc.email || '';
    } else {
      currentDoc = await User.findById(userId);
      if (!currentDoc) return res.status(404).json({ success: false, message: 'User not found' });
      requesterName = currentDoc.name || 'User';
      requesterPhone = currentDoc.phone || '';
      requesterEmail = currentDoc.email || '';
    }

    const currentDocObj = currentDoc.toObject();
    const incomingData = { ...req.body };
    delete incomingData.role;

    // Process Base64 images for documents & logos to Cloudinary
    if (incomingData.storeLogo && typeof incomingData.storeLogo === 'string' && incomingData.storeLogo.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(incomingData.storeLogo, 'sellers/logos');
        incomingData.storeLogo = uploadRes.secure_url;
      } catch (e) {
        console.warn('Cloudinary upload warning (storeLogo):', e.message);
      }
    }

    if (incomingData.gstPhoto && typeof incomingData.gstPhoto === 'string' && incomingData.gstPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(incomingData.gstPhoto, 'sellers/documents');
        incomingData.gstPhoto = uploadRes.secure_url;
      } catch (e) {
        console.warn('Cloudinary upload warning (gstPhoto):', e.message);
      }
    }

    if (incomingData.bankPassbookPhoto && typeof incomingData.bankPassbookPhoto === 'string' && incomingData.bankPassbookPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(incomingData.bankPassbookPhoto, 'sellers/documents');
        incomingData.bankPassbookPhoto = uploadRes.secure_url;
      } catch (e) {
        console.warn('Cloudinary upload warning (bankPassbookPhoto):', e.message);
      }
    }

    // Process Captain documents object if present
    if (incomingData.documents && typeof incomingData.documents === 'object') {
      for (const [docKey, docVal] of Object.entries(incomingData.documents)) {
        if (typeof docVal === 'string' && docVal.startsWith('data:image/')) {
          try {
            const uploadRes = await uploadToCloudinary(docVal, 'captains/documents');
            incomingData.documents[docKey] = uploadRes.secure_url;
          } catch (e) {
            console.warn(`Cloudinary upload warning (${docKey}):`, e.message);
          }
        }
      }
    }

    // Normalize both current DB state and incoming payload for robust side-by-side comparison
    const normalizedCurrent = normalizeRequesterData(requesterRole, currentDocObj);
    const normalizedIncoming = normalizeRequesterData(requesterRole, incomingData);

    // Calculate diffs between current profile and incoming data
    const changedFields = calculateDiff(normalizedCurrent, normalizedIncoming);

    if (changedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected compared to your current profile.',
      });
    }

    // Check if there is already a pending edit request for this requester
    let editRequest = await ProfileEditRequest.findOne({
      requesterId: userId,
      status: 'pending',
    });

    if (editRequest) {
      editRequest.updatedData = normalizedIncoming;
      editRequest.currentData = normalizedCurrent;
      editRequest.changedFields = changedFields;
      editRequest.requesterName = normalizedIncoming.fullName || normalizedIncoming.ownerName || normalizedIncoming.name || requesterName;
      editRequest.requesterPhone = normalizedIncoming.phone || requesterPhone;
      editRequest.requesterEmail = normalizedIncoming.email || requesterEmail;
      await editRequest.save();
    } else {
      editRequest = await ProfileEditRequest.create({
        requesterId: userId,
        requesterRole,
        requesterRoleModel,
        requesterName: normalizedIncoming.fullName || normalizedIncoming.ownerName || normalizedIncoming.name || requesterName,
        requesterPhone: normalizedIncoming.phone || requesterPhone,
        requesterEmail: normalizedIncoming.email || requesterEmail,
        currentData: normalizedCurrent,
        updatedData: normalizedIncoming,
        changedFields,
        status: 'pending',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile update request submitted for admin verification successfully!',
      request: editRequest,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get My Active Pending Edit Request (For Requester UI)
export const getMyPendingEditRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const request = await ProfileEditRequest.findOne({
      requesterId: userId,
      status: 'pending',
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      hasPendingRequest: Boolean(request),
      request: request || null,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Admin: Get All Edit Requests (with filters and pagination)
export const getAllEditRequests = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 15 } = req.query;

    const query = {};

    if (role && role !== 'all') {
      query.requesterRole = role.toLowerCase();
    }

    if (status && status !== 'all') {
      query.status = status.toLowerCase();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { requesterName: regex },
        { requesterPhone: regex },
        { requesterEmail: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 15);
    const skip = (pageNum - 1) * limitNum;

    const [requests, total, counts] = await Promise.all([
      ProfileEditRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProfileEditRequest.countDocuments(query),
      ProfileEditRequest.aggregate([
        {
          $group: {
            _id: { role: '$requesterRole', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Format statistics summary for admin badges
    const stats = {
      totalPending: 0,
      sellerPending: 0,
      captainPending: 0,
      userPending: 0,
      totalApproved: 0,
      totalRejected: 0,
    };

    counts.forEach((c) => {
      if (c._id.status === 'pending') {
        stats.totalPending += c.count;
        if (c._id.role === 'seller') stats.sellerPending += c.count;
        if (c._id.role === 'captain') stats.captainPending += c.count;
        if (c._id.role === 'user') stats.userPending += c.count;
      } else if (c._id.status === 'approved') {
        stats.totalApproved += c.count;
      } else if (c._id.status === 'rejected') {
        stats.totalRejected += c.count;
      }
    });

    res.status(200).json({
      success: true,
      requests,
      total,
      stats,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Admin: Get Single Edit Request by ID
export const getEditRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await ProfileEditRequest.findById(id).populate('reviewedBy', 'name email');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Edit request not found' });
    }

    res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Admin: Approve Edit Request & Apply Profile Changes
export const approveEditRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || req.user?._id;

    const request = await ProfileEditRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Edit request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}.`,
      });
    }

    const { requesterId, requesterRole, updatedData } = request;

    // Apply updates directly to the target record in DB
    if (requesterRole === 'seller') {
      const seller = await Seller.findById(requesterId);
      if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

      if (updatedData.businessName !== undefined) seller.businessName = updatedData.businessName;
      if (updatedData.ownerName !== undefined) seller.ownerName = updatedData.ownerName;
      if (updatedData.email !== undefined) seller.email = updatedData.email;
      if (updatedData.businessType !== undefined) seller.businessType = updatedData.businessType;
      if (updatedData.storeLogo !== undefined) seller.storeLogo = updatedData.storeLogo;
      if (updatedData.serviceRadius !== undefined) seller.serviceRadius = Math.max(0.1, Math.min(200, Number(updatedData.serviceRadius) || 5));
      if (updatedData.tagline !== undefined) seller.tagline = updatedData.tagline;
      if (updatedData.gstNumber !== undefined) seller.gstNumber = updatedData.gstNumber;
      if (updatedData.panNumber !== undefined) seller.panNumber = updatedData.panNumber;
      if (updatedData.fssaiLicense !== undefined) seller.fssaiLicense = updatedData.fssaiLicense;
      if (updatedData.gstPhoto !== undefined) seller.gstPhoto = updatedData.gstPhoto;
      if (updatedData.bankPassbookPhoto !== undefined) seller.bankPassbookPhoto = updatedData.bankPassbookPhoto;
      if (updatedData.bankName !== undefined) seller.bankName = updatedData.bankName;
      if (updatedData.accountNumber !== undefined) seller.accountNumber = updatedData.accountNumber;
      if (updatedData.ifscCode !== undefined) seller.ifscCode = updatedData.ifscCode;
      if (updatedData.categories !== undefined) seller.categories = updatedData.categories;

      // Warehouse / Address Location
      const storeAddress = updatedData.storeAddress || updatedData.storeLocation || seller.warehouseLocation?.storeAddress;
      const city = updatedData.city || seller.warehouseLocation?.city;
      const state = updatedData.state || seller.warehouseLocation?.state;
      const pincode = updatedData.pincode || seller.warehouseLocation?.pincode;
      const area = updatedData.area || seller.warehouseLocation?.area;

      const newCoords = [
        updatedData.lng != null && !isNaN(updatedData.lng) ? Number(updatedData.lng) : seller.warehouseLocation?.location?.coordinates?.[0] || seller.location?.coordinates?.[0] || 0,
        updatedData.lat != null && !isNaN(updatedData.lat) ? Number(updatedData.lat) : seller.warehouseLocation?.location?.coordinates?.[1] || seller.location?.coordinates?.[1] || 0,
      ];

      seller.location = {
        type: 'Point',
        coordinates: newCoords,
      };

      seller.warehouseLocation = {
        storeAddress,
        city,
        state,
        pincode,
        area,
        location: {
          type: 'Point',
          coordinates: newCoords,
        },
      };

      await seller.save();
    } else if (requesterRole === 'captain') {
      const captain = await Captain.findById(requesterId);
      if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });

      if (updatedData.name !== undefined) captain.name = updatedData.name;
      if (updatedData.email !== undefined) captain.email = updatedData.email;
      if (updatedData.alternateMobile !== undefined) captain.alternateMobile = updatedData.alternateMobile;
      if (updatedData.dob !== undefined) captain.dob = updatedData.dob;
      if (updatedData.age !== undefined) captain.age = updatedData.age;
      if (updatedData.fatherName !== undefined) captain.fatherName = updatedData.fatherName;
      if (updatedData.currentAddress !== undefined) captain.currentAddress = updatedData.currentAddress;
      if (updatedData.permanentAddress !== undefined) captain.permanentAddress = updatedData.permanentAddress;
      if (updatedData.city !== undefined) captain.city = updatedData.city;
      if (updatedData.state !== undefined) captain.state = updatedData.state;
      if (updatedData.pinCode !== undefined) captain.pinCode = updatedData.pinCode;
      if (updatedData.emergencyContact !== undefined) captain.emergencyContact = updatedData.emergencyContact;
      if (updatedData.vehicleType !== undefined) captain.vehicleType = updatedData.vehicleType;
      if (updatedData.drivingLicenseNumber !== undefined) captain.drivingLicenseNumber = updatedData.drivingLicenseNumber;
      if (updatedData.rcNumber !== undefined) captain.rcNumber = updatedData.rcNumber;
      if (updatedData.vehicleInsuranceNumber !== undefined) captain.vehicleInsuranceNumber = updatedData.vehicleInsuranceNumber;
      if (updatedData.insuranceValidTill !== undefined) captain.insuranceValidTill = updatedData.insuranceValidTill;

      if (updatedData.bankDetails) {
        captain.bankDetails = {
          ...captain.bankDetails,
          ...updatedData.bankDetails,
        };
      }

      if (updatedData.documents) {
        captain.documents = {
          ...captain.documents,
          ...updatedData.documents,
        };
      }

      await captain.save();
    } else {
      // User
      const user = await User.findById(requesterId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (updatedData.name !== undefined || updatedData.fullName !== undefined) {
        user.name = updatedData.fullName || updatedData.name;
      }
      if (updatedData.email !== undefined) user.email = updatedData.email;
      if (updatedData.phone !== undefined) user.phone = updatedData.phone;
      if (updatedData.dob !== undefined) user.dob = updatedData.dob;

      await user.save();
    }

    // Mark Request as Approved
    request.status = 'approved';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await request.save();

    res.status(200).json({
      success: true,
      message: `Profile edit request for ${requesterRole.toUpperCase()} approved and updated successfully!`,
      request,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Admin: Reject Edit Request
export const rejectEditRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user?.id || req.user?._id;

    const request = await ProfileEditRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Edit request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}.`,
      });
    }

    request.status = 'rejected';
    request.adminNote = adminNote || 'Profile edit request rejected by administrator.';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Profile edit request rejected successfully.',
      request,
    });
  } catch (error) {
    next(error);
  }
};

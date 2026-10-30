import User from '../models/User.model.js';

// Get user addresses
export const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      addresses: user.addresses || [],
    });
  } catch (error) {
    next(error);
  }
};

// Add new address
export const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const {
      fullName,
      phone,
      altPhone,
      email,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country,
      addressType,
      isDefault,
      location,
    } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Phone, Address Line 1, City, State, and Pincode are required',
      });
    }

    // If making default or if first address, unset previous defaults
    const shouldBeDefault = isDefault || (user.addresses && user.addresses.length === 0);

    if (shouldBeDefault && user.addresses) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    const lng = Number(location?.coordinates?.[0]);
    const lat = Number(location?.coordinates?.[1]);
    const hasPoint = Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0);

    user.addresses.push({
      fullName,
      phone,
      altPhone,
      email,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country: country || 'India',
      addressType: addressType || 'Home',
      isDefault: shouldBeDefault,
      ...(hasPoint
        ? {
            location: {
              type: 'Point',
              coordinates: [lng, lat],
            },
          }
        : {}),
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      addresses: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// Update address
export const updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const {
      fullName,
      phone,
      altPhone,
      email,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country,
      addressType,
      isDefault,
    } = req.body;

    if (isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    if (fullName) address.fullName = fullName;
    if (phone) address.phone = phone;
    if (altPhone !== undefined) address.altPhone = altPhone;
    if (email !== undefined) address.email = email;
    if (addressLine1) address.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
    if (landmark !== undefined) address.landmark = landmark;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;
    if (country) address.country = country;
    if (addressType) address.addressType = addressType;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      addresses: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// Delete address
export const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const target = user.addresses.id(addressId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const wasDefault = target.isDefault;
    user.addresses.pull({ _id: addressId });

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      addresses: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// Set default address
export const setDefaultAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let found = false;
    user.addresses.forEach((addr) => {
      if (addr._id.toString() === addressId) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Default address updated',
      addresses: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

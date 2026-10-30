import SupportSetting from '../models/SupportSetting.model.js';

const DEFAULT_SETTINGS = {
  customerPhone: '+91 63774 60692',
  customerEmail: 'shippnexin26@gmail.com',
  customerHours: '24/7 Priority Support',
  sellerPhone: '+91 63774 60692',
  sellerEmail: 'shippnexin26@gmail.com',
  sellerHours: 'Mon - Sat (9 AM - 8 PM)',
  captainPhone: '+91 63774 60692',
  captainEmail: 'shippnexin26@gmail.com',
  captainHours: '24/7 Active Dispatch Line',
  whatsappNumber: '+91 63774 60692',
  bannerTitle: "We're here to help",
  bannerSubtitle: 'Have an issue with your order or want to share feedback? Connect with us directly.',
};

/**
 * @desc Get current platform support & contact settings
 * @route GET /api/support-settings
 * @access Public
 */
export const getSupportSettings = async (req, res) => {
  try {
    let settings = await SupportSetting.findOne().lean();
    if (!settings) {
      settings = await SupportSetting.create(DEFAULT_SETTINGS);
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching support settings:', error);
    res.status(200).json({ success: true, settings: DEFAULT_SETTINGS });
  }
};

/**
 * @desc Update platform support & contact settings
 * @route PUT /api/support-settings
 * @access Admin
 */
export const updateSupportSettings = async (req, res) => {
  try {
    let settings = await SupportSetting.findOne();
    if (!settings) {
      settings = new SupportSetting(DEFAULT_SETTINGS);
    }

    const {
      customerPhone,
      customerEmail,
      customerHours,
      sellerPhone,
      sellerEmail,
      sellerHours,
      captainPhone,
      captainEmail,
      captainHours,
      whatsappNumber,
      bannerTitle,
      bannerSubtitle,
    } = req.body;

    if (customerPhone !== undefined) settings.customerPhone = customerPhone.trim();
    if (customerEmail !== undefined) settings.customerEmail = customerEmail.trim();
    if (customerHours !== undefined) settings.customerHours = customerHours.trim();
    if (sellerPhone !== undefined) settings.sellerPhone = sellerPhone.trim();
    if (sellerEmail !== undefined) settings.sellerEmail = sellerEmail.trim();
    if (sellerHours !== undefined) settings.sellerHours = sellerHours.trim();
    if (captainPhone !== undefined) settings.captainPhone = captainPhone.trim();
    if (captainEmail !== undefined) settings.captainEmail = captainEmail.trim();
    if (captainHours !== undefined) settings.captainHours = captainHours.trim();
    if (whatsappNumber !== undefined) settings.whatsappNumber = whatsappNumber.trim();
    if (bannerTitle !== undefined) settings.bannerTitle = bannerTitle.trim();
    if (bannerSubtitle !== undefined) settings.bannerSubtitle = bannerSubtitle.trim();

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Support settings updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Error updating support settings:', error);
    res.status(500).json({ success: false, message: 'Server error updating support settings' });
  }
};

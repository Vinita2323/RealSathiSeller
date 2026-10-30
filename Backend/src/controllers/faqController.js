import mongoose from 'mongoose';
import Faq from '../models/Faq.model.js';

// In-memory cache for fast public FAQ delivery (5s short TTL for real-time responsiveness)
let cachedFaqs = null;
let lastFaqCacheTime = 0;
const FAQ_CACHE_TTL = 5 * 1000;

const DEFAULT_FAQS = [
  { category: 'General', question: 'How do I place an order on Sathi Seller?', answer: 'To place an order, browse products, add them to your cart, select your delivery address, and complete payment.' },
  { category: 'Customer', question: 'How can I track my shipment live?', answer: 'Go to your Orders section or enter your tracking ID on the Track Order page for real-time GPS tracking updates.' },
  { category: 'Seller', question: 'What is the settlement payout cycle for sellers?', answer: 'Payouts are automatically generated every Monday directly into your registered bank account.' },
  { category: 'Delivery Captain', question: 'How do I accept delivery requests?', answer: 'Toggle your status to Available in the Captain app to receive nearby instant delivery alerts.' },
  { category: 'General', question: 'What payment options are supported?', answer: 'Sathi Seller supports credit/debit cards, UPI, net banking, wallet balances, and Cash on Delivery.' }
];

const seedDefaultFaqsIfEmpty = async () => {
  const count = await Faq.countDocuments();
  if (count === 0) {
    await Faq.insertMany(DEFAULT_FAQS);
  }
};

/**
 * @desc Get all active public FAQs
 * @route GET /api/faqs
 * @access Public
 */
export const getPublicFaqs = async (req, res) => {
  try {
    const now = Date.now();
    if (cachedFaqs && (now - lastFaqCacheTime < FAQ_CACHE_TTL)) {
      return res.status(200).json({ success: true, count: cachedFaqs.length, faqs: cachedFaqs });
    }

    await seedDefaultFaqsIfEmpty();
    const faqs = await Faq.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
    
    cachedFaqs = faqs;
    lastFaqCacheTime = now;

    res.status(200).json({ success: true, count: faqs.length, faqs });
  } catch (error) {
    console.error('Error fetching public FAQs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching FAQs' });
  }
};

/**
 * @desc Get all FAQs for Admin
 * @route GET /api/faqs/admin
 * @access Admin
 */
export const getAdminFaqs = async (req, res) => {
  try {
    await seedDefaultFaqsIfEmpty();
    const faqs = await Faq.find().sort({ order: 1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: faqs.length, faqs });
  } catch (error) {
    console.error('Error fetching admin FAQs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching FAQs' });
  }
};

/**
 * @desc Create new FAQ
 * @route POST /api/faqs
 * @access Admin
 */
export const createFaq = async (req, res) => {
  try {
    const { question, answer, category, order, isActive } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'Question and answer are required' });
    }

    const faq = await Faq.create({
      question: question.trim(),
      answer: answer.trim(),
      category: category ? category.trim() : 'General',
      order: order !== undefined ? Number(order) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    cachedFaqs = null; // Invalidate cache immediately
    lastFaqCacheTime = 0;

    res.status(201).json({ success: true, message: 'FAQ created successfully', faq });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ success: false, message: 'Server error creating FAQ' });
  }
};

/**
 * @desc Update FAQ
 * @route PUT /api/faqs/:id
 * @access Admin
 */
export const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, order, isActive } = req.body;

    let faq = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      faq = await Faq.findById(id);
    }
    if (!faq) {
      faq = await Faq.findOne({ $or: [{ _id: id }, { question: id }] });
    }

    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    if (question) faq.question = question.trim();
    if (answer) faq.answer = answer.trim();
    if (category) faq.category = category.trim();
    if (order !== undefined) faq.order = Number(order);
    if (isActive !== undefined) faq.isActive = Boolean(isActive);

    await faq.save();
    cachedFaqs = null; // Invalidate cache immediately
    lastFaqCacheTime = 0;

    res.status(200).json({ success: true, message: 'FAQ updated successfully', faq });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ success: false, message: 'Server error updating FAQ' });
  }
};

/**
 * @desc Delete FAQ
 * @route DELETE /api/faqs/:id
 * @access Admin
 */
export const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    let faq = null;
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      faq = await Faq.findByIdAndDelete(id);
    }
    if (!faq) {
      faq = await Faq.findOneAndDelete({ $or: [{ _id: id }, { question: id }] });
    }

    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    cachedFaqs = null; // Invalidate cache immediately
    lastFaqCacheTime = 0;

    res.status(200).json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ success: false, message: 'Server error deleting FAQ' });
  }
};

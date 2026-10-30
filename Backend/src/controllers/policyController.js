import Policy from '../models/Policy.model.js';

// Default policies seed data
const DEFAULT_POLICIES = [
  // 1. User Terms of Service
  {
    target: 'user',
    type: 'terms',
    title: 'Customer Terms of Service',
    version: 'v1.0',
    effectiveDate: 'September 1, 2026',
    sections: [
      {
        heading: '1. Account & Registration',
        body: 'By browsing or placing orders on Sathi Seller, you agree to these Terms and are responsible for keeping your login credentials secure.'
      },
      {
        heading: '2. Pricing & Payments',
        body: 'Prices include applicable taxes. We accept UPI, Cards, Netbanking via Razorpay, and Cash on Delivery (COD).'
      },
      {
        heading: '3. Delivery & Tracking',
        body: 'Orders are delivered by verified captains. Real-time live route tracking is available directly from your order dashboard.'
      },
      {
        heading: '4. Cancellations & Returns',
        body: 'Orders can be cancelled before dispatch. For damaged or incorrect items, initiate return requests within 24 hours of delivery.'
      },
      {
        heading: '5. Platform Support & Safety',
        body: 'Sathi Seller facilitates verified merchant transactions and express delivery with dedicated customer care support.'
      }
    ]
  },
  // 2. User Privacy Policy
  {
    target: 'user',
    type: 'privacy',
    title: 'Customer Privacy Policy',
    version: 'v1.0',
    effectiveDate: 'September 1, 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect your name, phone number, and delivery addresses to fulfill orders, process payments, and provide delivery updates.'
      },
      {
        heading: '2. How We Use Information',
        body: 'Your information is used strictly to process orders, assign nearby delivery captains, and maintain account security.'
      },
      {
        heading: '3. Data Sharing & Disclosure',
        body: 'Delivery details (address & contact) are shared solely with the assigned merchant and delivery captain to complete your order.'
      },
      {
        heading: '4. Data Security',
        body: 'Your personal data is encrypted with industry-standard protocols and never sold or shared with third-party advertisers.'
      }
    ]
  },
  // 3. Seller Terms of Service
  {
    target: 'seller',
    type: 'terms',
    title: 'Seller & Merchant Terms of Service',
    version: 'v1.0',
    effectiveDate: 'September 1, 2026',
    sections: [
      {
        heading: '1. Merchant Onboarding & Verification',
        body: 'All sellers registering on Sathi Seller must provide valid business details, GSTIN (where applicable), bank account details, and proof of identity. Approval is granted upon verification by the Sathi Seller administration.'
      },
      {
        heading: '2. Product Listings & Quality Standards',
        body: 'Sellers are solely responsible for ensuring accurate product titles, descriptions, pricing, MRP, expiry dates, and genuine stock levels. Sale of prohibited, counterfeit, or expired goods will result in immediate suspension.'
      },
      {
        heading: '3. Order Fulfillment & Packaging SLA',
        body: 'Merchants must accept and package incoming orders within the specified Service Level Agreement (SLA) time window. Orders must be securely packed and handed over to the assigned Sathi Seller delivery captain upon OTP/handover verification.'
      },
      {
        heading: '4. Commissions, Payouts & Settlement',
        body: 'Sathi Seller deducts the agreed platform commission percentage on completed orders. Net seller payouts are settled directly to the registered bank account according to the scheduled payout cycle after deducting returns and cancellations.'
      },
      {
        heading: '5. Account Suspension & Termination',
        body: 'Sathi Seller reserves the right to suspend or permanently terminate seller accounts that repeatedly violate quality guidelines, indulge in fraudulent orders, or fail to honor customer return requests.'
      }
    ]
  },
  // 4. Seller Privacy Policy
  {
    target: 'seller',
    type: 'privacy',
    title: 'Seller Privacy & Data Policy',
    version: 'v1.0',
    effectiveDate: 'September 1, 2026',
    sections: [
      {
        heading: '1. Merchant Information Collection',
        body: 'We collect your business name, proprietor identity, contact phone, store address, GST registration certificate, cancelled cheque / bank passbook photo, and banking information for vendor onboarding and payouts.'
      },
      {
        heading: '2. Use of Business & Store Data',
        body: 'Store information is displayed to buyers in our multi-vendor marketplace. Financial and KYC documents are strictly stored in encrypted storage and accessible only to authorized compliance administrators.'
      },
      {
        heading: '3. Confidentiality of Customer Information',
        body: 'Sellers receive customer names and delivery instructions solely for the purpose of packing and dispatching orders. Sellers agree not to harvest, export, or misuse customer information for external marketing.'
      }
    ]
  },
  // 5. Captain Terms of Service
  {
    target: 'captain',
    type: 'terms',
    title: 'Captain Terms of Service',
    version: 'v1.0',
    effectiveDate: 'September 1, 2026',
    sections: [
      {
        heading: '1. Onboarding & Verification',
        body: 'Captains must possess a valid Driving License, vehicle RC, insurance, Aadhaar card, and pass live selfie verification.'
      },
      {
        heading: '2. Delivery & OTP Verification',
        body: 'Handle packages with care. Always verify the 4-digit Delivery OTP from the customer before completing an order.'
      },
      {
        heading: '3. Cash Collection (COD)',
        body: 'Collect the exact cash amount for COD orders and deposit cash collections to Sathi Seller as per daily settlement rules.'
      },
      {
        heading: '4. Earnings & Payouts',
        body: 'Per-order payouts, distance surcharges, and incentives are credited instantly to your Captain Wallet and withdrawable to your bank.'
      },
      {
        heading: '5. Zero Tolerance Policy',
        body: 'Strict adherence to traffic safety. Misbehavior, theft, or fake GPS spoofing results in permanent blacklisting.'
      }
    ]
  },
  // 6. Captain Privacy Policy
  {
    target: 'captain',
    type: 'privacy',
    title: 'Captain Privacy Policy',
    version: 'v1.0',
    effectiveDate: 'September 1, 2026',
    sections: [
      {
        heading: '1. Location & GPS Tracking',
        body: 'We collect real-time background and foreground GPS location when you are Online to assign nearby delivery jobs and show live tracking.'
      },
      {
        heading: '2. Verification Documents',
        body: 'Driving license, RC, PAN, and live camera selfies are collected for safety verification, fraud prevention, and regulatory compliance.'
      },
      {
        heading: '3. Data Security & Privacy',
        body: 'Your identity and banking records are securely encrypted. Customers only see your first name, vehicle number, and phone number for delivery coordination.'
      }
    ]
  }
];

// Helper: Ensure defaults exist in DB
export const ensureDefaultPolicies = async () => {
  try {
    for (const policyData of DEFAULT_POLICIES) {
      const existing = await Policy.findOne({ target: policyData.target, type: policyData.type });
      if (!existing) {
        await Policy.create(policyData);
        console.log(`[PolicySeeder] Seeded default policy: ${policyData.target} - ${policyData.type}`);
      }
    }
  } catch (err) {
    console.warn('[PolicySeeder Error]', err.message);
  }
};

// @desc    Get all policies or filter by target/type
// @route   GET /api/policies
// @access  Public
export const getPolicies = async (req, res, next) => {
  try {
    await ensureDefaultPolicies();

    const { target, type } = req.query;
    const filter = {};
    if (target) filter.target = target.toLowerCase();
    if (type) filter.type = type.toLowerCase();

    const policies = await Policy.find(filter).sort({ target: 1, type: 1 });

    res.status(200).json({
      success: true,
      count: policies.length,
      policies,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single policy by target and type (e.g. user/terms)
// @route   GET /api/policies/:target/:type
// @access  Public
export const getPolicyByTargetAndType = async (req, res, next) => {
  try {
    const { target, type } = req.params;
    let policy = await Policy.findOne({
      target: target.toLowerCase(),
      type: type.toLowerCase(),
    });

    if (!policy) {
      // Find fallback from default policies
      const def = DEFAULT_POLICIES.find(
        (p) => p.target === target.toLowerCase() && p.type === type.toLowerCase()
      );
      if (def) {
        policy = await Policy.create(def);
      } else {
        return res.status(404).json({
          success: false,
          message: `Policy not found for ${target} - ${type}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      policy,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update policy
// @route   POST /api/policies
// @access  Private/Admin
export const saveOrUpdatePolicy = async (req, res, next) => {
  try {
    const { target, type, title, version, effectiveDate, sections, published } = req.body;

    if (!target || !type || !title) {
      return res.status(400).json({
        success: false,
        message: 'Target, Type, and Title are required fields.',
      });
    }

    const cleanTarget = target.toLowerCase();
    const cleanType = type.toLowerCase();

    let policy = await Policy.findOne({ target: cleanTarget, type: cleanType });

    if (policy) {
      policy.title = title;
      if (version) policy.version = version;
      if (effectiveDate) policy.effectiveDate = effectiveDate;
      if (Array.isArray(sections)) policy.sections = sections;
      if (published !== undefined) policy.published = published;
      policy.updatedBy = req.user?.name || req.user?.email || 'Admin';

      await policy.save();

      return res.status(200).json({
        success: true,
        message: `${title} updated successfully!`,
        policy,
      });
    } else {
      policy = await Policy.create({
        target: cleanTarget,
        type: cleanType,
        title,
        version: version || 'v1.0',
        effectiveDate: effectiveDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        sections: Array.isArray(sections) ? sections : [],
        published: published !== undefined ? published : true,
        updatedBy: req.user?.name || req.user?.email || 'Admin',
      });

      return res.status(201).json({
        success: true,
        message: `${title} created successfully!`,
        policy,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete custom policy
// @route   DELETE /api/policies/:id
// @access  Private/Admin
export const deletePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findByIdAndDelete(id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Policy deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

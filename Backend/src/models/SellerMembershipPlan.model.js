import mongoose from 'mongoose';

const sellerMembershipPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    durationType: { type: String, enum: ['monthly', 'halfYearly', 'yearly'], required: true },
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '' },
    features: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'sellermembershipplans' }
);

const SellerMembershipPlan = mongoose.model('SellerMembershipPlan', sellerMembershipPlanSchema);
export default SellerMembershipPlan;

import mongoose from 'mongoose';

// Singleton settings for the repair module:
//  - catalogSeeded: default catalog is seeded once, so categories an admin deletes never come back
//  - hero: the banner shown at the top of the customer "Repair & Services" page (admin managed)
export const DEFAULT_REPAIR_HERO = {
  enabled: true,
  title: 'We pick up. We repair. We deliver.',
  subtitle: 'Free doorstep pickup. Pay only after you approve the quotation.',
  features: ['Doorstep pickup', 'Approve quotation', 'OTP delivery'],
};

const repairSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    catalogSeeded: { type: Boolean, default: false },
    hero: {
      enabled: { type: Boolean, default: DEFAULT_REPAIR_HERO.enabled },
      title: { type: String, trim: true, default: DEFAULT_REPAIR_HERO.title },
      subtitle: { type: String, trim: true, default: DEFAULT_REPAIR_HERO.subtitle },
      features: { type: [String], default: () => [...DEFAULT_REPAIR_HERO.features] },
    },
  },
  { timestamps: true }
);

const RepairSetting = mongoose.model('RepairSetting', repairSettingSchema);
export default RepairSetting;

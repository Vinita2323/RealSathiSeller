import mongoose from 'mongoose';

const repairCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const RepairCenter = mongoose.model('RepairCenter', repairCenterSchema);
export default RepairCenter;

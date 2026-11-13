import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Repair technician account. Created by the admin; logs in on /technician with phone + password.
const repairTechnicianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    password: { type: String, required: true, select: false },
    skills: { type: [String], default: [] },
    repairCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'RepairCenter', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

repairTechnicianSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

repairTechnicianSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

const RepairTechnician = mongoose.model('RepairTechnician', repairTechnicianSchema);
export default RepairTechnician;

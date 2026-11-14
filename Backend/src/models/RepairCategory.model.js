import mongoose from 'mongoose';

// Repair catalog entry: category -> brands/models -> problems, plus diagnosis fee ("repair pricing").
const repairCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, default: 'Wrench' },
    image: { type: String, trim: true, default: '' }, // optional custom picture; overrides the icon when set
    active: { type: Boolean, default: true },
    diagnosisFee: { type: Number, default: 199, min: 0 },
    brands: [
      {
        name: { type: String, required: true, trim: true },
        models: { type: [String], default: [] },
        _id: false,
      },
    ],
    problems: [
      {
        name: { type: String, required: true, trim: true },
        estimateMin: { type: Number, default: 0, min: 0 },
        estimateMax: { type: Number, default: 0, min: 0 },
        // Optional second level, shown on the next booking page after the customer picks this problem
        subProblems: [
          {
            name: { type: String, required: true, trim: true },
            estimateMin: { type: Number, default: 0, min: 0 },
            estimateMax: { type: Number, default: 0, min: 0 },
            _id: false,
          },
        ],
        _id: false,
      },
    ],
    priority: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const RepairCategory = mongoose.model('RepairCategory', repairCategorySchema);
export default RepairCategory;

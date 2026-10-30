import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      default: 'Groceries'
    },
    subCategory: {
      type: String,
      default: ''
    },
    brand: {
      type: String,
      default: ''
    },
    unitValue: {
      type: String,
      default: '1'
    },
    unitType: {
      type: String,
      default: 'kg'
    },
    unit: {
      type: String,
      default: '1 kg'
    },
    seller: {
      type: mongoose.Schema.Types.Mixed,
      default: 'Sathi Seller Official Store',
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
    },
    description: {
      type: String,
      default: ''
    },
    mrp: {
      type: Number,
      required: [true, 'MRP price is required'],
      min: 0
    },
    salePrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: 0
    },
    taxRate: {
      type: String,
      default: '5%'
    },
    hsnCode: {
      type: String,
      default: ''
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      default: 0
    },
    minStockLimit: {
      type: Number,
      default: 10
    },
    sku: {
      type: String,
      default: ''
    },
    mainImage: {
      type: String,
      default: ''
    },
    homeSections: {
      type: [String],
      default: []
    },
    galleryImages: {
      type: [String],
      default: []
    },
    hasVariants: {
      type: Boolean,
      default: false
    },
    variantOptions: [
      {
        name: { type: String, trim: true },
        values: [{ type: String, trim: true }]
      }
    ],
    variants: [
      {
        attributes: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        },
        title: { type: String, default: '' },
        sku: { type: String, default: '' },
        price: { type: Number, min: 0, default: 0 },
        originalPrice: { type: Number, min: 0, default: 0 },
        stock: { type: Number, min: 0, default: 0 },
        image: { type: String, default: '' },
        active: { type: Boolean, default: true }
      }
    ],
    status: {
      type: String,
      enum: ['Published', 'Draft', 'Pending Audit'],
      default: 'Published'
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    isReturnable: {
      type: Boolean,
      default: true
    },
    returnWindow: {
      type: Number,
      default: 7
    },
    returnPolicy: {
      type: String,
      default: '7 Days Returnable'
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    }
  },
  {
    timestamps: true
  }
);
// Targeted indexes matching actual query patterns
productSchema.index({ category: 1, status: 1 });
productSchema.index({ subCategory: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ homeSections: 1, status: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);

export default Product;

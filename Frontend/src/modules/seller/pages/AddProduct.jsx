import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, Tag, DollarSign, Boxes, CheckCircle, Package, Plus, ArrowLeft, ShieldCheck, RotateCcw, AlertCircle, Sparkles
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { categoryService, productService, authService, bannerService } from '../../../services/authService';
import { compressAndResizeImage } from '../../../utils/imageUtils';
import ProductVariantBuilder from '../components/ProductVariantBuilder';

const AddProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editId = id || searchParams.get('id') || searchParams.get('edit');
  const isEditMode = Boolean(editId);
  const [loadingProduct, setLoadingProduct] = useState(isEditMode);

  // Get Logged-in Seller Info
  const [sellerInfo, setSellerInfo] = useState(() => {
    try {
      const cached = localStorage.getItem('sathiseller_seller_data');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const res = await authService.getSellerProfile();
        if (res?.seller) setSellerInfo(res.seller);
      } catch (err) {}
    };
    fetchSeller();
  }, []);

  const defaultSellerName = sellerInfo?.businessName || sellerInfo?.ownerName || 'Seller Merchant';

  const initialData = {
    name: '',
    category: 'Groceries & Grains',
    subCategory: 'Grains & Pulses',
    brand: '',
    unitValue: '1',
    unitType: 'kg',
    description: '',
    mrp: '',
    salePrice: '',
    taxRate: '5%',
    hsnCode: '0713',
    stock: '',
    minStockLimit: '10',
    sku: '',
    seller: defaultSellerName,
    status: 'Published',
    isFeatured: false,
    isReturnable: true,
    returnWindow: '7',
    returnPolicy: '7 Days Returnable / Replacement',
    mainImage: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    mainImageFile: null,
    galleryImages: [],
    hasVariants: false,
    variantOptions: [],
    variants: []
  };


  const [formData, setFormData] = useState(initialData);

  // Fetch product to edit if in Edit Mode
  useEffect(() => {
    if (!editId) return;

    let isMounted = true;
    const fetchProductToEdit = async () => {
      setLoadingProduct(true);
      try {
        let prod = null;
        try {
          const res = await productService.getProductById(editId);
          if (res?.product) prod = res.product;
          else if (res?.data) prod = res.data;
        } catch (e) {
          console.warn('Backend getProductById error, fallback to local:', e.message);
        }

        if (!prod) {
          const localProds = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
          prod = localProds.find(p => (p._id && p._id === editId) || p.id === editId || p.sku === editId);
        }

        if (prod && isMounted) {
          setFormData({
            name: prod.name || '',
            category: prod.category || 'Groceries & Grains',
            subCategory: prod.subCategory || '',
            brand: prod.brand || '',
            unitValue: String(prod.unitValue || (prod.unit ? prod.unit.split(' ')[0] : '1')),
            unitType: String(prod.unitType || (prod.unit ? prod.unit.split(' ')[1] : 'kg')),
            description: prod.description || '',
            mrp: prod.mrp !== undefined ? String(prod.mrp) : '',
            salePrice: prod.salePrice !== undefined ? String(prod.salePrice) : (prod.price !== undefined ? String(prod.price) : ''),
            taxRate: prod.taxRate || '5%',
            hsnCode: prod.hsnCode || '0713',
            stock: prod.stock !== undefined ? String(prod.stock) : '',
            minStockLimit: prod.minStockLimit !== undefined ? String(prod.minStockLimit) : '10',
            sku: prod.sku || prod.id || '',
            seller: prod.seller || defaultSellerName,
            status: prod.status || 'Published',
            isFeatured: Boolean(prod.isFeatured),
            isReturnable: prod.isReturnable !== undefined ? Boolean(prod.isReturnable) : true,
            returnWindow: String(prod.returnWindow || '7'),
            returnPolicy: prod.returnPolicy || '7 Days Returnable / Replacement',
            mainImage: prod.mainImage || prod.image || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
            mainImageFile: null,
            galleryImages: Array.isArray(prod.galleryImages) ? prod.galleryImages : [],
            hasVariants: Boolean(prod.hasVariants || (Array.isArray(prod.variants) && prod.variants.length > 0)),
            variantOptions: Array.isArray(prod.variantOptions) ? prod.variantOptions : [],
            variants: Array.isArray(prod.variants) ? prod.variants : []
          });

          if (Array.isArray(prod.homeSections) && prod.homeSections.length > 0) {
            setSelectedHomeSections(prod.homeSections);
          }
        }
      } catch (err) {
        console.error('Failed to load product for editing:', err);
      } finally {
        if (isMounted) setLoadingProduct(false);
      }
    };

    fetchProductToEdit();
    return () => { isMounted = false; };
  }, [editId]);

  // Dynamic Categories State
  const [dynamicCategoryMap, setDynamicCategoryMap] = useState({});
  const [registeredCategories, setRegisteredCategories] = useState([]);

  useEffect(() => {
    const fetchRegisteredCategories = async () => {
      try {
        const res = await categoryService.getCategories();
        if (res && res.categories && res.categories.length > 0) {
          const flat = res.categories;
          const map = {};
          const idToName = {};
          
          flat.forEach(c => {
            idToName[c._id] = c.name;
            if (!c.parent) {
              map[c.name] = [];
            }
          });
          
          flat.forEach(c => {
            if (c.parent) {
              const parentName = idToName[c.parent];
              if (parentName && map[parentName]) {
                map[parentName].push(c.name);
              }
            }
          });
          
          setDynamicCategoryMap(map);
          const keys = Object.keys(map);
          setRegisteredCategories(keys);
          
          if (keys.length > 0) {
            const firstCat = keys[0];
            const firstSub = map[firstCat].length > 0 ? map[firstCat][0] : 'None';
            setFormData(prev => {
              if (isEditMode && prev.name) {
                return prev;
              }
              return {
                ...prev,
                category: prev.category && map[prev.category] ? prev.category : firstCat,
                subCategory: prev.category && map[prev.category] ? (map[prev.category].length > 0 ? map[prev.category][0] : 'None') : firstSub
              };
            });
          }
        }
      } catch (err) {
        console.warn('Using registered category catalog fallback:', err.message);
      }
    };
    fetchRegisteredCategories();
  }, [isEditMode]);

  const handleCategorySelectChange = (newCategory) => {
    const availableSubs = dynamicCategoryMap[newCategory] || [];
    setFormData(prev => ({
      ...prev,
      category: newCategory,
      subCategory: availableSubs.length > 0 ? availableSubs[0] : 'None'
    }));
  };

  const currentSubCategories = dynamicCategoryMap[formData.category] || [];
  const displaySubCategories = currentSubCategories.length > 0 ? currentSubCategories : ['None'];

  // Homepage Sections Selection
  const [selectedHomeSections, setSelectedHomeSections] = useState(['flash_sale', 'bestseller']);
  const [toastMsg, setToastMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSuccessModal, setCreatedSuccessModal] = useState(null);

  const fileInputRef = useRef(null);
  const multipleFileInputRef = useRef(null);

  const availableSections = [
    { id: 'flash_sale', name: 'Flash Sale', description: 'Limited-time deals with countdown timer', badge: 'Flash Sale' },
    { id: 'bestseller', name: 'Bestseller', description: 'Showcase in Top Bestseller carousel cards', badge: 'Bestseller' }
  ];

  const toggleHomeSection = (sectionId) => {
    setSelectedHomeSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const resetForm = () => {
    setFormData({
      ...initialData,
      seller: defaultSellerName
    });
    setCreatedSuccessModal(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleMultipleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const maxFiles = files.slice(0, 3);
    
    setUploadingImage(true);
    showToast(`Optimizing & uploading ${maxFiles.length} gallery image(s)...`);

    for (const file of maxFiles) {
      try {
        const compressed = await compressAndResizeImage(file, 1000, 1000, 0.75);
        if (compressed) {
          let finalUrl = compressed.dataUrl;
          try {
            const formDataUpload = new FormData();
            formDataUpload.append('image', compressed.file || file);
            const uploadRes = await bannerService.uploadImage(formDataUpload, 'products');
            if (uploadRes?.imageUrl || uploadRes?.filePath) {
              finalUrl = uploadRes.imageUrl || uploadRes.filePath;
            }
          } catch (uploadErr) {
            console.warn('Direct upload fallback to compressed image:', uploadErr.message);
          }

          setFormData(prev => {
            const newGallery = [...(prev.galleryImages || [])];
            if (newGallery.length < 3) {
              newGallery.push(finalUrl);
            }
            return { ...prev, galleryImages: newGallery };
          });
        }
      } catch (err) {
        console.error('Error processing gallery image:', err);
      }
    }
    setUploadingImage(false);
    showToast(`${maxFiles.length} gallery image(s) processed!`);
  };

  const removeGalleryImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      galleryImages: prev.galleryImages.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleDeviceFileUpload = async (e, field) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      try {
        setUploadingImage(true);
        showToast(`Optimizing & uploading "${file.name}"...`);
        const compressed = await compressAndResizeImage(file, 1000, 1000, 0.75);
        if (compressed) {
          let finalUrl = compressed.dataUrl;
          try {
            const formDataUpload = new FormData();
            formDataUpload.append('image', compressed.file || file);
            const uploadRes = await bannerService.uploadImage(formDataUpload, 'products');
            if (uploadRes?.imageUrl || uploadRes?.filePath) {
              finalUrl = uploadRes.imageUrl || uploadRes.filePath;
            }
          } catch (uploadErr) {
            console.warn('Direct upload fallback to compressed image:', uploadErr.message);
          }

          setFormData(prev => ({
            ...prev,
            [field]: finalUrl,
            [`${field}File`]: file.name
          }));
          showToast(`Image "${file.name}" uploaded successfully!`);
        }
      } catch (err) {
        console.error('Error uploading image:', err);
        showToast('Error optimizing image.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleFormSubmit = async (e, statusToSave = 'Published') => {
    e.preventDefault();

    // Validation for multi-variant products
    if (formData.hasVariants) {
      const validOptions = (formData.variantOptions || []).filter(
        opt => opt.name && opt.name.trim() && Array.isArray(opt.values) && opt.values.length > 0
      );
      if (validOptions.length === 0) {
        showToast('Please add at least one variant option with values (e.g. Size: 4, 5, 6, 7).');
        return;
      }
    }

    if (formData.salePrice === '' || isNaN(formData.salePrice) || Number(formData.salePrice) < 0) {
      showToast('Please provide a valid Selling Price (₹).');
      return;
    }
    if (formData.mrp === '' || isNaN(formData.mrp) || Number(formData.mrp) < 0) {
      showToast('Please provide a valid MRP Price (₹).');
      return;
    }
    if (formData.stock === '' || isNaN(formData.stock) || Number(formData.stock) < 0) {
      showToast('Please provide a valid Initial Stock Quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      let cleanMainImage = formData.mainImage;
      if (typeof cleanMainImage === 'string' && cleanMainImage.startsWith('data:image/') && cleanMainImage.length > 500000) {
        cleanMainImage = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80';
      }

      const finalSalePrice = Number(formData.salePrice || 0);
      const finalMrp = Number(formData.mrp || formData.salePrice || 0);
      const finalStock = Number(formData.stock || 0);
      const finalSku = formData.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

      // Filter out empty options with 0 values
      const cleanVariantOptions = formData.hasVariants && Array.isArray(formData.variantOptions)
        ? formData.variantOptions.filter(o => o.name && o.name.trim() && Array.isArray(o.values) && o.values.length > 0)
        : [];

      // Sync variants with standard product price and stock (avoid heavy duplicated base64 images)
      const syncedVariants = (formData.hasVariants && Array.isArray(formData.variants))
        ? formData.variants.map(v => ({
            ...v,
            price: finalSalePrice,
            originalPrice: finalMrp,
            stock: finalStock,
            image: v.image || ''
          }))
        : [];

      const firstActiveVariant = (formData.hasVariants && Array.isArray(syncedVariants) && syncedVariants.length > 0)
        ? (syncedVariants.find(v => v.active !== false) || syncedVariants[0])
        : null;

      const finalVariation = formData.hasVariants && firstActiveVariant 
        ? firstActiveVariant.title 
        : `${formData.unitValue || 1} ${formData.unitType || 'kg'}`;

      const payload = {
        ...formData,
        mainImage: cleanMainImage,
        seller: formData.seller || defaultSellerName,
        sellerId: sellerInfo?._id || sellerInfo?.id,
        homeSections: selectedHomeSections,
        status: statusToSave,
        sku: finalSku,
        mrp: finalMrp,
        salePrice: finalSalePrice,
        stock: finalStock,
        hasVariants: Boolean(formData.hasVariants && cleanVariantOptions.length > 0),
        variantOptions: cleanVariantOptions,
        variants: syncedVariants
      };

      if (isEditMode) {
        const res = await productService.updateProduct(editId, payload);
        console.log('Product updated in DB:', res);

        const updatedProd = res?.product || payload;
        const targetObj = {
          ...updatedProd,
          _id: editId,
          id: editId,
          name: formData.name,
          category: formData.category,
          subCategory: formData.subCategory,
          image: cleanMainImage,
          stock: finalStock,
          status: statusToSave,
          mrp: finalMrp,
          salePrice: finalSalePrice,
          hasVariants: Boolean(formData.hasVariants && cleanVariantOptions.length > 0),
          variantOptions: cleanVariantOptions,
          variants: syncedVariants
        };

        const existingLocal = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
        const updatedLocal = existingLocal.map(p => 
          ((p._id && p._id === editId) || p.id === editId || p.sku === formData.sku) ? { ...p, ...targetObj } : p
        );
        localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));

        showToast(`Product "${formData.name}" updated successfully!`);
        setTimeout(() => {
          navigate('/seller/products');
        }, 1200);
      } else {
        const res = await productService.createProduct(payload);
        console.log('Product saved to DB:', res);

        const createdProd = res?.product || res;
        const generatedSku = createdProd?.sku || finalSku;
        const newProductObj = {
          _id: createdProd?._id,
          id: createdProd?._id || generatedSku,
          name: formData.name || 'New Product',
          seller: formData.seller || defaultSellerName,
          category: formData.category,
          subCategory: formData.subCategory,
          image: createdProd?.mainImage || formData.mainImage || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
          galleryImages: createdProd?.galleryImages || formData.galleryImages || [],
          variation: finalVariation,
          stock: finalStock,
          status: statusToSave,
          mrp: finalMrp,
          salePrice: finalSalePrice,
          homeSections: selectedHomeSections,
          hasVariants: Boolean(formData.hasVariants && cleanVariantOptions.length > 0),
          variantOptions: cleanVariantOptions,
          variants: syncedVariants
        };

        const existingLocal = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
        const updatedLocal = [newProductObj, ...existingLocal.filter(p => p.id !== newProductObj.id)];
        localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));

        setCreatedSuccessModal(newProductObj);
        showToast(`Product "${formData.name}" added and saved to DB!`);
      }
    } catch (err) {
      console.error('Error saving product to backend DB:', err);
      showToast(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 font-sans relative max-w-7xl mx-auto">
      {/* Product Creation Success Modal */}
      {createdSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle size={36} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900 m-0">Product Added Successfully!</h3>
              <p className="text-xs text-slate-500">The product has been saved and is now listed in your product catalog.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3.5">
              <img 
                src={createdSuccessModal.image} 
                alt={createdSuccessModal.name} 
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-white shrink-0" 
              />
              <div className="space-y-0.5 flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 m-0 truncate">{createdSuccessModal.name}</h4>
                <p className="text-[11px] font-mono text-slate-400 m-0">SKU: <span className="font-semibold text-slate-700">{createdSuccessModal.id}</span></p>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs font-extrabold text-[#ff5500]">₹{createdSuccessModal.salePrice}</span>
                  <span className="text-[10px] text-slate-400 line-through">₹{createdSuccessModal.mrp}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded">
                    Stock: {createdSuccessModal.stock}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button 
                type="button"
                onClick={() => navigate('/seller/products')}
                className="flex-1 px-4 py-3 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md transition-all text-center flex items-center justify-center gap-1.5"
              >
                <Package size={16} /> View Products List
              </button>
              <button 
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-all text-center flex items-center justify-center gap-1.5"
              >
                <Plus size={16} /> Add Another Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Page Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900">
              {isEditMode ? 'Edit Product' : 'Add New Product'}
            </h2>
            {isEditMode && (
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[#ff5500]/10 text-[#ff5500] rounded-full border border-[#ff5500]/20">
                {formData.sku || editId}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEditMode 
              ? 'Modify and update product details, pricing, inventory stock, media, and homepage placement' 
              : 'Create and list new items with pricing, stock limits, media, and homepage section mapping'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/seller/products')}
          className="flex items-center gap-2 text-slate-700 font-bold text-xs hover:text-[#ff5500] cursor-pointer border border-slate-200 bg-slate-50 px-3.5 py-2 rounded-xl transition-all shrink-0 w-fit"
        >
          <ArrowLeft size={16} /> Back to Product List
        </button>
      </div>

      {loadingProduct && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#ff5500] border-t-transparent mb-3"></div>
          <p className="text-sm font-semibold text-slate-700">Loading product details for editing...</p>
        </div>
      )}

      <form onSubmit={(e) => handleFormSubmit(e, 'Published')} className="max-w-4xl mx-auto space-y-6">
        {/* Card 1: Basic Information */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText size={18} className="text-[#ff5500]" /> General Product Information
          </h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Name *</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Premium Organics Basmati Rice"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#ff5500]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Registered Category *</label>
              <select 
                value={formData.category}
                onChange={(e) => handleCategorySelectChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                {registeredCategories.length > 0 ? (
                  registeredCategories.map(catName => (
                    <option key={catName} value={catName}>{catName}</option>
                  ))
                ) : (
                  <>
                    <option value="Groceries & Grains">Groceries & Grains</option>
                    <option value="Edible Oils & Ghee">Edible Oils & Ghee</option>
                    <option value="Spices & Masala">Spices & Masala</option>
                    <option value="Pulses & Rice">Pulses & Rice</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sub-Category *</label>
              <select 
                value={formData.subCategory}
                onChange={(e) => handleInputChange('subCategory', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                {displaySubCategories.map(subName => (
                  <option key={subName} value={subName}>{subName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand</label>
              <input 
                type="text" 
                placeholder="e.g. Fortune / Daawat"
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller Store Name</label>
              <input
                type="text" 
                readOnly
                value={formData.seller}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Description</label>
            <textarea 
              rows={4}
              placeholder="Write a brief overview of product freshness, origin, quality certification..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
            />
          </div>
        </div>

        {/* Card 2: Dynamic Product Variants System */}
        <ProductVariantBuilder 
          category={formData.category}
          basePrice={formData.salePrice}
          baseMrp={formData.mrp}
          baseStock={formData.stock}
          baseSku={formData.sku}
          productName={formData.name}
          unitValue={formData.unitValue}
          unitType={formData.unitType}
          onUnitChange={(field, val) => handleInputChange(field, val)}
          hasVariants={formData.hasVariants}
          onHasVariantsChange={(val) => handleInputChange('hasVariants', val)}
          variantOptions={formData.variantOptions}
          onVariantOptionsChange={(opts) => handleInputChange('variantOptions', opts)}
          variants={formData.variants}
          onVariantsChange={(vars) => handleInputChange('variants', vars)}
          availableImages={[formData.mainImage, ...(formData.galleryImages || [])].filter(Boolean)}
        />

        {/* Card 2: Primary Image Upload */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Upload size={18} className="text-[#ff5500]" /> Product Image Upload
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload Primary Image from Device *</label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onClick={(e) => { e.target.value = null; }}
                onChange={(e) => handleDeviceFileUpload(e, 'mainImage')}
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#ff5500] bg-slate-50 hover:bg-orange-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-[#ff5500] text-[#ff5500] group-hover:text-white flex items-center justify-center mx-auto transition-colors">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#ff5500]">
                    Click to Browse or Upload Image
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Supports PNG, JPG, WEBP from your computer device</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Device Upload Preview</label>
              <div className="h-44 w-full rounded-2xl overflow-hidden border border-slate-200 relative group bg-slate-100 flex items-center justify-center">
                {formData.mainImage ? (
                  <>
                    <img src={formData.mainImage} alt="Uploaded Product" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        className="px-3.5 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-semibold border-none cursor-pointer shadow-md"
                      >
                        Change Image
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">No Image Selected</span>
                )}
              </div>
              {formData.mainImageFile && (
                <p className="text-xs font-mono text-emerald-600 font-medium mt-1">Selected file: {formData.mainImageFile}</p>
              )}
            </div>
          </div>
        </div>

        {/* Card 2.5: Product Gallery Images (Max 3) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Upload size={18} className="text-[#ff5500]" /> Product Gallery Images
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload up to 3 Gallery Images</label>
              <input 
                type="file" 
                ref={multipleFileInputRef}
                accept="image/*"
                multiple
                onClick={(e) => { e.target.value = null; }}
                onChange={handleMultipleFileUpload}
                className="hidden"
              />
              <div 
                onClick={() => multipleFileInputRef.current && multipleFileInputRef.current.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#ff5500] bg-slate-50 hover:bg-orange-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-[#ff5500] text-[#ff5500] group-hover:text-white flex items-center justify-center mx-auto transition-colors">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#ff5500]">
                    Select Multiple Images
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Supports PNG, JPG, WEBP</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Gallery Preview ({formData.galleryImages?.length || 0}/3)</label>
              <div className="flex flex-wrap gap-3">
                {formData.galleryImages && formData.galleryImages.length > 0 ? (
                  formData.galleryImages.map((imgBase64, idx) => (
                    <div key={idx} className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 relative group">
                      <img src={imgBase64} alt={`Gallery ${idx+1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="w-6 h-6 rounded-full bg-white text-red-600 flex items-center justify-center shadow hover:bg-red-50 hover:text-red-700 cursor-pointer border-none"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-24 w-full rounded-xl bg-slate-50 border border-slate-200 border-dashed flex items-center justify-center text-slate-400 text-xs font-medium">
                    No gallery images uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Homepage Section Selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Tag size={18} className="text-[#ff5500]" /> Display on Homepage Sections
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Select one or multiple sections on the Customer App Homepage where this product will be shown.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-[#ff5500]">
              {selectedHomeSections.length} Selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {availableSections.map(sec => {
              const isSelected = selectedHomeSections.includes(sec.id);
              return (
                <div 
                  key={sec.id}
                  onClick={() => toggleHomeSection(sec.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected 
                      ? 'bg-orange-50/60 border-[#ff5500] shadow-2xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Handled by parent div
                    className="mt-1 w-4 h-4 accent-[#ff5500] cursor-pointer"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{sec.name}</span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                        {sec.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 m-0">{sec.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 4: Pricing & Tax */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign size={18} className="text-[#ff5500]" /> Pricing, Discounts & Taxation
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                MRP Price (₹) *
              </label>
              <input 
                type="number" 
                required
                placeholder="95.00"
                value={formData.mrp}
                onChange={(e) => handleInputChange('mrp', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Selling Price (₹) *
              </label>
              <input 
                type="number" 
                required
                placeholder="75.00"
                value={formData.salePrice}
                onChange={(e) => handleInputChange('salePrice', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#ff5500] focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Tax Rate</label>
              <select 
                value={formData.taxRate}
                onChange={(e) => handleInputChange('taxRate', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                <option value="0%">0% (Exempt)</option>
                <option value="5%">5% GST</option>
                <option value="12%">12% GST</option>
                <option value="18%">18% GST</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">HSN Code</label>
              <input 
                type="text" 
                placeholder="e.g. 0713"
                value={formData.hsnCode}
                onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>
        </div>

        {/* Card 5: Inventory & SKU */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Boxes size={18} className="text-[#ff5500]" /> Inventory & Stock Control
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Initial Stock Quantity *
              </label>
              <input 
                type="number" 
                required
                placeholder="100"
                value={formData.stock}
                onChange={(e) => handleInputChange('stock', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Min Stock Alert Limit</label>
              <input 
                type="number" 
                placeholder="10"
                value={formData.minStockLimit}
                onChange={(e) => handleInputChange('minStockLimit', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU / Barcode ID</label>
              <input 
                type="text" 
                placeholder="SKU-GR-9012"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>
        </div>

        {/* Card 6: Return Policy & Guarantee */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <RotateCcw size={18} className="text-[#ff5500]" /> Return & Refund Policy *
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${formData.isReturnable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {formData.isReturnable ? `Returnable (${formData.returnWindow || 7} Days)` : 'Non-Returnable'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Is this product Returnable? *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div 
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  isReturnable: true,
                  returnPolicy: prev.returnPolicy === 'Non-Returnable' ? `${prev.returnWindow || 7} Days Returnable / Replacement` : prev.returnPolicy
                }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  formData.isReturnable 
                    ? 'bg-emerald-50/60 border-emerald-500 shadow-2xs' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input 
                  type="radio"
                  name="seller_isReturnable"
                  checked={formData.isReturnable === true}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" /> Yes, Product is Returnable
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 m-0">Customers can request return / replacement within the designated window.</p>
                </div>
              </div>

              <div 
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  isReturnable: false,
                  returnPolicy: 'Non-Returnable due to hygiene / perishable nature'
                }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  !formData.isReturnable 
                    ? 'bg-amber-50/60 border-amber-500 shadow-2xs' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input 
                  type="radio"
                  name="seller_isReturnable"
                  checked={formData.isReturnable === false}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 accent-amber-600 cursor-pointer"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <AlertCircle size={16} className="text-amber-600" /> No, Non-Returnable
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 m-0">Suitable for perishable groceries, fresh bakery, personal hygiene or customized items.</p>
                </div>
              </div>
            </div>
          </div>

          {formData.isReturnable ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Return Window Period *</label>
                <select 
                  value={formData.returnWindow}
                  onChange={(e) => {
                    const win = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      returnWindow: win,
                      returnPolicy: `${win} Days Returnable / Replacement`
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
                >
                  <option value="3">3 Days Return Window</option>
                  <option value="7">7 Days Return Window (Standard)</option>
                  <option value="10">10 Days Return Window</option>
                  <option value="14">14 Days Return Window</option>
                  <option value="30">30 Days Return Window</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Return Policy Note</label>
                <input 
                  type="text"
                  placeholder="e.g. 7 Days Returnable / Replacement if damaged"
                  value={formData.returnPolicy}
                  onChange={(e) => handleInputChange('returnPolicy', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>This product will display a "Non-Returnable" badge on the customer product page and checkout screen.</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/seller/products')}
            className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting || loadingProduct}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-base font-semibold rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting 
              ? (isEditMode ? 'Updating Product...' : 'Saving Product...') 
              : (isEditMode ? 'Update Product' : 'Add Product')}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AddProduct;

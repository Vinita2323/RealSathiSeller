import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, X, Camera, Trash2, CheckCircle2, ShieldCheck, 
  Loader2, Sparkles, ImagePlus, AlertCircle 
} from 'lucide-react';
import productReviewService from '../services/productReviewService';

const POSITIVE_TAGS = [
  'Fresh & Clean',
  'Great Quality',
  'Value for Money',
  'Good Packaging',
  'Authentic Taste',
  'Prompt Delivery',
];

const NEGATIVE_TAGS = [
  'Poor Quality',
  'Packaging Issue',
  'Damaged Item',
  'Not Fresh',
  'Short Expiry',
  'Incorrect Item',
];

const RATING_SENTIMENTS = {
  5: {
    label: 'Excellent',
    desc: "Excellent! We're glad you loved it. ❤️",
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  4: {
    label: 'Good',
    desc: 'Great! Thanks for your feedback. 😊',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  3: {
    label: 'Okay',
    desc: 'Thanks for sharing your experience. 👍',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  2: {
    label: 'Bad',
    desc: "Sorry the product didn't meet your expectations. 😕",
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
  1: {
    label: 'Very Bad',
    desc: 'Very Bad - We will work on improving this. 😞',
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
  },
};

const ProductRatingModal = ({
  isOpen,
  onClose,
  product, // { _id, id, name, image, price }
  orderId, // Order ID string or Mongo ID
  existingReview = null, // If already reviewed, object containing { rating, review, images, feedbackTags }
  onSuccess, // Callback with updated review data
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef(null);

  // Initialize or reset form when modal opens or review changes
  useEffect(() => {
    if (isOpen) {
      if (existingReview) {
        setRating(existingReview.rating || 5);
        setReviewText(existingReview.review || '');
        setSelectedTags(existingReview.feedbackTags || []);
        setImages(existingReview.images || []);
      } else {
        setRating(5);
        setReviewText('');
        setSelectedTags([]);
        setImages([]);
      }
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, existingReview]);

  if (!isOpen || !product) return null;

  const currentSentiment = RATING_SENTIMENTS[hoverRating || rating] || RATING_SENTIMENTS[5];
  const suggestedTags = rating >= 4 ? POSITIVE_TAGS : NEGATIVE_TAGS;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > 5) {
      setErrorMsg('You can upload a maximum of 5 photos.');
      return;
    }

    setErrorMsg('');
    setUploadingImage(true);

    try {
      const uploadPromises = files.map(async (file) => {
        // Upload via service
        const url = await productReviewService.uploadPhoto(file);
        return url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(Boolean);
      setImages((prev) => [...prev, ...validUrls].slice(0, 5));
    } catch (err) {
      console.error('Image upload failed:', err);
      // Fallback: Read as base64 data url if direct upload fails
      try {
        const base64Promises = files.map(
          (file) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(file);
            })
        );
        const base64Images = await Promise.all(base64Promises);
        setImages((prev) => [...prev, ...base64Images].slice(0, 5));
      } catch (fallbackErr) {
        setErrorMsg('Failed to upload image. Please try again.');
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!rating || rating < 1 || rating > 5) {
      setErrorMsg('Please select a star rating from 1 to 5.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const prodId = product._id || product.id || product.productId;
      const res = await productReviewService.submitReview({
        productId: prodId,
        orderId,
        rating,
        review: reviewText.trim(),
        images,
        feedbackTags: selectedTags,
      });

      if (res && res.success) {
        setSuccessMsg(res.message || 'Thank you for your feedback! ❤️');
        if (onSuccess) {
          onSuccess({
            productId: String(prodId),
            orderId,
            rating,
            review: reviewText.trim(),
            images,
            feedbackTags: selectedTags,
            isVerifiedPurchase: true,
            updatedStats: res.stats,
          });
        }
        setTimeout(() => {
          onClose();
        }, 900);
      } else {
        setErrorMsg(res.message || 'Failed to submit review');
      }
    } catch (err) {
      console.error('Error submitting product review:', err);
      setErrorMsg(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const prodName = product.name || product.title || 'Product Item';
  const prodImg = product.image || product.mainImage || '';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn">
      {/* Modal Card / Bottom Sheet */}
      <div 
        className="w-full max-w-[480px] bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 text-white relative flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold m-0 leading-tight">Rate this Product</h3>
              <p className="text-[11px] text-orange-100 m-0 font-medium">Your feedback helps others make better choices</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center border-none cursor-pointer text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden">
          
          {/* Product Preview Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
              {prodImg ? (
                <img src={prodImg} alt={prodName} className="w-full h-full object-contain p-1" />
              ) : (
                <div className="text-slate-400 text-xs font-bold">Item</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full mb-0.5">
                <ShieldCheck size={11} /> Verified Purchase
              </span>
              <h4 className="text-[13px] font-extrabold text-slate-900 m-0 truncate">{prodName}</h4>
              {orderId && (
                <p className="text-[11px] text-slate-400 m-0 font-mono">Order #{String(orderId).slice(-10)}</p>
              )}
            </div>
          </div>

          {/* Interactive Star Rating Selector */}
          <div className="flex flex-col items-center justify-center py-2 space-y-2 bg-[#fffbf7] rounded-2xl border border-orange-100 p-4">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">How was this product?</span>
            
            <div className="flex items-center gap-2 my-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="bg-transparent border-none cursor-pointer p-1 transition-transform transform active:scale-90 hover:scale-115 focus:outline-none"
                    aria-label={`${star} Star`}
                  >
                    <Star
                      size={34}
                      className={`transition-colors ${
                        isActive
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                          : 'fill-slate-100 text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Contextual Sentiment Feedback */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold border transition-all text-center ${currentSentiment.bg} ${currentSentiment.color}`}>
              {currentSentiment.desc}
            </div>
          </div>

          {/* Contextual Feedback Tag Chips */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 block">What did you like / dislike? (Optional)</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && '✓ '} {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Review Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Write a Review (Optional)</label>
              <span className={`text-[10px] font-bold ${reviewText.length > 450 ? 'text-amber-600' : 'text-slate-400'}`}>
                {reviewText.length} / 500
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Share your experience with this product (quality, taste, packaging, etc.)..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#ea580c] focus:ring-2 focus:ring-orange-100 outline-none transition-all resize-none font-sans"
            />
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Camera size={14} className="text-slate-500" />
                Add Photos (Optional, max 5)
              </label>
              <span className="text-[10px] font-bold text-slate-400">{images.length}/5</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Image Previews */}
              {images.map((imgUrl, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-2xs group">
                  <img src={imgUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center border-none cursor-pointer shadow-xs hover:bg-rose-700 transition-colors p-0"
                    title="Remove Photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              {/* Add Button */}
              {images.length < 5 && (
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#ea580c] bg-slate-50 hover:bg-orange-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-[#ea580c] transition-colors cursor-pointer border-none"
                >
                  {uploadingImage ? (
                    <Loader2 size={18} className="animate-spin text-[#ea580c]" />
                  ) : (
                    <>
                      <ImagePlus size={18} />
                      <span className="text-[9px] font-bold mt-1">+ Photo</span>
                    </>
                  )}
                </button>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/png, image/jpeg, image/webp"
                multiple
                className="hidden"
              />
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={submitting || uploadingImage}
            onClick={handleSubmit}
            className="flex-[2] py-3 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>{existingReview ? 'Update Review' : 'Submit Review'}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProductRatingModal;

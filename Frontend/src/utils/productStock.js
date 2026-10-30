/**
 * Effective sellable stock for a product.
 * Variant products: sum of active variant stocks (source of truth).
 * Simple products: root product.stock.
 */
export const getEffectiveStock = (product) => {
  if (!product) return 0;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariantStock =
    Boolean(product.hasVariants) ||
    variants.some((v) => v && (v.stock !== undefined && v.stock !== null));

  if (hasVariantStock && variants.length > 0) {
    return variants.reduce((sum, variant) => {
      if (!variant || variant.active === false) return sum;
      return sum + Math.max(0, Number(variant.stock) || 0);
    }, 0);
  }

  return Math.max(0, Number(product.stock) || 0);
};

export const isProductOutOfStock = (product) => getEffectiveStock(product) <= 0;

/** Stock for a specific selected variant, or total if none selected. */
export const getDisplayStock = (product, matchedVariant = null) => {
  if (matchedVariant) {
    if (matchedVariant.active === false) return 0;
    return Math.max(0, Number(matchedVariant.stock) || 0);
  }
  return getEffectiveStock(product);
};

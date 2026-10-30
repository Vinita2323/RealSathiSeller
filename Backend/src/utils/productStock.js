/**
 * Effective sellable stock for a product document/plain object.
 * Variant products: sum of active variant stocks.
 * Simple products: root stock field.
 */
export const getEffectiveStock = (product) => {
  if (!product) return 0;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariantStock =
    Boolean(product.hasVariants) ||
    variants.some((v) => v && v.stock !== undefined && v.stock !== null);

  if (hasVariantStock && variants.length > 0) {
    return variants.reduce((sum, variant) => {
      if (!variant || variant.active === false) return sum;
      return sum + Math.max(0, Number(variant.stock) || 0);
    }, 0);
  }

  return Math.max(0, Number(product.stock) || 0);
};

/** Keep root stock field aligned with variant totals when variants exist. */
export const syncRootStockFromVariants = (productLike = {}) => {
  const variants = Array.isArray(productLike.variants) ? productLike.variants : [];
  const isMulti =
    Boolean(productLike.hasVariants) ||
    variants.length > 0;

  if (!isMulti || variants.length === 0) {
    return Math.max(0, Number(productLike.stock) || 0);
  }

  return variants.reduce((sum, variant) => {
    if (!variant || variant.active === false) return sum;
    return sum + Math.max(0, Number(variant.stock) || 0);
  }, 0);
};

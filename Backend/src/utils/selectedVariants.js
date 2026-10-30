import mongoose from 'mongoose';

export const selectedVariantSchema = new mongoose.Schema(
  {
    variantId: { type: String, default: '' },
    name: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  { _id: false }
);

const blankValues = new Set(['', 'undefined', 'null', 'n/a', 'na']);

export const isSelectedValue = (value) => {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return Boolean(text) && !blankValues.has(text.toLowerCase());
};

export const normalizeAttributes = (source) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const attrs = {};
  Object.entries(source).forEach(([key, value]) => {
    const name = String(key || '').trim();
    if (name && isSelectedValue(value)) attrs[name] = String(value).trim();
  });
  return attrs;
};

export const attributesFromRows = (rows) => {
  if (!Array.isArray(rows)) return {};
  const attrs = {};
  rows.forEach((row) => {
    const name = String(row?.name || '').trim();
    if (name && isSelectedValue(row?.value)) attrs[name] = String(row.value).trim();
  });
  return attrs;
};

export const rowsFromAttributes = (attributes, variantId = '') => {
  const attrs = normalizeAttributes(attributes);
  const id = variantId ? String(variantId) : '';
  return Object.entries(attrs).map(([name, value]) => ({
    variantId: id,
    name,
    value,
  }));
};

export const readCustomerAttributes = (item = {}) => {
  const nested = item.selectedVariant || {};
  const fromObject = normalizeAttributes(item.selectedAttributes || nested.attributes);
  if (Object.keys(fromObject).length) return fromObject;
  return attributesFromRows(item.selectedVariants);
};

export const freezeSelectedAttributes = (customerAttributes, matchedVariant, identifiedBySku) => {
  const chosen = normalizeAttributes(customerAttributes);
  if (Object.keys(chosen).length) return chosen;
  // Only copy the matched variant's own attributes (selected combination), never product-wide options
  if (identifiedBySku && matchedVariant) {
    return normalizeAttributes(matchedVariant.attributes || matchedVariant.selectedAttributes);
  }
  return {};
};

export const missingOptionNames = (product, attributes) => {
  if (!product?.hasVariants) return [];
  const options = Array.isArray(product.variantOptions) ? product.variantOptions : [];
  const required = options.filter(
    (opt) => opt?.name && Array.isArray(opt.values) && opt.values.length > 0
  );
  const attrs = normalizeAttributes(attributes);
  if (!required.length) {
    const hasChoices = Array.isArray(product.variants)
      && product.variants.some((variant) => variant && variant.active !== false);
    return hasChoices && !Object.keys(attrs).length ? ['product options'] : [];
  }
  return required
    .map((opt) => String(opt.name).trim())
    .filter((name) => !Object.keys(attrs).some((key) => key.toLowerCase() === name.toLowerCase()));
};

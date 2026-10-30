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

export const selectedVariantRows = (item) => {
  if (!item) return [];
  const fromArray = Array.isArray(item.selectedVariants) ? item.selectedVariants : [];
  const rows = fromArray
    .map((row) => ({
      name: String(row?.name || '').trim(),
      value: String(row?.value ?? '').trim(),
    }))
    .filter((row) => row.name && isSelectedValue(row.value));
  if (rows.length) return rows;
  // Prefer explicit selectedAttributes only — do not inflate from selectedVariant.attributes
  const attrs = normalizeAttributes(item.selectedAttributes);
  return Object.entries(attrs).map(([name, value]) => ({ name, value }));
};

export const toSelectedVariants = (item = {}) => {
  const variantId = String(item.variantId || item.selectedVariant?._id || '').trim();
  return selectedVariantRows(item).map((row) => ({
    variantId,
    name: row.name,
    value: row.value,
  }));
};

export const variantSummary = (item) => selectedVariantRows(item)
  .map((row) => `${row.name}: ${row.value}`)
  .join(' | ');

export const orderVariantSummary = (items = []) => {
  const rows = (Array.isArray(items) ? items : [])
    .map((item) => ({ name: item?.name, summary: variantSummary(item) }))
    .filter((row) => row.summary);
  if (!rows.length) return '';
  if (rows.length === 1) return rows[0].summary;
  return rows.map((row) => `${row.name}: ${row.summary}`).join(' · ');
};

export const missingVariantOptions = (item) => {
  if (!item?.hasVariants || !Array.isArray(item.variantOptions)) return [];
  const selected = new Set(selectedVariantRows(item).map((row) => row.name.toLowerCase()));
  return item.variantOptions
    .filter((opt) => opt?.name && Array.isArray(opt.values) && opt.values.length > 0)
    .map((opt) => String(opt.name).trim())
    .filter((name) => name && !selected.has(name.toLowerCase()));
};

export const variantKey = (item = {}) => {
  const sku = String(item.variantSku || item.selectedVariant?.sku || '').trim();
  if (sku) return `sku:${sku}`;
  const attrs = normalizeAttributes(item.selectedAttributes || item.selectedVariant?.attributes);
  const parts = Object.keys(attrs).sort().map((key) => `${key}=${attrs[key]}`);
  return parts.join('|');
};

export const cartLineId = (item = {}) => {
  const productId = String(item.productId || item.id || item._id || item.product || '');
  const key = variantKey(item);
  return key ? `${productId}::${key}` : productId;
};

export const variantLabel = (item) => {
  if (!item) return '';
  const summary = variantSummary(item);
  if (summary) return summary.replace(/ \| /g, ' · ');
  return String(item.variantTitle || item.variation || '').trim();
};

import React, { useState, useMemo } from 'react';
import { 
  Layers, Plus, Trash2, Sparkles, X
} from 'lucide-react';

// Default Category Suggestions
const CATEGORY_SUGGESTIONS = {
  'Footwear': [
    { name: 'Size', defaultValues: ['6', '7', '8', '9', '10'] },
    { name: 'Color', defaultValues: ['Black', 'White', 'Brown', 'Navy'] },
    { name: 'Material', defaultValues: ['Leather', 'Mesh', 'Synthetic', 'Canvas'] }
  ],
  'Clothing': [
    { name: 'Size', defaultValues: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Color', defaultValues: ['Black', 'White', 'Blue', 'Red', 'Grey'] },
    { name: 'Material', defaultValues: ['Cotton', 'Polyester', 'Denim', 'Linen'] },
    { name: 'Fit', defaultValues: ['Regular', 'Slim', 'Oversized'] }
  ],
  'Fashion': [
    { name: 'Size', defaultValues: ['S', 'M', 'L', 'XL'] },
    { name: 'Color', defaultValues: ['Black', 'White', 'Beige', 'Blue'] },
    { name: 'Material', defaultValues: ['Cotton', 'Silk', 'Synthetic'] }
  ],
  'Lighting': [
    { name: 'Wattage', defaultValues: ['5W', '9W', '12W', '15W', '20W'] },
    { name: 'Light Color', defaultValues: ['Cool Day White', 'Warm White', 'Natural White'] },
    { name: 'Base', defaultValues: ['B22', 'E27'] },
    { name: 'Length', defaultValues: ['5m', '10m', '20m'] }
  ],
  'Electrical': [
    { name: 'Wattage', defaultValues: ['10W', '20W', '30W', '50W'] },
    { name: 'Voltage', defaultValues: ['220V', '240V'] },
    { name: 'Color', defaultValues: ['White', 'Grey', 'Black'] }
  ],
  'Groceries & Grains': [
    { name: 'Weight', defaultValues: ['250g', '500g', '1kg', '5kg'] },
    { name: 'Pack Size', defaultValues: ['Pack of 1', 'Pack of 2', 'Pack of 4'] }
  ],
  'Edible Oils & Ghee': [
    { name: 'Volume', defaultValues: ['500ml', '1L', '2L', '5L'] },
    { name: 'Pack Size', defaultValues: ['Pouch', 'Bottle', 'Jar', 'Tin'] }
  ],
  'Spices & Masala': [
    { name: 'Weight', defaultValues: ['50g', '100g', '250g', '500g'] },
    { name: 'Form', defaultValues: ['Whole', 'Powdered'] }
  ],
  'Pulses & Rice': [
    { name: 'Weight', defaultValues: ['500g', '1kg', '2kg', '5kg', '10kg'] },
    { name: 'Pack Size', defaultValues: ['Bag', 'Pouch'] }
  ]
};

const COMMON_UNITS = [
  { value: 'kg', label: 'kg (Kilograms)' },
  { value: 'g', label: 'g (Grams)' },
  { value: 'L', label: 'L (Liters)' },
  { value: 'ml', label: 'ml (Milliliters)' },
  { value: 'Pcs', label: 'Pcs (Pieces)' },
  { value: 'Pack', label: 'Pack' },
  { value: 'Dozen', label: 'Dozen (12 Pcs)' },
  { value: 'Bunch', label: 'Bunch' },
  { value: 'Box', label: 'Box' },
  { value: 'Bottle', label: 'Bottle' },
  { value: 'Sachet', label: 'Sachet' },
  { value: 'Combo', label: 'Combo Pack' }
];

export const ProductVariantBuilder = ({
  category = '',
  basePrice = '',
  baseMrp = '',
  baseStock = '',
  baseSku = '',
  productName = '',
  unitValue = '1',
  unitType = 'kg',
  onUnitChange,
  hasVariants = false,
  onHasVariantsChange,
  variantOptions = [],
  onVariantOptionsChange,
  variants = [],
  onVariantsChange,
  availableImages = []
}) => {
  // Local state for inline value inputs inside option cards
  const [newValueInputs, setNewValueInputs] = useState({});

  // Identify matching category suggestions
  const suggestedOptions = useMemo(() => {
    if (!category) return CATEGORY_SUGGESTIONS['Groceries & Grains'] || [];
    const directMatch = CATEGORY_SUGGESTIONS[category];
    if (directMatch) return directMatch;
    
    // Fuzzy matching
    const catLower = category.toLowerCase();
    for (const [key, list] of Object.entries(CATEGORY_SUGGESTIONS)) {
      if (catLower.includes(key.toLowerCase()) || key.toLowerCase().includes(catLower)) {
        return list;
      }
    }
    // Fallback general options
    return [
      { name: 'Size', defaultValues: ['Small', 'Medium', 'Large'] },
      { name: 'Color', defaultValues: ['Black', 'White', 'Blue'] },
      { name: 'Weight', defaultValues: ['250g', '500g', '1kg'] },
      { name: 'Pack Size', defaultValues: ['Pack of 1', 'Pack of 2'] }
    ];
  }, [category]);

  // Clean slug helper for SKU generation
  const slugify = (text = '') => {
    return text
      .toString()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 10);
  };

  // Generate Cartesian Product of Option Values in background for DB synchronization
  const generateCombinations = (optionsList = variantOptions, currentVariants = variants) => {
    const validOptions = optionsList.filter(
      opt => opt.name && opt.name.trim() && Array.isArray(opt.values) && opt.values.length > 0
    );

    if (validOptions.length === 0) {
      return [];
    }

    const cartesian = (arrays) => {
      return arrays.reduce((acc, curr) => {
        return acc.flatMap(a => curr.map(b => [...a, b]));
      }, [[]]);
    };

    const valuesArrays = validOptions.map(opt => opt.values);
    const cartesianResult = cartesian(valuesArrays);

    const basePrefix = baseSku 
      ? slugify(baseSku) 
      : (productName ? slugify(productName).slice(0, 6) : 'SKU');

    const newCombinations = cartesianResult.map((comboVals, idx) => {
      const attributes = {};
      validOptions.forEach((opt, oIdx) => {
        attributes[opt.name.trim()] = comboVals[oIdx];
      });

      const title = comboVals.join(' / ');

      const existing = currentVariants.find(v => {
        if (!v.attributes) return false;
        return validOptions.every(opt => v.attributes[opt.name.trim()] === attributes[opt.name.trim()]);
      });

      if (existing) {
        return {
          ...existing,
          title,
          attributes
        };
      }

      const comboSkuPart = comboVals.map(v => slugify(v).slice(0, 4)).join('-');
      const generatedSku = `${basePrefix}-${comboSkuPart || (idx + 1)}`;

      return {
        attributes,
        title,
        sku: generatedSku,
        price: basePrice !== '' ? Number(basePrice) : 0,
        originalPrice: baseMrp !== '' ? Number(baseMrp) : (basePrice !== '' ? Number(basePrice) : 0),
        stock: baseStock !== '' ? Number(baseStock) : 10,
        image: availableImages && availableImages[0] ? availableImages[0] : '',
        active: true
      };
    });

    return newCombinations;
  };

  // Add a new empty option or prefilled suggestion
  const handleAddOption = (defaultName = '', defaultValues = []) => {
    const newOption = {
      name: defaultName || '',
      values: defaultValues.length > 0 ? [...defaultValues] : []
    };
    const updatedOptions = [...variantOptions, newOption];
    onVariantOptionsChange(updatedOptions);

    if (defaultValues.length > 0) {
      const updatedCombos = generateCombinations(updatedOptions, variants);
      onVariantsChange(updatedCombos);
    }
  };

  // Remove an option
  const handleRemoveOption = (indexToRemove) => {
    const updatedOptions = variantOptions.filter((_, idx) => idx !== indexToRemove);
    onVariantOptionsChange(updatedOptions);
    const updatedCombos = generateCombinations(updatedOptions, variants);
    onVariantsChange(updatedCombos);
  };

  // Update option name
  const handleOptionNameChange = (index, newName) => {
    const updatedOptions = variantOptions.map((opt, idx) => {
      if (idx === index) {
        return { ...opt, name: newName };
      }
      return opt;
    });
    onVariantOptionsChange(updatedOptions);
    const updatedCombos = generateCombinations(updatedOptions, variants);
    onVariantsChange(updatedCombos);
  };

  // Add a value to an option
  const handleAddValue = (optIndex) => {
    const val = (newValueInputs[optIndex] || '').trim();
    if (!val) return;

    const opt = variantOptions[optIndex];
    if (!opt) return;

    // Check duplicate
    if (opt.values && opt.values.some(v => v.toLowerCase() === val.toLowerCase())) {
      setNewValueInputs(prev => ({ ...prev, [optIndex]: '' }));
      return;
    }

    const updatedValues = [...(opt.values || []), val];
    const updatedOptions = variantOptions.map((o, idx) => {
      if (idx === optIndex) {
        return { ...o, values: updatedValues };
      }
      return o;
    });

    onVariantOptionsChange(updatedOptions);
    setNewValueInputs(prev => ({ ...prev, [optIndex]: '' }));

    // Auto update background combinations for DB
    const updatedCombos = generateCombinations(updatedOptions, variants);
    onVariantsChange(updatedCombos);
  };

  // Remove a value from an option
  const handleRemoveValue = (optIndex, valueIndex) => {
    const opt = variantOptions[optIndex];
    if (!opt) return;

    const updatedValues = opt.values.filter((_, idx) => idx !== valueIndex);
    const updatedOptions = variantOptions.map((o, idx) => {
      if (idx === optIndex) {
        return { ...o, values: updatedValues };
      }
      return o;
    });

    onVariantOptionsChange(updatedOptions);
    const updatedCombos = generateCombinations(updatedOptions, variants);
    onVariantsChange(updatedCombos);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Section Header with Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 m-0">
              <Layers size={20} className="text-[#ff5500]" /> Product Variants
            </h3>
            {hasVariants && variantOptions.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-[#ff5500] border border-orange-200">
                {variantOptions.length} {variantOptions.length === 1 ? 'Option' : 'Options'} Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 m-0">
            Add options such as size, color, weight, wattage, length, pack size, etc.
          </p>
        </div>

        {/* Mode Toggle Pills */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => onHasVariantsChange(false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
              !hasVariants 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'bg-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Single Product (Standard)
          </button>
          <button
            type="button"
            onClick={() => {
              onHasVariantsChange(true);
              if (variantOptions.length === 0 && suggestedOptions.length > 0) {
                const firstSug = suggestedOptions[0];
                handleAddOption(firstSug.name, firstSug.defaultValues);
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
              hasVariants 
                ? 'bg-[#ff5500] text-white shadow-xs' 
                : 'bg-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Multiple Variants (Sizes, Colors, etc.)
          </button>
        </div>
      </div>

      {/* Mode A: Single Product Unit/Weight */}
      {!hasVariants ? (
        <div className="space-y-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 animate-fadeIn">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Unit / Weight Variant *
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Specify single packaged measurement (e.g. 1 kg, 500 g, 1 Litre, 1 Pack).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex gap-2 sm:col-span-2">
              <input 
                type="text" 
                placeholder="Quantity (e.g. 1, 500, 250)"
                value={unitValue}
                onChange={(e) => onUnitChange('unitValue', e.target.value)}
                className="w-1/2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:outline-none focus:border-[#ff5500]"
              />
              <select 
                value={unitType}
                onChange={(e) => onUnitChange('unitType', e.target.value)}
                className="w-1/2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                {COMMON_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <div className="px-3.5 py-2 bg-orange-50 border border-orange-200/80 rounded-xl text-xs text-slate-700 w-full flex items-center justify-between">
                <span className="text-slate-500">Preview:</span>
                <span className="font-extrabold text-[#ff5500] font-mono text-sm">
                  {unitValue || '1'} {unitType || 'kg'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
            <p className="text-xs text-slate-500 m-0">
              Selling footwear, clothes, bulbs, or multiple sizes?
            </p>
            <button
              type="button"
              onClick={() => {
                onHasVariantsChange(true);
                if (variantOptions.length === 0 && suggestedOptions.length > 0) {
                  const firstSug = suggestedOptions[0];
                  handleAddOption(firstSug.name, firstSug.defaultValues);
                }
              }}
              className="text-xs font-bold text-[#ff5500] hover:text-[#d94800] bg-transparent border-none cursor-pointer flex items-center gap-1 hover:underline p-0"
            >
              <Plus size={14} /> Add Multiple Sizes, Colors or Options
            </button>
          </div>
        </div>
      ) : (
        /* Mode B: Multiple Variants System */
        <div className="space-y-6 animate-fadeIn">
          {/* Category-Based Suggestions Bar */}
          {suggestedOptions.length > 0 && (
            <div className="p-3.5 bg-orange-50/50 rounded-xl border border-orange-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Sparkles size={15} className="text-[#ff5500] shrink-0" />
                <span>Suggested options for <strong>{category || 'this category'}</strong>:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {suggestedOptions.map((sug, sIdx) => {
                  const isAlreadyAdded = variantOptions.some(
                    o => o.name && o.name.toLowerCase() === sug.name.toLowerCase()
                  );
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => handleAddOption(sug.name, sug.defaultValues)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all border flex items-center gap-1 ${
                        isAlreadyAdded
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-white hover:bg-orange-100 border-orange-200 text-[#ff5500] cursor-pointer shadow-2xs hover:scale-102 active:scale-95'
                      }`}
                      title={isAlreadyAdded ? 'Already added' : `Add ${sug.name} option`}
                    >
                      <Plus size={12} />
                      <span>{sug.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options Cards List */}
          <div className="space-y-4">
            {variantOptions.map((option, optIdx) => (
              <div 
                key={optIdx} 
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 max-w-xs">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Option {optIdx + 1} Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Size, Color, Wattage, Weight"
                      value={option.name}
                      onChange={(e) => handleOptionNameChange(optIdx, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIdx)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border-none bg-transparent cursor-pointer flex items-center gap-1 text-xs font-semibold shrink-0"
                    title="Remove this option"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Remove Option</span>
                  </button>
                </div>

                {/* Option Values Tags */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Option Values ({option.values?.length || 0})
                  </label>

                  <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 min-h-[46px]">
                    {option.values && option.values.map((val, vIdx) => (
                      <span 
                        key={vIdx} 
                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 transition-colors animate-fadeIn"
                      >
                        <span>{val}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(optIdx, vIdx)}
                          className="w-4 h-4 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center p-0 border-none bg-transparent cursor-pointer transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}

                    {/* Inline Input to add more values */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                      <input 
                        type="text"
                        placeholder="Type value & hit Enter..."
                        value={newValueInputs[optIdx] || ''}
                        onChange={(e) => setNewValueInputs({ ...newValueInputs, [optIdx]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddValue(optIdx);
                          }
                        }}
                        className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none py-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddValue(optIdx)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-[#ff5500] text-slate-700 hover:text-white rounded-lg text-xs font-bold transition-colors border-none cursor-pointer shrink-0 flex items-center gap-1"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Option Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleAddOption()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} className="text-[#ff5500]" /> Add Another Option
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantBuilder;

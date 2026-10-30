import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { cartService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';
import { cartLineId, normalizeAttributes, toSelectedVariants } from '../../../utils/variantLabel';

const CartContext = createContext();

// Rapid +/- taps are coalesced into a single network call after this pause,
// instead of firing one request per click (the previous cause of cart actions
// appearing to "hang" for many seconds while a backlog of requests drained).
const SYNC_DEBOUNCE_MS = 450;

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated: authContextIsAuthenticated, isAuthInitializing, userRole } = useAuth();

  const cartItemsRef = useRef(cartItems);
  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);

  // Tracks product ids with a scheduled/in-flight server sync so an
  // in-between fetchCart()/reconcile doesn't clobber the optimistic value.
  const pendingSyncIds = useRef(new Set());
  const syncTimers = useRef({});

  useEffect(() => {
    return () => {
      Object.values(syncTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Format backend cart items for frontend consumption. Entries whose product
  // was deleted after being added populate() to a null product server-side;
  // drop those instead of rendering a blank row for a product that no longer exists.
  // Format backend cart items for frontend consumption and deduplicate by product ID/name
  const formatCartItems = (backendItems = []) => {
    const itemMap = new Map();

    backendItems
      .filter((item) => item && item.product)
      .forEach((item) => {
        const prod = item.product || {};
        const prodId = String(prod._id || prod.id || prod.productId || '');
        if (!prodId) return;

        // Prefer cart-line attributes; fall back to selectedVariants rows if attrs were dropped
        let selectedAttributes = normalizeAttributes(item.selectedAttributes);
        if (!Object.keys(selectedAttributes).length && Array.isArray(item.selectedVariants)) {
          selectedAttributes = normalizeAttributes(
            Object.fromEntries(
              item.selectedVariants
                .filter((row) => row?.name && row?.value != null)
                .map((row) => [row.name, row.value])
            )
          );
        }
        const variantSku = String(item.variantSku || '').trim();
        const variantId = String(item.variantId || '').trim();
        const selectedVariants = toSelectedVariants({
          selectedAttributes,
          selectedVariants: item.selectedVariants,
          variantId,
        });
        const variantTitle = String(
          item.variantTitle
          || Object.entries(selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(' · ')
          || ''
        ).trim();
        const price = Number(item.price ?? prod.salePrice ?? prod.price ?? 0);
        const originalPrice = Number(item.originalPrice ?? prod.mrp ?? prod.originalPrice ?? price);
        const name = prod.name || '';
        const image = item.image || prod.mainImage || prod.image || (prod.variants?.[0]?.image) || '';
        const qty = Math.max(1, Number(item.quantity || 1));
        const formatted = {
          productId: prodId,
          variantSku,
          variantId,
          selectedAttributes,
          selectedVariants,
        };
        const key = cartLineId(formatted);

        if (itemMap.has(key)) {
          const existing = itemMap.get(key);
          existing.quantity = (existing.quantity || 0) + qty;
        } else {
          // Do not spread full product doc — it can overwrite cart-line variant fields
          itemMap.set(key, {
            id: prodId,
            _id: prodId,
            productId: prodId,
            lineId: key,
            name,
            image,
            price,
            originalPrice,
            quantity: qty,
            sku: prod.sku || '',
            unit: prod.unit || '',
            mainImage: prod.mainImage || image,
            hasVariants: Boolean(prod.hasVariants),
            variantOptions: Array.isArray(prod.variantOptions) ? prod.variantOptions : [],
            variantSku,
            variantId,
            variantTitle,
            variation: variantTitle,
            selectedAttributes,
            selectedVariants,
          });
        }
      });

    return Array.from(itemMap.values());
  };

  const fetchCart = useCallback(async () => {
    const path = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    const isPortalRoute =
      path.startsWith('/admin') ||
      path.startsWith('/super-admin') ||
      path.startsWith('/seller') ||
      path.startsWith('/captain') ||
      path.startsWith('/delivery');

    const userToken = typeof window !== 'undefined' ? localStorage.getItem('sathiseller_user_token') : null;

    // Only fetch cart if not in a back-office portal and user token is actually present
    if (isPortalRoute || isAuthInitializing || !userToken || (userRole && userRole !== 'user')) {
      setCartItems([]);
      return;
    }

    try {
      setLoading(true);
      const res = await cartService.getCart();
      if (res && res.success && res.cart) {
        setCartItems(formatCartItems(res.cart.items || []));
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('sathiseller_user_token');
        setCartItems([]);
      } else if (err?.response?.status !== 403) {
        console.error('Failed to fetch server cart:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [authContextIsAuthenticated, isAuthInitializing, userRole]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Merge authoritative server cart into local state without creating duplicate entries
  const reconcileServerCart = useCallback((serverItems, syncedProductId = null) => {
    const formatted = formatCartItems(serverItems);

    if (syncedProductId) {
      pendingSyncIds.current.delete(String(syncedProductId));
    }

    setCartItems((prev) => {
      // Build a map of authoritative server items
      const map = new Map();
      formatted.forEach((item) => {
        map.set(cartLineId(item), item);
      });

      // Check if there are other pending local items that haven't synced yet
      prev.forEach((localItem) => {
        const pid = cartLineId(localItem);
        if (pendingSyncIds.current.has(pid) && !map.has(pid)) {
          map.set(pid, localItem);
        }
      });

      return Array.from(map.values());
    });

    localStorage.setItem('sathiseller_local_cart', JSON.stringify(formatted));
  }, []);

  const runSync = useCallback(async (productId) => {
    const key = String(productId);
    const item = cartItemsRef.current.find((i) => cartLineId(i) === key)
      || cartItemsRef.current.find((i) => String(i.productId || i.id || i._id || '') === key);
    const serverProductId = item?.productId || item?.id || key.split('::')[0];

    try {
      let res;
      if (!item || (item.quantity || 0) <= 0) {
        res = await cartService.removeFromCart(serverProductId, item);
      } else {
        // Ensure variant attrs survive quantity sync (never send a bare product wipe)
        let attrs = normalizeAttributes(item.selectedAttributes);
        if (!Object.keys(attrs).length && Array.isArray(item.selectedVariants)) {
          attrs = normalizeAttributes(
            Object.fromEntries(
              item.selectedVariants
                .filter((row) => row?.name)
                .map((row) => [row.name, row.value])
            )
          );
        }
        const syncPayload = {
          ...item,
          selectedAttributes: attrs,
          selectedVariants: toSelectedVariants({
            ...item,
            selectedAttributes: attrs,
          }),
          variantTitle:
            item.variantTitle
            || Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' · ')
            || '',
        };
        res = await cartService.updateCartItem(serverProductId, undefined, item.quantity, syncPayload);
      }
      pendingSyncIds.current.delete(key);
      if (res && res.success && res.cart) {
        reconcileServerCart(res.cart.items || [], key);
      }
      return res;
    } catch (err) {
      console.error('Cart sync failed for product', productId, err);
      pendingSyncIds.current.delete(key);
      fetchCart();
      throw err;
    }
  }, [reconcileServerCart, fetchCart]);

  // immediate:true (buy-now / remove) lets the caller see real success/failure.
  const scheduleSync = useCallback((productId, { immediate = false } = {}) => {
    const key = String(productId);
    pendingSyncIds.current.add(key);

    if (syncTimers.current[key]) {
      clearTimeout(syncTimers.current[key]);
      delete syncTimers.current[key];
    }

    if (immediate) {
      return runSync(key);
    }

    return new Promise((resolve) => {
      syncTimers.current[key] = setTimeout(() => {
        delete syncTimers.current[key];
        runSync(key).catch(() => {}).finally(resolve);
      }, SYNC_DEBOUNCE_MS);
    });
  }, [runSync]);

  const addToCart = async (product, quantity = 1, options = {}) => {
    if (!product) return { success: false };

    const productId = String(product.id || product._id || product.productId || '');
    if (!productId) return { success: false };

    // Wait for auth initialization before checking authentication
    if (isAuthInitializing) {
      return { requiresAuth: true, message: 'Initializing authentication' };
    }

    // Reject unauthenticated requests and save pending action
    if (!authContextIsAuthenticated) {
      const pendingAction = {
        type: options.isBuyNow ? 'BUY_NOW' : 'ADD_TO_CART',
        product,
        quantity,
        returnUrl: options.returnUrl || window.location.pathname,
      };
      localStorage.setItem('sathiseller_pending_action', JSON.stringify(pendingAction));
      if (options.navigate) {
        options.navigate('/login');
      }
      return { requiresAuth: true };
    }

    // Update local cart instantly so the UI reflects the change on click
    const price = Number(product.salePrice ?? product.price ?? 0);
    const originalPrice = Number(product.mrp ?? product.originalPrice ?? price);
    // Prefer explicit user selections only — never inflate from full selectedVariant.attributes
    const selectedAttributes = normalizeAttributes(
      product.selectedAttributes && Object.keys(product.selectedAttributes).length
        ? product.selectedAttributes
        : {}
    );
    const variantSku = String(product.variantSku || product.selectedVariant?.sku || '').trim();
    const variantId = String(product.variantId || product.selectedVariant?._id || '').trim();
    const variantTitleFromAttrs = Object.entries(selectedAttributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const variantTitle = String(
      variantTitleFromAttrs || product.variantTitle || product.variation || product.selectedVariant?.title || ''
    ).trim();
    const selectedVariants = toSelectedVariants({ selectedAttributes, selectedVariants: product.selectedVariants, variantId });
    const lineId = cartLineId({ productId, variantSku, selectedAttributes });

    setCartItems((prev) => {
      const idx = prev.findIndex((i) => cartLineId(i) === lineId);
      let next;
      if (idx > -1) {
        next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: (next[idx].quantity || 0) + Number(quantity),
          price,
          originalPrice,
          variantSku,
          variantId,
          variantTitle,
          variation: variantTitle,
          selectedAttributes,
          selectedVariants,
          selectedVariant: product.selectedVariant
            ? { ...product.selectedVariant, attributes: selectedAttributes, title: variantTitle }
            : undefined,
          image: product.image || next[idx].image,
        };
      } else {
        const { variants: _variants, variantOptions: _opts, ...productRest } = product;
        next = [
          ...prev,
          {
            ...productRest,
            id: productId,
            _id: productId,
            productId,
            lineId,
            name: product.name,
            image: product.image || product.mainImage || (product.variants?.[0]?.image) || '',
            price,
            originalPrice,
            quantity: Number(quantity),
            variantSku,
            variantId,
            variantTitle,
            variation: variantTitle,
            selectedAttributes,
            selectedVariants,
            selectedVariant: product.selectedVariant
              ? { ...product.selectedVariant, attributes: selectedAttributes, title: variantTitle }
              : undefined,
          },
        ];
      }
      cartItemsRef.current = next;
      return next;
    });

    if (options.isBuyNow) {
      try {
        const res = await scheduleSync(lineId, { immediate: true });
        if (res && res.success) return { success: true };
        return { success: false, message: res?.message || 'Failed to add item to cart' };
      } catch (err) {
        return { success: false, message: err.response?.data?.message || 'Failed to add item to cart' };
      }
    }

    scheduleSync(lineId);
    return { success: true };
  };

  const replaceCartLineVariant = async (sourceLineId, product) => {
    if (!authContextIsAuthenticated) return { success: false, requiresAuth: true };
    const source = findCartLine(sourceLineId);
    if (!source || !product) return { success: false };

    const productId = String(source.productId || source.id || source._id || '');
    const selectedAttributes = normalizeAttributes(
      product.selectedAttributes && Object.keys(product.selectedAttributes).length
        ? product.selectedAttributes
        : {}
    );
    const variantSku = String(product.variantSku || product.selectedVariant?.sku || '').trim();
    const variantId = String(product.variantId || product.selectedVariant?._id || '').trim();
    const variantTitleFromAttrs = Object.entries(selectedAttributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const variantTitle = String(
      variantTitleFromAttrs || product.variantTitle || product.variation || product.selectedVariant?.title || ''
    ).trim();
    const selectedVariants = toSelectedVariants({ selectedAttributes, selectedVariants: product.selectedVariants, variantId });
    const price = Number(product.salePrice ?? product.price ?? source.price ?? 0);
    const originalPrice = Number(product.mrp ?? product.originalPrice ?? source.originalPrice ?? price);
    const newLineId = cartLineId({ productId, variantSku, selectedAttributes });
    const oldLineId = cartLineId(source);
    const qty = source.quantity || 1;

    if (syncTimers.current[oldLineId]) {
      clearTimeout(syncTimers.current[oldLineId]);
      delete syncTimers.current[oldLineId];
    }
    pendingSyncIds.current.delete(oldLineId);

    if (newLineId === oldLineId) return { success: true };

    const target = cartItemsRef.current.find((item) => cartLineId(item) === newLineId);
    if (target) {
      setCartItems((prev) => {
        const next = prev.filter((item) => cartLineId(item) !== oldLineId);
        cartItemsRef.current = next;
        return next;
      });
      try {
        await cartService.removeFromCart(productId, {
          variantSku: source.variantSku,
          selectedAttributes: source.selectedAttributes,
        });
      } catch {
        fetchCart();
        return { success: false };
      }
      return { success: true };
    }

    setCartItems((prev) => {
      const next = prev.map((item) => {
        if (cartLineId(item) !== oldLineId) return item;
        return {
          ...item,
          lineId: newLineId,
          variantSku,
          variantId,
          variantTitle,
          variation: variantTitle,
          selectedAttributes,
          selectedVariants,
          price,
          originalPrice,
          image: product.image || item.image,
          quantity: qty,
        };
      });
      cartItemsRef.current = next;
      return next;
    });

    try {
      const res = await cartService.updateCartItem(productId, undefined, qty, {
        variantSku,
        variantId,
        variantTitle,
        selectedAttributes,
        selectedVariants,
        price,
        originalPrice,
        image: product.image || source.image || '',
        replaceLine: true,
        previousVariantSku: source.variantSku || '',
        previousSelectedAttributes: source.selectedAttributes || {},
      });
      if (res?.success && res.cart) {
        reconcileServerCart(res.cart.items || [], newLineId);
      }
      return { success: true };
    } catch {
      fetchCart();
      return { success: false };
    }
  };

  const findCartLine = (productOrLineId) => {
    const key = String(productOrLineId);
    return cartItemsRef.current.find((i) => cartLineId(i) === key)
      || cartItemsRef.current.find((i) => !key.includes('::') && String(i.productId || i.id || i._id || '') === key);
  };

  const updateQuantity = async (productId, delta, exactQty) => {
    if (!authContextIsAuthenticated) return;
    const current = findCartLine(productId);
    if (!current) return;
    const line = cartLineId(current);

    setCartItems((prev) => {
      const idx = prev.findIndex((i) => cartLineId(i) === line);
      if (idx === -1) return prev;

      const row = prev[idx];
      const newQty = exactQty !== undefined ? Number(exactQty) : (row.quantity || 0) + Number(delta);
      const next = newQty <= 0
        ? prev.filter((_, i) => i !== idx)
        : prev.map((item, i) => (i === idx ? { ...item, quantity: newQty } : item));
      cartItemsRef.current = next;
      return next;
    });

    scheduleSync(line);
  };

  const removeFromCart = async (productId) => {
    if (!authContextIsAuthenticated) return;

    const key = String(productId);
    const exact = cartItemsRef.current.filter((i) => cartLineId(i) === key);
    const targets = exact.length
      ? exact
      : cartItemsRef.current.filter((i) => {
          const id1 = String(i.productId || '');
          const id2 = String(i.id || '');
          const id3 = String(i._id || '');
          const sku = String(i.sku || '');
          return id1 === key || id2 === key || id3 === key || sku === key;
        });
    if (!targets.length) return;

    const lineIds = new Set(targets.map((item) => cartLineId(item)));
    targets.forEach((item) => {
      const line = cartLineId(item);
      if (syncTimers.current[line]) {
        clearTimeout(syncTimers.current[line]);
        delete syncTimers.current[line];
      }
      pendingSyncIds.current.delete(line);
    });

    setCartItems((prev) => {
      const next = prev.filter((i) => !lineIds.has(cartLineId(i)));
      cartItemsRef.current = next;
      return next;
    });

    try {
      await Promise.all(targets.map((item) => cartService.removeFromCart(item.productId || item.id || item._id, {
        variantSku: item.variantSku,
        selectedAttributes: item.selectedAttributes,
      })));
    } catch {
      fetchCart();
    }
  };

  const clearCart = async () => {
    Object.values(syncTimers.current).forEach(clearTimeout);
    syncTimers.current = {};
    pendingSyncIds.current.clear();

    if (!authContextIsAuthenticated) {
      setCartItems([]);
      return;
    }
    setCartItems([]);
    cartItemsRef.current = [];
    try {
      await cartService.clearCart();
    } catch (err) {
      console.error('Error clearing cart:', err);
    }
  };

  const isInCart = (productId, variant) => {
    if (!productId) return false;
    const target = String(productId);
    if (variant) {
      const line = cartLineId({
        productId: target,
        variantSku: variant.variantSku,
        selectedAttributes: variant.selectedAttributes,
      });
      return cartItems.some((item) => cartLineId(item) === line);
    }
    return cartItems.some((item) => {
      const id1 = String(item.id || '');
      const id2 = String(item._id || '');
      const id3 = String(item.productId || '');
      const sku = String(item.sku || '');
      return id1 === target || id2 === target || id3 === target || sku === target;
    });
  };

  const getItemQuantity = (productId, variant) => {
    if (!productId) return 0;
    if (variant) {
      const line = cartLineId({
        productId: String(productId),
        variantSku: variant.variantSku,
        selectedAttributes: variant.selectedAttributes,
      });
      const item = cartItems.find((i) => cartLineId(i) === line);
      return item ? item.quantity || 0 : 0;
    }
    const item = cartItems.find((i) => String(i.id || i._id || i.productId) === String(productId));
    return item ? item.quantity || 0 : 0;
  };

  const cartCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const p = Number(item.price ?? item.salePrice ?? 0);
      return total + p * (item.quantity || 0);
    }, 0);
  }, [cartItems]);

  const originalTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const op = Number(item.originalPrice ?? item.mrp ?? item.price ?? item.salePrice ?? 0);
      return total + op * (item.quantity || 0);
    }, 0);
  }, [cartItems]);

  const value = {
    cartItems,
    addToCart,
    replaceCartLineVariant,
    removeFromCart,
    updateQuantity,
    clearCart,
    isInCart,
    getItemQuantity,
    cartCount,
    cartTotal,
    originalTotal,
    fetchCart,
    loading,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

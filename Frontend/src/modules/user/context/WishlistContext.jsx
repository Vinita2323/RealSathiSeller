import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { wishlistService } from '../../../services/authService';
import { useAuth } from '../../../context/AuthContext';

const WishlistContext = createContext();

const GUEST_WISHLIST_KEY = 'sathiseller_guest_wishlist';

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

const normalizeWishlistProducts = (prods = []) => {
  return prods.map((p) => {
    if (typeof p === 'object' && p !== null) {
      return {
        ...p,
        id: p._id || p.id,
        image: p.image || p.mainImage || '',
        price: p.salePrice !== undefined ? p.salePrice : (p.price || 0),
        originalPrice: p.mrp !== undefined ? p.mrp : (p.originalPrice || p.price || 0),
        brand: p.brand || p.seller || 'Sathi Seller Select',
      };
    }
    return p;
  });
};

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated: authContextIsAuthenticated, isAuthInitializing, userRole } = useAuth();

  // Fetch wishlist from server or local storage
  const refreshWishlist = useCallback(async () => {
    if (isAuthInitializing) {
      return;
    }

    const path = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    const isPortalRoute =
      path.startsWith('/admin') ||
      path.startsWith('/super-admin') ||
      path.startsWith('/seller') ||
      path.startsWith('/captain') ||
      path.startsWith('/delivery');

    if (isPortalRoute) {
      setWishlistItems([]);
      return;
    }

    const userToken = typeof window !== 'undefined' ? localStorage.getItem('sathiseller_user_token') : null;

    if (userToken && userRole !== 'admin' && userRole !== 'seller' && userRole !== 'captain' && userRole !== 'super_admin') {
      try {
        setLoading(true);
        const res = await wishlistService.getWishlist();
        if (res && res.success && res.wishlist) {
          setWishlistItems(normalizeWishlistProducts(res.wishlist.products || []));
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem('sathiseller_user_token');
          setWishlistItems([]);
        } else if (err?.response?.status !== 403) {
          console.error('Failed to load server wishlist:', err);
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Load guest wishlist from localStorage
      try {
        const saved = localStorage.getItem(GUEST_WISHLIST_KEY);
        if (saved) {
          setWishlistItems(JSON.parse(saved));
        } else {
          setWishlistItems([]);
        }
      } catch (err) {
        console.error('Failed to load guest wishlist:', err);
        setWishlistItems([]);
      }
    }
  }, [authContextIsAuthenticated, isAuthInitializing, userRole]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  // Sync guest local wishlist items with server after login
  const syncWishlistWithServer = async () => {
    if (!authContextIsAuthenticated || userRole !== 'user') return;
    try {
      const saved = localStorage.getItem(GUEST_WISHLIST_KEY);
      let localItems = [];
      if (saved) {
        localItems = JSON.parse(saved);
      }

      const productIds = localItems
        .map((item) => (typeof item === 'object' ? item._id || item.id : item))
        .filter(Boolean);

      if (productIds.length > 0) {
        await wishlistService.syncWishlist(productIds);
        localStorage.removeItem(GUEST_WISHLIST_KEY);
      }

      await refreshWishlist();
    } catch (err) {
      console.error('Error syncing guest wishlist to server:', err);
    }
  };

  const toggleWishlist = async (product) => {
    if (!product) return false;
    const itemId = String(product.id || product._id);
    const normalizedProduct = { ...product, id: itemId };

    if (authContextIsAuthenticated && userRole === 'user') {
      // Update instantly; reconcile with the server's response once it lands
      // instead of the previous toggle-then-refetch round trip (two requests
      // for one tap, and no visible change until both completed).
      const wasInWishlist = isInWishlist(itemId);
      setWishlistItems((prevItems) => {
        if (wasInWishlist) {
          return prevItems.filter((item) => String(item.id || item._id) !== itemId);
        }
        return [...prevItems, normalizedProduct];
      });

      try {
        const res = await wishlistService.toggleWishlist(itemId);
        if (res && res.success) {
          setWishlistItems(normalizeWishlistProducts(res.wishlist?.products || []));
          return res.isAdded;
        }
        // Unexpected response shape: fall back to authoritative refetch
        await refreshWishlist();
        return !wasInWishlist;
      } catch (err) {
        console.error('Failed to toggle server wishlist:', err);
        await refreshWishlist();
        return wasInWishlist;
      }
    }

    // Guest fallback (or offline)
    let isAdded = false;
    setWishlistItems((prevItems) => {
      const exists = prevItems.some((item) => String(item.id || item._id) === itemId);
      let updated;
      if (exists) {
        updated = prevItems.filter((item) => String(item.id || item._id) !== itemId);
        isAdded = false;
      } else {
        updated = [...prevItems, normalizedProduct];
        isAdded = true;
      }
      localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });

    return isAdded;
  };

  const addToWishlist = async (product) => {
    if (!product) return false;
    const itemId = String(product.id || product._id);
    if (isInWishlist(itemId)) return false;
    return await toggleWishlist(product);
  };

  const removeFromWishlist = async (productId) => {
    if (!productId) return;
    const itemId = String(productId);
    if (!isInWishlist(itemId)) return;
    await toggleWishlist({ id: itemId, _id: itemId });
  };

  const isInWishlist = (productId) => {
    if (!productId) return false;
    const targetId = String(productId);
    return wishlistItems.some((item) => {
      const id = typeof item === 'object' ? String(item.id || item._id) : String(item);
      return id === targetId;
    });
  };

  const wishlistCount = wishlistItems.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        wishlistCount,
        syncWishlistWithServer,
        refreshWishlist,
        loading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PageSkeleton from '../../../components/PageSkeleton';
import { membershipService } from '../../../services/authService';

/** Must match Backend MEMBERSHIP_ENFORCEMENT_CUTOFF — legacy sellers before this are exempt. */
const MEMBERSHIP_ENFORCEMENT_CUTOFF = new Date('2026-10-09T00:00:00.000Z');

const isLegacySellerFromStorage = () => {
  try {
    const raw = localStorage.getItem('sathiseller_seller_data');
    if (!raw) return false;
    const seller = JSON.parse(raw);
    if (seller?.createdAt && new Date(seller.createdAt) < MEMBERSHIP_ENFORCEMENT_CUTOFF) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
};

/**
 * Keeps NEW sellers without an active membership on /seller/membership.
 * Already-registered (legacy) sellers are exempt from this gate.
 */
const SellerMembershipGate = () => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsMembership, setNeedsMembership] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setChecking(true);

      if (isLegacySellerFromStorage()) {
        localStorage.removeItem('sathiseller_seller_requires_membership');
        if (!cancelled) {
          setNeedsMembership(false);
          setChecking(false);
        }
        return;
      }

      try {
        const res = await membershipService.getSellerMembership();
        const mem = res?.membership;
        const active =
          mem &&
          mem.membershipStatus === 'active' &&
          mem.expiryDate &&
          new Date(mem.expiryDate) > new Date();

        if (!cancelled) {
          setNeedsMembership(!active);
          if (active) {
            localStorage.removeItem('sathiseller_seller_requires_membership');
          } else {
            localStorage.setItem('sathiseller_seller_requires_membership', '1');
          }
        }
      } catch {
        if (!cancelled) {
          setNeedsMembership(localStorage.getItem('sathiseller_seller_requires_membership') === '1');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (checking) {
    return <PageSkeleton />;
  }

  if (needsMembership) {
    return <Navigate to="/seller/membership" replace />;
  }

  return <Outlet />;
};

export default SellerMembershipGate;

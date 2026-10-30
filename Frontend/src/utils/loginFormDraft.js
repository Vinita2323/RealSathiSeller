/**
 * Temporarily keep user/seller/captain login form values while the user opens
 * Terms / Privacy in the same tab. Cleared after a successful login / OTP send.
 */

export const readLoginDraft = (storageKey) => {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const writeLoginDraft = (storageKey, draft) => {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Ignore quota / private-mode failures
  }
};

export const clearLoginDraft = (storageKey) => {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
};

export const USER_LOGIN_DRAFT_KEY = 'sathiseller_user_login_draft';
export const SELLER_LOGIN_DRAFT_KEY = 'sathiseller_seller_login_draft';
export const CAPTAIN_LOGIN_DRAFT_KEY = 'sathiseller_captain_login_draft';

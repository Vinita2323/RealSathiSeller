export function isDeliverableLocation(loc) {
  if (!loc || typeof loc !== 'object') return false;
  const line = String(loc.addressLine1 || loc.address || loc.formattedAddress || '').trim();
  const city = String(loc.city || loc.area || '').trim();
  const label = line || city;
  if (!label) return false;
  const hasCoords = [loc.lat, loc.latitude, loc.lng, loc.longitude].some(
    (n) => n != null && n !== '' && Number(n) !== 0
  );
  if (hasCoords) return true;
  const normalized = label.toLowerCase();
  let accountName = '';
  try {
    accountName = String(localStorage.getItem('sathiseller_user_name') || '').trim().toLowerCase();
  } catch (e) {}
  const isNameOnly = normalized === accountName || normalized === 'user' || normalized === 'customer' || normalized === 'sarah jenkins';
  if (isNameOnly && !line) return false;
  const hasPin = String(loc.pincode || loc.zip || loc.postalCode || '').trim().length >= 4;
  if (line && (hasPin || city)) return true;
  return hasPin || /[0-9]/.test(label);
}

export function clearStoredUserLocation() {
  try {
    localStorage.removeItem('userLocation');
    window.dispatchEvent(new CustomEvent('sathiseller_location_changed', { detail: null }));
  } catch (e) {}
}

function currentUserId() {
  try {
    const raw = localStorage.getItem('sathiseller_user_data');
    if (!raw) return '';
    const user = JSON.parse(raw);
    return String(user.id || user._id || '');
  } catch (e) {
    return '';
  }
}

export function addressToDeliveryLocation(addr) {
  if (!addr || typeof addr !== 'object') return null;
  const line = String(addr.addressLine1 || addr.address || '').trim();
  if (!line) return null;
  const coords = addr.location?.coordinates;
  const hasCoords = Array.isArray(coords) && coords.length >= 2 && (Number(coords[0]) !== 0 || Number(coords[1]) !== 0);
  const loc = {
    addressType: addr.addressType || addr.type || 'Home',
    type: addr.addressType || addr.type || 'Home',
    addressLine1: line,
    address: line,
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.pincode || addr.zip || '',
    zip: addr.pincode || addr.zip || '',
    fullName: addr.fullName || addr.name || '',
    phone: addr.phone || '',
    _id: addr._id || addr.id || '',
    id: addr._id || addr.id || '',
    ownerId: currentUserId(),
    fromSavedAddress: true,
  };
  if (hasCoords) {
    loc.lng = Number(coords[0]);
    loc.lat = Number(coords[1]);
    loc.longitude = Number(coords[0]);
    loc.latitude = Number(coords[1]);
  }
  return isDeliverableLocation(loc) ? loc : null;
}

export function locationMatchesSavedAddress(loc, addr) {
  if (!loc || !addr) return false;
  const locId = String(loc._id || loc.id || '');
  const addrId = String(addr._id || addr.id || '');
  if (locId && addrId && locId === addrId) return true;
  const locLine = String(loc.addressLine1 || loc.address || '').trim().toLowerCase();
  const addrLine = String(addr.addressLine1 || addr.address || '').trim().toLowerCase();
  if (!locLine || locLine !== addrLine) return false;
  const locPin = String(loc.pincode || loc.zip || '').trim();
  const addrPin = String(addr.pincode || addr.zip || '').trim();
  return !locPin || !addrPin || locPin === addrPin;
}

export function pickDefaultSavedAddress(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  return addresses.find((addr) => addr.isDefault) || addresses[0];
}

export function applySavedAddressesAsDeliveryLocation(addresses, { notify = true } = {}) {
  const chosen = pickDefaultSavedAddress(addresses);
  const loc = addressToDeliveryLocation(chosen);
  try {
    if (!loc) {
      localStorage.removeItem('userLocation');
    } else {
      const storedRaw = localStorage.getItem('userLocation');
      if (storedRaw) {
        const stored = JSON.parse(storedRaw);
        const ownerId = currentUserId();
        const belongsToUser = !ownerId || !stored.ownerId || String(stored.ownerId) === ownerId;
        const matchesThisUser = belongsToUser && addresses.some((addr) => locationMatchesSavedAddress(stored, addr));
        let matchesSelected = false;
        try {
          const selectedRaw = localStorage.getItem('sathiseller_selected_checkout_address');
          if (selectedRaw) {
            const selected = JSON.parse(selectedRaw);
            matchesSelected = locationMatchesSavedAddress(stored, {
              ...selected,
              addressLine1: selected.addressLine1 || selected.address,
              pincode: selected.pincode || selected.zip,
              _id: selected._id || selected.id,
            });
          }
        } catch (e) {}
        if ((matchesThisUser || matchesSelected) && isDeliverableLocation(stored)) {
          if (notify) {
            window.dispatchEvent(new CustomEvent('sathiseller_location_changed', { detail: stored }));
          }
          return stored;
        }
      }
      localStorage.setItem('userLocation', JSON.stringify(loc));
    }
    if (notify) {
      window.dispatchEvent(new CustomEvent('sathiseller_location_changed', { detail: loc }));
    }
  } catch (e) {}
  return loc;
}

function findMatchingAddress(record, addresses) {
  if (!record || !Array.isArray(addresses)) return null;
  return addresses.find((addr) => locationMatchesSavedAddress(
    {
      ...record,
      addressLine1: record.addressLine1 || record.address,
      _id: record._id || record.id,
      id: record.id || record._id,
    },
    addr
  )) || null;
}

// Refresh stored lists after an address is saved without replacing a delivery
// location the user already picked, unless that pick is one of these addresses.
export function syncSavedAddressesAfterChange(addresses) {
  if (!Array.isArray(addresses)) return null;
  try {
    localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(addresses));

    const selectedRaw = localStorage.getItem('sathiseller_selected_checkout_address');
    if (selectedRaw) {
      const parsed = JSON.parse(selectedRaw);
      const match = findMatchingAddress(parsed, addresses);
      if (match) {
        localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(match));
      }
    } else {
      const fallback = pickDefaultSavedAddress(addresses);
      if (fallback) {
        localStorage.setItem('sathiseller_selected_checkout_address', JSON.stringify(fallback));
      }
    }

    const storedRaw = localStorage.getItem('userLocation');
    if (storedRaw) {
      const stored = JSON.parse(storedRaw);
      const match = findMatchingAddress(stored, addresses);
      if (match) {
        const loc = addressToDeliveryLocation(match);
        if (loc && isDeliverableLocation(loc)) {
          localStorage.setItem('userLocation', JSON.stringify(loc));
          window.dispatchEvent(new CustomEvent('sathiseller_location_changed', { detail: loc }));
          return loc;
        }
      }
      return isDeliverableLocation(stored) ? stored : null;
    }

    return applySavedAddressesAsDeliveryLocation(addresses);
  } catch (e) {
    return null;
  }
}

/**
 * Core localStorage database wrapper for KonkanStay Platform.
 * Supports auto-seeding, cross-tab synchronization, and an in-memory fallback
 * for non-browser / unit test environments.
 */

import {
  SEED_USERS,
  SEED_PROPERTIES,
  SEED_PRIVATE_DETAILS,
  SEED_BOOKINGS
} from './seedData.js';

export const STORAGE_KEYS = {
  USERS: 'konkanstay_users_v1',
  SESSION: 'konkanstay_session_v1',
  PROPERTIES: 'konkanstay_properties_v1',
  PRIVATE_DETAILS: 'konkanstay_private_details_v1',
  BOOKINGS: 'konkanstay_bookings_v1',
  AVAILABILITY: 'konkanstay_availability_v1',
  HOST_BLOCKED: 'konkanstay-hc-availability-v1',
  INITIALIZED: 'konkanstay_initialized_v1'
};

// Memory fallback when localStorage is unavailable
const memoryStore = new Map();

function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__ks_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasLocalStorage = isLocalStorageAvailable();

export function getRaw(key) {
  if (hasLocalStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) || null;
    }
  }
  return memoryStore.get(key) || null;
}

export function setRaw(key, value) {
  if (hasLocalStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStore.set(key, value);
    }
  } else {
    memoryStore.set(key, value);
  }
}

export function removeRaw(key) {
  if (hasLocalStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  } else {
    memoryStore.delete(key);
  }
}

export function readJson(key, defaultValue = null) {
  const raw = getRaw(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

export function writeJson(key, data) {
  try {
    setRaw(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`[KonkanStay] Failed to save ${key} to localStorage:`, error);
    return false;
  }
}

/**
 * Initializes localStorage with seed accounts and properties if not already initialized.
 */
export function ensureDatabaseInitialized() {
  const isInitialized = readJson(STORAGE_KEYS.INITIALIZED, false);
  if (isInitialized) return;

  // 1. Seed Users (if not present)
  const existingUsers = readJson(STORAGE_KEYS.USERS, null);
  if (!existingUsers || Object.keys(existingUsers).length === 0) {
    const userMap = {};
    SEED_USERS.forEach(u => {
      userMap[u.email.toLowerCase()] = { ...u };
    });
    writeJson(STORAGE_KEYS.USERS, userMap);
  }

  // 2. Seed Properties (if not present)
  const existingProperties = readJson(STORAGE_KEYS.PROPERTIES, null);
  if (!existingProperties || existingProperties.length === 0) {
    writeJson(STORAGE_KEYS.PROPERTIES, [...SEED_PROPERTIES]);
  }

  // 3. Seed Private Host Details
  const existingPrivateDetails = readJson(STORAGE_KEYS.PRIVATE_DETAILS, null);
  if (!existingPrivateDetails || Object.keys(existingPrivateDetails).length === 0) {
    writeJson(STORAGE_KEYS.PRIVATE_DETAILS, { ...SEED_PRIVATE_DETAILS });
  }

  // 4. Seed Bookings
  const existingBookings = readJson(STORAGE_KEYS.BOOKINGS, null);
  if (!existingBookings || existingBookings.length === 0) {
    writeJson(STORAGE_KEYS.BOOKINGS, [...SEED_BOOKINGS]);
  }

  // 5. Seed occupied dates from confirmed bookings
  const availabilityMap = readJson(STORAGE_KEYS.AVAILABILITY, {}) || {};
  SEED_BOOKINGS.filter(b => b.status === 'Confirmed').forEach(b => {
    if (!availabilityMap[b.propId]) availabilityMap[b.propId] = {};
    const start = new Date(`${b.checkin}T00:00:00`);
    const end = new Date(`${b.checkout}T00:00:00`);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      availabilityMap[b.propId][key] = {
        bookingId: b.id,
        date: key,
        occupied: true,
        isPublic: true,
        createdAt: b.createdAt
      };
    }
  });
  writeJson(STORAGE_KEYS.AVAILABILITY, availabilityMap);

  writeJson(STORAGE_KEYS.INITIALIZED, true);
}

// Auto-run on import
ensureDatabaseInitialized();

/**
 * LocalStorage Data Service for KonkanStay Platform.
 * Persistent, fast, offline-ready browser storage for properties and bookings.
 */

import {
  STORAGE_KEYS,
  readJson,
  writeJson,
  ensureDatabaseInitialized
} from './localStorageDb.js';
import { getStayDateKeys } from '../bookingUtils.mjs';

// --- Properties ---

export const getProperties = async () => {
  ensureDatabaseInitialized();
  const properties = readJson(STORAGE_KEYS.PROPERTIES, []) || [];
  return properties
    .filter(p => p.isPublic !== false)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};

export const getPropertiesByHost = async (hostEmail) => {
  ensureDatabaseInitialized();
  const properties = readJson(STORAGE_KEYS.PROPERTIES, []) || [];
  return properties.filter(p => p.hostEmail === hostEmail);
};

export const addProperty = async (propertyData) => {
  ensureDatabaseInitialized();
  const { hostName, hostPhone, upiId, bankAcc, bankIfsc, qrCode, ...listingData } = propertyData;
  const propertyId = `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();

  const newProperty = {
    ...listingData,
    id: propertyId,
    isPublic: true,
    createdAt
  };

  const properties = readJson(STORAGE_KEYS.PROPERTIES, []) || [];
  properties.unshift(newProperty);
  writeJson(STORAGE_KEYS.PROPERTIES, properties);

  const privateDetails = { hostName, hostPhone, upiId, bankAcc, bankIfsc, qrCode };
  if (Object.values(privateDetails).some(value => typeof value === 'string' && value.trim())) {
    const allPrivate = readJson(STORAGE_KEYS.PRIVATE_DETAILS, {}) || {};
    allPrivate[propertyId] = {
      hostEmail: listingData.hostEmail,
      ...privateDetails
    };
    writeJson(STORAGE_KEYS.PRIVATE_DETAILS, allPrivate);
  }

  return propertyId;
};

export const getPropertyPrivateDetails = async (propertyId) => {
  ensureDatabaseInitialized();
  const allPrivate = readJson(STORAGE_KEYS.PRIVATE_DETAILS, {}) || {};
  return allPrivate[propertyId] || {};
};

// --- Availability & Blocked Nights ---

export const getHostBlockedDates = (propertyId) => {
  try {
    const allBlocked = readJson(STORAGE_KEYS.HOST_BLOCKED, {}) || {};
    return new Set(allBlocked[propertyId] || []);
  } catch {
    return new Set();
  }
};

export const setHostBlockedDates = async (propertyId, dates, action) => {
  ensureDatabaseInitialized();
  const allBlocked = readJson(STORAGE_KEYS.HOST_BLOCKED, {}) || {};
  const currentSet = new Set(allBlocked[propertyId] || []);

  if (action === 'block') {
    dates.forEach(d => currentSet.add(d));
  } else {
    dates.forEach(d => currentSet.delete(d));
  }

  allBlocked[propertyId] = Array.from(currentSet);
  writeJson(STORAGE_KEYS.HOST_BLOCKED, allBlocked);

  // Sync with availability map
  const availMap = readJson(STORAGE_KEYS.AVAILABILITY, {}) || {};
  if (!availMap[propertyId]) availMap[propertyId] = {};

  dates.forEach(date => {
    if (action === 'block') {
      availMap[propertyId][date] = {
        date,
        occupied: true,
        blockedByHost: true,
        createdAt: new Date().toISOString()
      };
    } else {
      if (availMap[propertyId][date]?.blockedByHost) {
        delete availMap[propertyId][date];
      }
    }
  });
  writeJson(STORAGE_KEYS.AVAILABILITY, availMap);

  return true;
};

export const getPropertyOccupiedNights = async (propertyId) => {
  ensureDatabaseInitialized();
  const occupiedNights = {};

  // 1. Nights from confirmed bookings in localStorage
  const bookings = readJson(STORAGE_KEYS.BOOKINGS, []) || [];
  bookings
    .filter(b => b.propId === propertyId && b.status === 'Confirmed')
    .forEach(b => {
      const keys = getStayDateKeys(b.checkin, b.checkout);
      keys.forEach(k => { occupiedNights[k] = true; });
    });

  // 2. Nights from availability map in localStorage
  const availMap = readJson(STORAGE_KEYS.AVAILABILITY, {}) || {};
  const propAvail = availMap[propertyId] || {};
  Object.keys(propAvail).forEach(dateKey => {
    if (propAvail[dateKey]?.occupied) {
      occupiedNights[dateKey] = true;
    }
  });

  // 3. Nights blocked by host
  const hostBlocked = getHostBlockedDates(propertyId);
  hostBlocked.forEach(d => { occupiedNights[d] = true; });

  return occupiedNights;
};

// --- Bookings ---

export const getBookingsByCustomer = async (customerEmail) => {
  ensureDatabaseInitialized();
  const bookings = readJson(STORAGE_KEYS.BOOKINGS, []) || [];
  return bookings
    .filter(b => b.customerEmail === customerEmail)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};

export const getBookingsByHost = async (hostEmail) => {
  ensureDatabaseInitialized();
  const bookings = readJson(STORAGE_KEYS.BOOKINGS, []) || [];
  return bookings
    .filter(b => b.hostEmail === hostEmail)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};

export const addBooking = async (bookingData) => {
  ensureDatabaseInitialized();
  const bookingId = `KS-RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const newBooking = {
    ...bookingData,
    id: bookingId,
    createdAt: new Date().toISOString()
  };

  const bookings = readJson(STORAGE_KEYS.BOOKINGS, []) || [];
  bookings.unshift(newBooking);
  writeJson(STORAGE_KEYS.BOOKINGS, bookings);

  return bookingId;
};

export const updateBookingStatus = async (bookingId, status) => {
  ensureDatabaseInitialized();
  const bookings = readJson(STORAGE_KEYS.BOOKINGS, []) || [];
  const bookingIndex = bookings.findIndex(b => b.id === bookingId);

  if (bookingIndex === -1) {
    throw new Error('Booking no longer exists.');
  }

  const booking = bookings[bookingIndex];

  if (['Declined', 'Checked in', 'Completed'].includes(status)) {
    booking.status = status;
    bookings[bookingIndex] = booking;
    writeJson(STORAGE_KEYS.BOOKINGS, bookings);

    // If declined, release occupied nights
    if (status === 'Declined') {
      const availMap = readJson(STORAGE_KEYS.AVAILABILITY, {}) || {};
      const propAvail = availMap[booking.propId] || {};
      const nightKeys = getStayDateKeys(booking.checkin, booking.checkout);
      nightKeys.forEach(date => {
        if (propAvail[date]?.bookingId === bookingId) {
          delete propAvail[date];
        }
      });
      availMap[booking.propId] = propAvail;
      writeJson(STORAGE_KEYS.AVAILABILITY, availMap);
    }
    return;
  }

  if (status !== 'Confirmed') {
    throw new Error('Unsupported booking status transition.');
  }

  if (booking.status !== 'Pending verification') {
    throw new Error('Booking is no longer awaiting confirmation.');
  }

  const nightKeys = getStayDateKeys(booking.checkin, booking.checkout);
  if (!nightKeys.length) {
    throw new Error('Booking dates are invalid.');
  }

  // Check for availability conflicts
  const currentlyOccupied = await getPropertyOccupiedNights(booking.propId);
  for (const date of nightKeys) {
    // Check if another confirmed booking or host block already occupies this night
    const conflictBooking = bookings.find(b =>
      b.id !== bookingId &&
      b.propId === booking.propId &&
      b.status === 'Confirmed' &&
      getStayDateKeys(b.checkin, b.checkout).includes(date)
    );
    const isHostBlocked = getHostBlockedDates(booking.propId).has(date);

    if (conflictBooking || isHostBlocked) {
      const error = new Error(`The property is already occupied on ${date}.`);
      error.code = 'availability-conflict';
      throw error;
    }
  }

  // Mark as confirmed
  booking.status = 'Confirmed';
  bookings[bookingIndex] = booking;
  writeJson(STORAGE_KEYS.BOOKINGS, bookings);

  // Record nights in availability map
  const availMap = readJson(STORAGE_KEYS.AVAILABILITY, {}) || {};
  if (!availMap[booking.propId]) availMap[booking.propId] = {};
  nightKeys.forEach(date => {
    availMap[booking.propId][date] = {
      bookingId,
      date,
      isPublic: true,
      occupied: true,
      createdAt: new Date().toISOString()
    };
  });
  writeJson(STORAGE_KEYS.AVAILABILITY, availMap);
};

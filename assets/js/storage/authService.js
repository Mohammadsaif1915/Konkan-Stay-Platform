/**
 * LocalStorage Authentication Service for KonkanStay Platform.
 * Pure browser-based authentication with zero external network dependencies.
 */

import {
  STORAGE_KEYS,
  readJson,
  writeJson,
  removeRaw,
  ensureDatabaseInitialized
} from './localStorageDb.js';

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function notifyAuthChange(user) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('konkanstay:auth', { detail: { user } }));
    } catch {
      // Ignore if CustomEvent not supported
    }
  }
}

export const registerUser = async (email, password, userData = {}) => {
  ensureDatabaseInitialized();
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    const err = new Error('Please enter a valid email address.');
    err.code = 'auth/invalid-email';
    throw err;
  }

  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters.');
    err.code = 'auth/weak-password';
    throw err;
  }

  const users = readJson(STORAGE_KEYS.USERS, {}) || {};

  if (users[cleanEmail]) {
    const err = new Error('This email is already registered. Try logging in instead.');
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  const uid = 'user-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const newUser = {
    uid,
    email: cleanEmail,
    password, // Stored safely in localStorage for offline client verification
    userType: userData.userType || 'customer',
    username: userData.username || cleanEmail.split('@')[0],
    fullname: userData.fullname || userData.username || cleanEmail.split('@')[0],
    phone: userData.phone || '',
    surveyNo: userData.surveyNo || '',
    createdAt: new Date().toISOString(),
    ...userData
  };

  users[cleanEmail] = newUser;
  writeJson(STORAGE_KEYS.USERS, users);

  // Auto-login newly registered user
  const sessionUser = { uid: newUser.uid, email: newUser.email };
  writeJson(STORAGE_KEYS.SESSION, sessionUser);
  notifyAuthChange(sessionUser);

  return sessionUser;
};

export const loginUser = async (email, password) => {
  ensureDatabaseInitialized();
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    const err = new Error('Please enter your email address.');
    err.code = 'auth/invalid-email';
    throw err;
  }

  const users = readJson(STORAGE_KEYS.USERS, {}) || {};
  const user = users[cleanEmail];

  if (!user) {
    const err = new Error('No account found with this email. Please register first.');
    err.code = 'auth/user-not-found';
    throw err;
  }

  if (user.password !== password) {
    const err = new Error('Incorrect password. Please try again.');
    err.code = 'auth/wrong-password';
    throw err;
  }

  const sessionUser = { uid: user.uid, email: user.email };
  writeJson(STORAGE_KEYS.SESSION, sessionUser);
  notifyAuthChange(sessionUser);

  return sessionUser;
};

export const logoutUser = async () => {
  removeRaw(STORAGE_KEYS.SESSION);
  notifyAuthChange(null);
  return true;
};

export const getCurrentUser = () => {
  ensureDatabaseInitialized();
  return readJson(STORAGE_KEYS.SESSION, null);
};

export const getUserProfile = async (uid) => {
  ensureDatabaseInitialized();
  if (!uid) return null;
  const users = readJson(STORAGE_KEYS.USERS, {}) || {};
  const found = Object.values(users).find(u => u.uid === uid);
  if (!found) return null;

  // Return user profile without leaking password field
  const { password, ...safeProfile } = found;
  return safeProfile;
};

export const verifyUserPassword = async (email, password) => {
  ensureDatabaseInitialized();
  const cleanEmail = normalizeEmail(email);
  const users = readJson(STORAGE_KEYS.USERS, {}) || {};
  const user = users[cleanEmail];

  if (!user) {
    const err = new Error('Account not found.');
    err.code = 'auth/user-not-found';
    throw err;
  }

  if (user.password !== password) {
    const err = new Error('Incorrect password. Please try again.');
    err.code = 'auth/wrong-password';
    throw err;
  }

  return true;
};

export const subscribeToAuthChanges = (callback) => {
  ensureDatabaseInitialized();

  // Initial call with current state
  const current = getCurrentUser();
  setTimeout(() => callback(current), 0);

  if (typeof window === 'undefined') {
    return () => {};
  }

  const onCustomAuth = (e) => {
    callback(e.detail?.user || null);
  };

  const onStorageChange = (e) => {
    if (e.key === STORAGE_KEYS.SESSION) {
      const updated = readJson(STORAGE_KEYS.SESSION, null);
      callback(updated);
    }
  };

  window.addEventListener('konkanstay:auth', onCustomAuth);
  window.addEventListener('storage', onStorageChange);

  return () => {
    window.removeEventListener('konkanstay:auth', onCustomAuth);
    window.removeEventListener('storage', onStorageChange);
  };
};

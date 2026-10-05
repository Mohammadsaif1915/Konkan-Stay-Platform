import { db } from './config.js';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  getDoc,
  updateDoc, 
  writeBatch,
  query, 
  where, 
  runTransaction
} from 'firebase/firestore';
import { getStayDateKeys } from '../bookingUtils.mjs';

// --- Properties ---
export const getProperties = async () => {
  const q = query(collection(db, 'properties'), where('isPublic', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};

export const getPropertiesByHost = async (hostEmail) => {
  const q = query(collection(db, 'properties'), where('isPublic', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(property => property.hostEmail === hostEmail);
};

export const addProperty = async (propertyData) => {
  const { hostName, hostPhone, upiId, bankAcc, bankIfsc, qrCode, ...listingData } = propertyData;
  const propertyRef = doc(collection(db, 'properties'));
  const batch = writeBatch(db);
  const createdAt = new Date().toISOString();

  batch.set(propertyRef, { ...listingData, isPublic: true, createdAt });

  const privateDetails = { hostName, hostPhone, upiId, bankAcc, bankIfsc, qrCode };
  if (Object.values(privateDetails).some(value => typeof value === 'string' && value.trim())) {
    batch.set(doc(db, 'propertyPrivateDetails', propertyRef.id), {
      hostEmail: listingData.hostEmail,
      ...privateDetails
    });
  }

  await batch.commit();
  return propertyRef.id;
};

export const getPropertyPrivateDetails = async (propertyId) => {
  const privateDetailsDoc = await getDoc(doc(db, 'propertyPrivateDetails', propertyId));
  return privateDetailsDoc.exists() ? privateDetailsDoc.data() : {};
};

export const getPropertyOccupiedNights = async (propertyId) => {
  const nightsQuery = query(
    collection(db, 'properties', propertyId, 'availability'),
    where('isPublic', '==', true)
  );
  const snapshot = await getDocs(nightsQuery);
  return Object.fromEntries(snapshot.docs.map(night => [night.id, true]));
};

// --- Bookings ---
export const getBookingsByCustomer = async (customerEmail) => {
  const q = query(collection(db, 'bookings'), where('customerEmail', '==', customerEmail));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getBookingsByHost = async (hostEmail) => {
  const q = query(collection(db, 'bookings'), where('hostEmail', '==', hostEmail));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addBooking = async (bookingData) => {
  const docRef = await addDoc(collection(db, 'bookings'), {
    ...bookingData,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};

export const updateBookingStatus = async (bookingId, status) => {
  const bookingRef = doc(db, 'bookings', bookingId);
  if (['Declined', 'Checked in', 'Completed'].includes(status)) {
    await updateDoc(bookingRef, { status });
    return;
  }
  if (status !== 'Confirmed') throw new Error('Unsupported booking status transition.');

  await runTransaction(db, async transaction => {
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists()) throw new Error('Booking no longer exists.');
    const booking = bookingSnapshot.data();
    if (booking.status !== 'Pending verification') throw new Error('Booking is no longer awaiting confirmation.');

    const nightKeys = getStayDateKeys(booking.checkin, booking.checkout);
    if (!nightKeys.length) throw new Error('Booking dates are invalid.');
    const availabilityRefs = nightKeys.map(date =>
      doc(db, 'properties', booking.propId, 'availability', date)
    );
    const availabilitySnapshots = await Promise.all(availabilityRefs.map(reference => transaction.get(reference)));
    const conflict = availabilitySnapshots.find(snapshot =>
      snapshot.exists() && snapshot.data().bookingId !== bookingId
    );
    if (conflict) {
      const error = new Error(`The property is already occupied on ${conflict.id}.`);
      error.code = 'availability-conflict';
      throw error;
    }

    transaction.update(bookingRef, { status: 'Confirmed' });
    availabilitySnapshots.forEach((snapshot, index) => {
      if (snapshot.exists()) return;
      transaction.set(availabilityRefs[index], {
        bookingId,
        date: nightKeys[index],
        isPublic: true,
        occupied: true,
        createdAt: new Date().toISOString()
      });
    });
  });
};

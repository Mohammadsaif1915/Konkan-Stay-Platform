import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnvironment = await initializeTestEnvironment({
  projectId: 'demo-konkanstay',
  firestore: { rules }
});

const listing = {
  title: 'Coastal House',
  location: 'Alibaug',
  price: 2500,
  guests: 4,
  description: 'A sample stay for rules tests.',
  hostEmail: 'host@example.com',
  isPublic: true,
  createdAt: '2026-09-30T12:00:00.000Z'
};

const privateDetails = {
  hostEmail: listing.hostEmail,
  hostName: 'Sample Host',
  hostPhone: '+910000000000',
  upiId: 'host@example',
  bankAcc: '1234567890',
  bankIfsc: 'TEST0000001',
  qrCode: ''
};

function booking(overrides = {}) {
  return {
    propId: 'property-1',
    propTitle: listing.title,
    propLocation: listing.location,
    hostEmail: listing.hostEmail,
    customerEmail: 'traveler@example.com',
    customerName: 'Sample Traveler',
    checkin: '2026-10-01',
    checkout: '2026-10-03',
    guests: 2,
    nights: 2,
    totalPrice: 5000,
    status: 'Requested',
    createdAt: '2026-09-30T12:00:00.000Z',
    ...overrides
  };
}

function customerDb() {
  return testEnvironment.authenticatedContext('traveler-1', {
    email: 'traveler@example.com'
  }).firestore();
}

function hostDb() {
  return testEnvironment.authenticatedContext('host-1', {
    email: 'host@example.com'
  }).firestore();
}

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'host-1'), {
      uid: 'host-1', email: 'host@example.com', userType: 'host', createdAt: listing.createdAt
    });
    await setDoc(doc(db, 'users', 'traveler-1'), {
      uid: 'traveler-1', email: 'traveler@example.com', userType: 'customer', createdAt: listing.createdAt
    });
    await setDoc(doc(db, 'users', 'other-user'), {
      uid: 'other-user', email: 'other@example.com', userType: 'customer', createdAt: listing.createdAt
    });
    await setDoc(doc(db, 'properties', 'property-1'), listing);
    await setDoc(doc(db, 'propertyPrivateDetails', 'property-1'), privateDetails);
    await setDoc(doc(db, 'bookings', 'booking-1'), booking({
      status: 'Pending verification', txnId: 'UTR-TEST-001'
    }));
    await setDoc(doc(db, 'bookings', 'requested-booking'), booking());
    await setDoc(doc(db, 'bookings', 'overlap-booking'), booking({
      customerEmail: 'other@example.com',
      checkin: '2026-10-02',
      checkout: '2026-10-04',
      nights: 2,
      totalPrice: 5000,
      status: 'Pending verification',
      txnId: 'UTR-OVERLAP-001'
    }));
  });
});

after(async () => {
  await testEnvironment.cleanup();
});

test('public users can read listings but not private host details', async () => {
  const db = testEnvironment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'properties', 'property-1')));
  await assertSucceeds(getDocs(query(collection(db, 'properties'), where('isPublic', '==', true))));
  await assertFails(getDoc(doc(db, 'propertyPrivateDetails', 'property-1')));
});

test('public users cannot directly read listings with legacy private fields', async () => {
  await testEnvironment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'properties', 'legacy-property'), {
      ...listing,
      isPublic: false,
      upiId: 'host@example'
    });
  });

  const db = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'properties', 'legacy-property')));
  await assertFails(getDoc(doc(customerDb(), 'properties', 'legacy-property')));
  const publicListings = await getDocs(query(collection(db, 'properties'), where('isPublic', '==', true)));
  assert.equal(publicListings.docs.some(propertyDoc => propertyDoc.id === 'legacy-property'), false);
});

test('customers can read their own profile, not enumerate profiles or private details', async () => {
  const db = customerDb();
  await assertSucceeds(getDoc(doc(db, 'users', 'traveler-1')));
  await assertFails(getDoc(doc(db, 'users', 'other-user')));
  await assertFails(getDocs(collection(db, 'users')));
  await assertSucceeds(getDoc(doc(db, 'propertyPrivateDetails', 'property-1')));
  await assertFails(getDocs(collection(db, 'propertyPrivateDetails')));
});

test('a customer can create only a correctly-priced booking for their own account', async () => {
  const db = customerDb();
  const payableBooking = booking({ status: 'Pending verification', txnId: 'UTR-TEST-002' });
  await assertSucceeds(setDoc(doc(db, 'bookings', 'valid-booking'), payableBooking));
  await assertFails(setDoc(doc(db, 'bookings', 'wrong-owner'), booking({
    ...payableBooking,
    customerEmail: 'other@example.com'
  })));
  await assertFails(setDoc(doc(db, 'bookings', 'wrong-total'), booking({ ...payableBooking, totalPrice: 1 })));
  await assertFails(setDoc(doc(db, 'bookings', 'self-confirmed'), booking({ ...payableBooking, status: 'Confirmed' })));
  await assertFails(setDoc(doc(db, 'bookings', 'over-capacity'), booking({ ...payableBooking, guests: 5 })));
  await assertFails(setDoc(doc(db, 'bookings', 'pending-without-reference'), booking({
    status: 'Pending verification'
  })));
  await assertFails(setDoc(doc(db, 'bookings', 'blank-reference'), booking({
    status: 'Pending verification', txnId: '   '
  })));
  await assertFails(setDoc(doc(hostDb(), 'bookings', 'host-booking'), booking({
    ...payableBooking, customerEmail: 'host@example.com'
  })));
});

test('only the associated host can confirm through a night-lock transaction', async () => {
  await assertFails(updateDoc(doc(customerDb(), 'bookings', 'booking-1'), { status: 'Confirmed' }));
  await assertFails(updateDoc(doc(hostDb(), 'bookings', 'requested-booking'), { status: 'Confirmed' }));
  await assertFails(updateDoc(doc(hostDb(), 'bookings', 'booking-1'), {
    status: 'Confirmed', totalPrice: 1
  }));
  await assertFails(updateDoc(doc(hostDb(), 'bookings', 'booking-1'), { status: 'Confirmed' }));
});

test('host confirmation claims every occupied night atomically and prevents overlap', async () => {
  const db = hostDb();
  const firstBooking = doc(db, 'bookings', 'booking-1');
  const nightDates = ['2026-10-01', '2026-10-02'];

  await assertSucceeds(runTransaction(db, async transaction => {
    const bookingSnapshot = await transaction.get(firstBooking);
    const nightRefs = nightDates.map(date => doc(db, 'properties', 'property-1', 'availability', date));
    const nightSnapshots = await Promise.all(nightRefs.map(reference => transaction.get(reference)));
    assert.equal(nightSnapshots.some(snapshot => snapshot.exists()), false);
    transaction.update(firstBooking, { status: 'Confirmed' });
    nightRefs.forEach((reference, index) => transaction.set(reference, {
      bookingId: 'booking-1', date: nightDates[index], isPublic: true, occupied: true,
      createdAt: listing.createdAt
    }));
    assert.equal(bookingSnapshot.data().status, 'Pending verification');
  }));

  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const publicNights = await getDocs(query(
    collection(publicDb, 'properties', 'property-1', 'availability'), where('isPublic', '==', true)
  ));
  assert.equal(publicNights.size, 2);
  await assertSucceeds(getDoc(doc(customerDb(), 'properties', 'property-1', 'availability', '2026-10-01')));

  await assertFails(runTransaction(db, async transaction => {
    const overlapBooking = doc(db, 'bookings', 'overlap-booking');
    const snapshot = await transaction.get(overlapBooking);
    const overlapDates = ['2026-10-02', '2026-10-03'];
    const refs = overlapDates.map(date => doc(db, 'properties', 'property-1', 'availability', date));
    const existing = await Promise.all(refs.map(reference => transaction.get(reference)));
    transaction.update(overlapBooking, { status: 'Confirmed' });
    refs.forEach((reference, index) => transaction.set(reference, {
      bookingId: 'overlap-booking', date: overlapDates[index], isPublic: true, occupied: true,
      createdAt: listing.createdAt
    }));
    assert.equal(snapshot.data().status, 'Pending verification');
    assert.equal(existing[0].exists(), true);
  }));

  await assertSucceeds(updateDoc(doc(hostDb(), 'bookings', 'booking-1'), { status: 'Checked in' }));
  await assertSucceeds(updateDoc(doc(hostDb(), 'bookings', 'booking-1'), { status: 'Completed' }));
  await assertFails(updateDoc(doc(customerDb(), 'bookings', 'booking-1'), { status: 'Checked in' }));
});

test('host can create a listing and private details atomically', async () => {
  const db = hostDb();
  const batch = writeBatch(db);
  batch.set(doc(db, 'properties', 'new-property'), {
    ...listing,
    hostEmail: 'host@example.com'
  });
  batch.set(doc(db, 'propertyPrivateDetails', 'new-property'), privateDetails);
  await assertSucceeds(batch.commit());

  await assertFails(setDoc(doc(db, 'properties', 'public-private-data'), {
    ...listing,
    hostEmail: 'host@example.com',
    bankAcc: '1234567890'
  }));
});

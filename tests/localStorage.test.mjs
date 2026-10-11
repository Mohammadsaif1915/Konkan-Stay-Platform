import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  getCurrentUser,
  verifyUserPassword
} from '../assets/js/storage/authService.js';
import {
  getProperties,
  getPropertiesByHost,
  addProperty,
  getPropertyPrivateDetails,
  getPropertyOccupiedNights,
  getBookingsByCustomer,
  getBookingsByHost,
  addBooking,
  updateBookingStatus,
  setHostBlockedDates
} from '../assets/js/storage/storageService.js';

test('seeds default accounts and allows login for demo host and customer', async () => {
  // Test seeded host login
  const host = await loginUser('mira@konkanstay.com', 'Password123');
  assert.equal(host.email, 'mira@konkanstay.com');
  assert.ok(host.uid);

  const hostProfile = await getUserProfile(host.uid);
  assert.equal(hostProfile.userType, 'host');
  assert.equal(hostProfile.fullname, 'Mira Deshmukh');
  assert.equal(hostProfile.password, undefined); // Password must not be leaked

  // Test seeded customer login
  const customer = await loginUser('rohit@example.com', 'Password123');
  assert.equal(customer.email, 'rohit@example.com');
  const custProfile = await getUserProfile(customer.uid);
  assert.equal(custProfile.userType, 'customer');

  // Verify password directly
  assert.equal(await verifyUserPassword('rohit@example.com', 'Password123'), true);
  await assert.rejects(
    async () => verifyUserPassword('rohit@example.com', 'WrongPass'),
    /Incorrect password/
  );
});

test('registers new user and rejects duplicates', async () => {
  const newEmail = `user_${Date.now()}@example.com`;
  const newUser = await registerUser(newEmail, 'SecurePass123', {
    fullname: 'Test Traveler',
    userType: 'customer',
    username: 'traveler_test'
  });

  assert.equal(newUser.email, newEmail);
  const session = getCurrentUser();
  assert.equal(session.email, newEmail);

  // Attempt duplicate registration
  await assert.rejects(
    async () => registerUser(newEmail, 'AnotherPass', { userType: 'customer' }),
    /already registered/
  );

  // Logout
  await logoutUser();
  assert.equal(getCurrentUser(), null);
});

test('retrieves seeded properties and adds a new host property', async () => {
  const initialProps = await getProperties();
  assert.ok(initialProps.length >= 6);

  const hostEmail = 'host_test@example.com';
  const newPropId = await addProperty({
    title: 'Sunset Cliff Homestay',
    location: 'Tarkarli',
    type: 'Homestay',
    price: 3500,
    guests: 4,
    bedrooms: 2,
    hostEmail,
    hostName: 'Test Host',
    hostPhone: '+91 99999 88888',
    upiId: 'testhost@upi',
    amenities: ['WiFi', 'Beach Access']
  });

  assert.ok(newPropId.startsWith('prop-'));

  const hostProps = await getPropertiesByHost(hostEmail);
  assert.equal(hostProps.length, 1);
  assert.equal(hostProps[0].title, 'Sunset Cliff Homestay');

  const privateDetails = await getPropertyPrivateDetails(newPropId);
  assert.equal(privateDetails.upiId, 'testhost@upi');
  assert.equal(privateDetails.hostPhone, '+91 99999 88888');
});

test('manages bookings, status updates, and prevents date conflicts on confirmation', async () => {
  const propId = 'hc-prop-alibaug-villa';
  const customerEmail = 'tester_booking@example.com';

  const bookingId = await addBooking({
    propId,
    propTitle: 'Azure Cliffs Villa',
    propLocation: 'Alibaug',
    hostEmail: 'mira@konkanstay.com',
    customerEmail,
    customerName: 'Booking Tester',
    customerMobile: '+91 90000 00000',
    checkin: '2026-11-20',
    checkout: '2026-11-23',
    guests: 2,
    nights: 3,
    totalPrice: 25500,
    status: 'Pending verification'
  });

  assert.ok(bookingId.startsWith('KS-RES-'));

  const custBookings = await getBookingsByCustomer(customerEmail);
  assert.ok(custBookings.some(b => b.id === bookingId));

  // Confirm booking
  await updateBookingStatus(bookingId, 'Confirmed');
  const occupiedNights = await getPropertyOccupiedNights(propId);
  assert.equal(occupiedNights['2026-11-20'], true);
  assert.equal(occupiedNights['2026-11-21'], true);
  assert.equal(occupiedNights['2026-11-22'], true);
  assert.equal(occupiedNights['2026-11-23'], undefined); // Checkout is exclusive

  // Create conflicting booking for overlapping dates
  const conflictingBookingId = await addBooking({
    propId,
    propTitle: 'Azure Cliffs Villa',
    propLocation: 'Alibaug',
    hostEmail: 'mira@konkanstay.com',
    customerEmail: 'another@example.com',
    checkin: '2026-11-21',
    checkout: '2026-11-24',
    status: 'Pending verification'
  });

  // Confirming conflicting booking must throw availability-conflict error
  await assert.rejects(
    async () => updateBookingStatus(conflictingBookingId, 'Confirmed'),
    /already occupied/
  );

  // Status progression to Checked in and Completed
  await updateBookingStatus(bookingId, 'Checked in');
  await updateBookingStatus(bookingId, 'Completed');
});

test('host can block and unblock dates for property availability', async () => {
  const propId = 'hc-prop-murud-bungalow';
  const datesToBlock = ['2026-12-24', '2026-12-25', '2026-12-26'];

  await setHostBlockedDates(propId, datesToBlock, 'block');
  let occupied = await getPropertyOccupiedNights(propId);
  assert.equal(occupied['2026-12-24'], true);
  assert.equal(occupied['2026-12-25'], true);

  await setHostBlockedDates(propId, ['2026-12-24'], 'unblock');
  occupied = await getPropertyOccupiedNights(propId);
  assert.equal(occupied['2026-12-24'], undefined);
  assert.equal(occupied['2026-12-25'], true);
});

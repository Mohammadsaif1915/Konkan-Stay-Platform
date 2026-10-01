import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStayTotal, escapeHtml, getAvailabilityStatus, getHostBookingNextStep, getLocalDateString, getOccupiedNightRanges, getStayDateKeys, getStayNights, hasDateOverlap, isPropertyAvailable } from '../assets/js/bookingUtils.mjs';

test('calculates nights across month and leap-day boundaries', () => {
  assert.equal(getStayNights('2024-02-28', '2024-03-01'), 2);
  assert.equal(getStayNights('2026-09-30', '2026-10-01'), 1);
});

test('formats a local calendar date without UTC offset shifts', () => {
  assert.equal(getLocalDateString(new Date(2026, 8, 30)), '2026-09-30');
});

test('rejects invalid dates and non-positive stays', () => {
  assert.equal(getStayNights('2026-02-30', '2026-03-02'), null);
  assert.equal(getStayNights('2026-09-30', '2026-09-30'), null);
  assert.equal(getStayNights('2026-10-01', '2026-09-30'), null);
});

test('calculates safe whole-number booking totals', () => {
  assert.equal(calculateStayTotal(2500, '2026-09-30', '2026-10-02'), 5000);
  assert.equal(calculateStayTotal(0, '2026-09-30', '2026-10-02'), null);
  assert.equal(calculateStayTotal(Number.MAX_SAFE_INTEGER, '2026-09-30', '2026-10-02'), null);
});

test('escapes HTML text before insertion into templates', () => {
  assert.equal(escapeHtml(`<script title="x">'&</script>`), '&lt;script title=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;');
});

test('date overlap treats checkout as exclusive', () => {
  assert.equal(hasDateOverlap('2026-10-11', '2026-10-12', '2026-10-12', '2026-10-13'), false);
  assert.equal(hasDateOverlap('2026-10-11', '2026-10-13', '2026-10-12', '2026-10-14'), true);
  assert.equal(hasDateOverlap('invalid', '2026-10-13', '2026-10-12', '2026-10-14'), false);
});

test('availability blocks confirmed stays and active holds for the same property', () => {
  const reservations = [
    { propId: 'stay-1', checkin: '2026-10-11', checkout: '2026-10-13', status: 'Demo confirmed' },
    { propId: 'stay-1', checkin: '2026-10-20', checkout: '2026-10-22', status: 'Hold', expiresAt: 5000 },
    { propId: 'stay-1', checkin: '2026-10-25', checkout: '2026-10-27', status: 'Hold', expiresAt: 500 }
  ];
  assert.equal(isPropertyAvailable('stay-1', '2026-10-12', '2026-10-14', reservations, 1000), false);
  assert.equal(isPropertyAvailable('stay-1', '2026-10-20', '2026-10-21', reservations, 1000), false);
  assert.equal(isPropertyAvailable('stay-1', '2026-10-25', '2026-10-26', reservations, 1000), true);
  assert.equal(isPropertyAvailable('stay-2', '2026-10-12', '2026-10-14', reservations, 1000), true);
});

test('availability status reports occupied-through dates and selected-date conflicts', () => {
  const reservations = [
    { propId: 'stay-1', checkin: '2026-10-01', checkout: '2026-10-03', status: 'Demo confirmed' },
    { propId: 'stay-1', checkin: '2026-10-03', checkout: '2026-10-05', status: 'Confirmed' },
    { propId: 'stay-1', checkin: '2026-10-12', checkout: '2026-10-14', status: 'Hold', expiresAt: 5000 }
  ];
  assert.deepEqual(getAvailabilityStatus('stay-1', '', '', reservations, 1000, '2026-10-02'), {
    status: 'occupied', availableFrom: '2026-10-05'
  });
  assert.deepEqual(getAvailabilityStatus('stay-1', '2026-10-12', '2026-10-13', reservations, 1000), {
    status: 'occupied', availableFrom: '2026-10-14'
  });
  assert.deepEqual(getAvailabilityStatus('stay-1', '2026-10-15', '2026-10-16', reservations, 1000), {
    status: 'available', availableFrom: null
  });
  assert.deepEqual(getAvailabilityStatus('stay-1', '2026-10-15', '', reservations, 1000), {
    status: 'choose-dates', availableFrom: null
  });
});

test('creates one availability key per occupied night and excludes checkout day', () => {
  assert.deepEqual(getStayDateKeys('2026-10-11', '2026-10-14'), [
    '2026-10-11', '2026-10-12', '2026-10-13'
  ]);
  assert.deepEqual(getStayDateKeys('2026-10-31', '2026-11-02'), [
    '2026-10-31', '2026-11-01'
  ]);
  assert.deepEqual(getStayDateKeys('2026-10-14', '2026-10-14'), []);
});

test('groups shared occupied nights into contiguous property date ranges', () => {
  assert.deepEqual(getOccupiedNightRanges('stay-1', {
    '2026-10-11': true,
    '2026-10-12': true,
    '2026-10-14': true,
    'invalid': true,
    '2026-10-15': false
  }), [
    { propId: 'stay-1', checkin: '2026-10-11', checkout: '2026-10-13', status: 'Confirmed' },
    { propId: 'stay-1', checkin: '2026-10-14', checkout: '2026-10-15', status: 'Confirmed' }
  ]);
});

test('host lifecycle gates payment review, check-in, and check-out by status and date', () => {
  assert.deepEqual(getHostBookingNextStep({ status: 'Pending verification', txnId: 'UPI-1' }), {
    action: 'Confirmed', label: 'Confirm booking'
  });
  assert.equal(getHostBookingNextStep({ status: 'Pending verification', txnId: '' }).action, null);
  assert.equal(getHostBookingNextStep({ status: 'Confirmed', checkin: '2026-10-11', checkout: '2026-10-13' }, '2026-10-10').action, null);
  assert.equal(getHostBookingNextStep({ status: 'Confirmed', checkin: '2026-10-11', checkout: '2026-10-13' }, '2026-10-11').action, 'Checked in');
  assert.equal(getHostBookingNextStep({ status: 'Checked in', checkout: '2026-10-13' }, '2026-10-12').action, null);
  assert.equal(getHostBookingNextStep({ status: 'Checked in', checkout: '2026-10-13' }, '2026-10-13').action, 'Completed');
});
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Set VITE_FIREBASE_PROJECT_ID in your local .env file.');

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const applyChanges = process.argv.includes('--apply');
const maximumStayNights = 365;

function getNightKeys(checkin, checkout) {
  if (typeof checkin !== 'string' || typeof checkout !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(checkin)
    || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) return null;
  const start = new Date(`${checkin}T00:00:00.000Z`);
  const end = new Date(`${checkout}T00:00:00.000Z`);
  if (start.toISOString().slice(0, 10) !== checkin || end.toISOString().slice(0, 10) !== checkout) return null;
  const nights = (end.getTime() - start.getTime()) / 86400000;
  if (!Number.isInteger(nights) || nights < 1 || nights > maximumStayNights) return null;
  return Array.from({ length: nights }, (_, offset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}

async function migrateConfirmedAvailability() {
  const snapshot = await db.collection('bookings').where('status', '==', 'Confirmed').get();
  const plans = [];
  let invalidBookings = 0;

  for (const bookingDoc of snapshot.docs) {
    const booking = bookingDoc.data();
    const nightKeys = getNightKeys(booking.checkin, booking.checkout);
    if (!booking.propId || !nightKeys) {
      invalidBookings += 1;
      continue;
    }
    const property = await db.collection('properties').doc(booking.propId).get();
    if (!property.exists || property.data().isPublic !== true) {
      invalidBookings += 1;
      continue;
    }
    plans.push({ bookingId: bookingDoc.id, propId: booking.propId, nightKeys });
  }

  const claims = plans.flatMap(plan => plan.nightKeys.map(date => ({
    ...plan,
    date,
    ref: db.collection('properties').doc(plan.propId).collection('availability').doc(date)
  })));
  const conflictingBookingIds = new Set();
  const plannedOwnerByPath = new Map();
  claims.forEach(claim => {
    const previousOwner = plannedOwnerByPath.get(claim.ref.path);
    if (previousOwner && previousOwner !== claim.bookingId) {
      conflictingBookingIds.add(previousOwner);
      conflictingBookingIds.add(claim.bookingId);
    } else {
      plannedOwnerByPath.set(claim.ref.path, claim.bookingId);
    }
  });

  const existingByPath = new Map();
  for (let offset = 0; offset < claims.length; offset += 400) {
    const existingDocs = await db.getAll(...claims.slice(offset, offset + 400).map(claim => claim.ref));
    existingDocs.forEach(document => {
      if (document.exists) existingByPath.set(document.ref.path, document.data());
    });
  }
  claims.forEach(claim => {
    const existing = existingByPath.get(claim.ref.path);
    if (existing && existing.bookingId !== claim.bookingId) conflictingBookingIds.add(claim.bookingId);
  });

  const safeBookingIds = new Set(plans
    .filter(plan => !conflictingBookingIds.has(plan.bookingId))
    .map(plan => plan.bookingId));
  const safeClaims = claims.filter(claim => safeBookingIds.has(claim.bookingId)
    && !existingByPath.has(claim.ref.path));
  console.log(`Found ${snapshot.size} confirmed booking(s), ${claims.length} occupied night(s), and ${safeClaims.length} missing lock(s).`);
  console.log(`${invalidBookings} booking(s) have invalid dates/listings; ${conflictingBookingIds.size} booking(s) overlap and need manual review.`);

  if (!applyChanges) {
    console.log('Dry run only. Re-run with --apply after reviewing these counts.');
    return;
  }

  for (let offset = 0; offset < safeClaims.length; offset += 400) {
    const batch = db.batch();
    safeClaims.slice(offset, offset + 400).forEach(claim => {
      batch.set(claim.ref, {
        bookingId: claim.bookingId,
        date: claim.date,
        isPublic: true,
        occupied: true,
        createdAt: new Date().toISOString()
      });
    });
    await batch.commit();
  }

  console.log(`Created ${safeClaims.length} availability lock(s). Skipped bookings require manual review.`);
}

migrateConfirmedAvailability().catch(error => {
  console.error('Confirmed booking availability migration failed:', error.message);
  process.exitCode = 1;
});

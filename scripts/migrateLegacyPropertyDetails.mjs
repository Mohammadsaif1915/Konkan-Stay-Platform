import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('Set VITE_FIREBASE_PROJECT_ID in your local .env file.');
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const privateFields = ['hostName', 'hostPhone', 'upiId', 'bankAcc', 'bankIfsc', 'qrCode'];
const blockedFields = ['aadhar', 'pan'];
const publicFields = new Set([
  'title', 'location', 'type', 'price', 'guests', 'description', 'hostEmail',
  'images', 'image', 'amenities', 'lat', 'lng', 'createdAt', 'isPublic',
  ...privateFields
]);
const applyChanges = process.argv.includes('--apply');

async function migrateLegacyDetails() {
  const snapshot = await db.collection('properties').get();
  const entries = snapshot.docs.map(propertyDoc => {
    const data = propertyDoc.data();
    const fieldsToMove = Object.fromEntries(
      privateFields
        .filter(field => Object.hasOwn(data, field))
        .map(field => [field, data[field]])
    );
    const hasBlockedFields = blockedFields.some(field => Object.hasOwn(data, field));
    const unknownFields = Object.keys(data).filter(field => !publicFields.has(field));

    return { propertyDoc, data, fieldsToMove, hasBlockedFields, unknownFields };
  }).filter(({ data, fieldsToMove, hasBlockedFields, unknownFields }) =>
    data.isPublic !== true || Object.keys(fieldsToMove).length > 0 || hasBlockedFields || unknownFields.length > 0
  );
  const safeEntries = entries.filter(entry => !entry.hasBlockedFields && entry.unknownFields.length === 0);
  const heldEntries = entries.length - safeEntries.length;

  console.log(`Found ${entries.length} listing(s) needing the public marker or private-field migration.`);
  console.log(`${safeEntries.length} listing(s) are safe to publish; ${heldEntries} will remain unpublished for manual review.`);
  if (!applyChanges) {
    console.log('Dry run only. Re-run with --apply to migrate these records.');
    return;
  }

  for (let offset = 0; offset < entries.length; offset += 200) {
    const batch = db.batch();
    entries.slice(offset, offset + 200).forEach(({ propertyDoc, data, fieldsToMove, hasBlockedFields, unknownFields }) => {
      if (hasBlockedFields || unknownFields.length > 0) {
        batch.update(propertyDoc.ref, { isPublic: false });
        return;
      }

      if (Object.keys(fieldsToMove).length > 0) {
        const privateDoc = db.collection('propertyPrivateDetails').doc(propertyDoc.id);
        batch.set(privateDoc, { hostEmail: data.hostEmail || '', ...fieldsToMove }, { merge: true });
      }

      const updates = Object.fromEntries(
        Object.keys(fieldsToMove).map(field => [field, FieldValue.delete()])
      );
      updates.isPublic = true;
      batch.update(propertyDoc.ref, updates);
    });
    await batch.commit();
  }

  console.log(`Reviewed ${entries.length} listing(s); ${safeEntries.length} were published and ${heldEntries} remain unpublished.`);
}

migrateLegacyDetails().catch(error => {
  console.error('Property data migration failed:', error.message);
  process.exitCode = 1;
});

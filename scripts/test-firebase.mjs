import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseConfig from './scripts/firebaseConfig.mjs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirebase() {
  try {
    console.log("Firebase App initialized:", app.name);
    
    // Test Firestore connection
    console.log("Testing public property read...");
    const querySnapshot = await getDocs(collection(db, "properties"));
    console.log("Success! Properties found:", querySnapshot.size);
    
    console.log("All verifications passed!");
    process.exit(0);
  } catch (err) {
    console.error("Firebase Test Error:", err);
    process.exit(1);
  }
}

testFirebase();

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, setDoc, doc } from "firebase/firestore";
import firebaseConfig from './scripts/firebaseConfig.mjs';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createMira() {
  const email = "mira@konkanstay.com";
  const password = "Password123";

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      fullname: "Mira Deshmukh",
      email: email,
      userType: "host",
      createdAt: new Date().toISOString()
    });

    console.log("Successfully created Mira Deshmukh.");
    console.log("Email:", email);
    console.log("Password:", password);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
        console.log("Email already in use, Mira Deshmukh already created!");
        console.log("Email:", email);
        console.log("Password:", password);
    } else {
        console.error("Error creating user:", error);
    }
  }
  process.exit(0);
}

createMira();

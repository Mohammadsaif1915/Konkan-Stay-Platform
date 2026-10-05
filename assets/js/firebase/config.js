import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDUq9gOr3g0ldsD3eU7rfa0VgZbw9-pRdI",
  authDomain: "konkan-stay-platform.firebaseapp.com",
  projectId: "konkan-stay-platform",
  storageBucket: "konkan-stay-platform.firebasestorage.app",
  messagingSenderId: "179745042147",
  appId: "1:179745042147:web:f1c3cfeda8bb49ca10dfd6"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, doc, getDoc } from "firebase/firestore";
import firebaseConfig from './scripts/firebaseConfig.mjs';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function seedData() {
  const email = process.env.SEEDER_EMAIL;
  const pass = process.env.SEEDER_PASSWORD;
  if (!email || !pass) {
    throw new Error('Set SEEDER_EMAIL and SEEDER_PASSWORD in your local .env file.');
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const profile = await getDoc(doc(db, "users", cred.user.uid));
    if (!profile.exists() || profile.data().userType !== "host") {
      throw new Error("The seeder account must already have a host profile.");
    }
    console.log("Signed in as host:", cred.user.uid);
  } catch (e) {
    console.error("Failed to create user:", e);
    process.exit(1);
  }

  const locations = ["Alibaug", "Kashid", "Murud", "Dapoli", "Malvan", "Tarkarli"];
  const types = ["Villa", "Beach House", "Resort", "Farmhouse", "Bungalow", "Cottage", "Homestay"];
  const imagePool = [
    "../assets/images/destinations/alibaug.avif",
    "../assets/images/destinations/dapoli.avif",
    "../assets/images/destinations/kashid.avif",
    "../assets/images/destinations/malvan.avif",
    "../assets/images/destinations/murud.jpg",
    "../assets/images/destinations/tarkarli.webp"
  ];
  
  const amenitiesPool = ["WiFi", "Pool", "Beach Access", "AC", "Kitchen", "BBQ Grill", "Free Parking", "Sea View", "Pet Friendly"];

  console.log("Starting to insert 100 properties...");
  for (let i = 1; i <= 100; i++) {
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const img = imagePool[Math.floor(Math.random() * imagePool.length)];
    const guests = Math.floor(Math.random() * 8) + 2; // 2 to 9 guests
    const price = Math.floor(Math.random() * 15000) + 1500;
    
    // Pick 3-4 random amenities
    const shuffled = [...amenitiesPool].sort(() => 0.5 - Math.random());
    const amenities = shuffled.slice(0, Math.floor(Math.random() * 2) + 3);

    const prop = {
      title: `Stunning ${type} in ${loc} - Seaview Escapes`,
      location: loc,
      type: type,
      price: price,
      guests: guests,
      images: [img], // Using relative path matching how other images are loaded
      amenities: amenities,
      description: `Experience the best of Konkan coast at this beautiful ${type} located right in the heart of ${loc}. Features premium amenities, great local cuisine options nearby, and direct access to the beach. Perfect for families or groups.`,
      hostEmail: email,
      isPublic: true,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "properties"), prop);
      if (i % 25 === 0) console.log(`Inserted ${i} properties...`);
    } catch (err) {
      console.error(`Failed on property ${i}:`, err.message);
    }
  }

  console.log("Done seeding 100 properties! You can now browse them in search.html");
  process.exit(0);
}

seedData();

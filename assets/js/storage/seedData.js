/**
 * Seed data for KonkanStay Platform localStorage database.
 * Provides authentic, rich properties across Konkan regions and demo accounts.
 */

export const SEED_HOST_EMAIL = 'mira@konkanstay.com';

export const SEED_USERS = [
  {
    uid: 'host-mira-1',
    email: 'mira@konkanstay.com',
    password: 'Password123',
    userType: 'host',
    fullname: 'Mira Deshmukh',
    username: 'mira_host',
    phone: '+91 98201 12345',
    surveyNo: 'MH-ALB-2024-8841',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    uid: 'cust-rohit-1',
    email: 'rohit@example.com',
    password: 'Password123',
    userType: 'customer',
    fullname: 'Rohit Sharma',
    username: 'rohit_sharma',
    phone: '+91 98765 43210',
    createdAt: '2026-01-02T00:00:00.000Z'
  }
];

export const SEED_PROPERTIES = [
  {
    id: 'hc-prop-alibaug-villa',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Azure Cliffs Villa',
    location: 'Alibaug',
    type: 'Villa',
    price: 8500,
    guests: 8,
    bedrooms: 4,
    description: 'A stunning sea-facing villa perched on the cliffs of Alibaug. Wake up to breathtaking ocean views, enjoy private beach access, and unwind in the infinity pool. Just 2 hours from Mumbai — your perfect coastal escape.',
    amenities: ['Pool', 'Beach Access', 'Sea View', 'WiFi', 'AC', 'Kitchen', 'Free Parking'],
    images: ['../../assets/images/stays/sea-view-villa.jpg'],
    image: '../../assets/images/stays/sea-view-villa.jpg',
    lat: 18.648,
    lng: 72.872,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'hc-prop-kashid-beach',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Shoreline Beach House',
    location: 'Kashid',
    type: 'Beach House',
    price: 6200,
    guests: 6,
    bedrooms: 3,
    description: 'Step directly onto the famous white sands of Kashid from this beautiful beach house. Designed with local Konkan aesthetics and modern comforts — ideal for a family holiday or a friends getaway.',
    amenities: ['Beach Access', 'Sea View', 'WiFi', 'BBQ Grill', 'Free Parking', 'Hot Water'],
    images: ['../../assets/images/stay-types/beach-houses.jpg'],
    image: '../../assets/images/stay-types/beach-houses.jpg',
    lat: 18.305,
    lng: 72.967,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-12T00:00:00.000Z'
  },
  {
    id: 'hc-prop-tarkarli-cottage',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Coral Cove Cottage',
    location: 'Tarkarli',
    type: 'Cottage',
    price: 4800,
    guests: 4,
    bedrooms: 2,
    description: "A charming cottage nestled among coconut palms, 5 minutes from Tarkarli's pristine beach. Perfect for couples or a small family. Snorkeling and dolphin spotting tours available nearby.",
    amenities: ['Beach Access', 'WiFi', 'Kitchen', 'Sea View', 'Caretaker'],
    images: ['../../assets/images/stays/coastal-escape.jpg'],
    image: '../../assets/images/stays/coastal-escape.jpg',
    lat: 16.020,
    lng: 73.461,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-15T00:00:00.000Z'
  },
  {
    id: 'hc-prop-dapoli-farmhouse',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Mango Grove Farmhouse',
    location: 'Dapoli',
    type: 'Farmhouse',
    price: 9800,
    guests: 14,
    bedrooms: 6,
    description: 'A sprawling farmhouse surrounded by mango orchards in lush Dapoli. Perfect for large family reunions, corporate retreats, or celebrations. Bonfire area, spacious lawns, and a fully equipped kitchen.',
    amenities: ['Kitchen', 'BBQ Grill', 'Free Parking', 'Pet Friendly', 'WiFi', 'Bonfire', 'Caretaker'],
    images: ['../../assets/images/stays/konkan-garden-retreat.jpg'],
    image: '../../assets/images/stays/konkan-garden-retreat.jpg',
    lat: 17.757,
    lng: 73.189,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-18T00:00:00.000Z'
  },
  {
    id: 'hc-prop-malvan-villa',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Malvan Heritage Villa',
    location: 'Malvan',
    type: 'Villa',
    price: 7200,
    guests: 10,
    bedrooms: 5,
    description: 'An elegant heritage villa with Indo-Portuguese architecture in the heart of Malvan. Minutes from Sindhudurg Fort, local fish markets, and the famous Malvan seafood cuisine. Authentic Konkan experience guaranteed.',
    amenities: ['Pool', 'AC', 'Kitchen', 'Free Parking', 'WiFi', 'Caretaker', 'Hot Water'],
    images: ['../../assets/images/stay-types/villas.jpg'],
    image: '../../assets/images/stay-types/villas.jpg',
    lat: 16.060,
    lng: 73.471,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-20T00:00:00.000Z'
  },
  {
    id: 'hc-prop-murud-bungalow',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Fort View Bungalow',
    location: 'Murud',
    type: 'Bungalow',
    price: 5500,
    guests: 6,
    bedrooms: 3,
    description: 'Wake up to iconic views of Janjira Fort from this beautifully restored colonial bungalow. Peaceful, spacious, and steeped in history — ideal for history lovers and beach enthusiasts alike.',
    amenities: ['Sea View', 'Beach Access', 'WiFi', 'Kitchen', 'Free Parking', 'Hot Water'],
    images: ['../../assets/images/stay-types/bunglows.jpg'],
    image: '../../assets/images/stay-types/bunglows.jpg',
    lat: 18.324,
    lng: 72.960,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-22T00:00:00.000Z'
  },
  {
    id: 'prop-coconut-grove-bungalow',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Coconut Grove Bungalow',
    location: 'Alibaug',
    type: 'Bungalow',
    price: 4200,
    guests: 5,
    bedrooms: 2,
    images: ['../../assets/images/stay-types/bunglows.jpg'],
    image: '../../assets/images/stay-types/bunglows.jpg',
    description: 'A cozy bungalow nestled under shaded coconut palms. Great for weekend getaways with fresh home-cooked Malvani meals on request.',
    amenities: ['WiFi', 'Kitchen', 'Free Parking', 'Hot Water'],
    lat: 18.655,
    lng: 72.885,
    isPublic: true,
    createdAt: '2026-01-25T00:00:00.000Z'
  },
  {
    id: 'prop-cove-for-two',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Cove for Two Cottage',
    location: 'Kashid',
    type: 'Cottage',
    price: 2800,
    guests: 2,
    bedrooms: 1,
    images: ['../../assets/images/stay-types/cottages.jpg'],
    image: '../../assets/images/stay-types/cottages.jpg',
    description: 'An intimate sea-breeze cottage for two, steps away from the tranquil coast. Ideal for romantic retreats and peaceful coastal walks.',
    amenities: ['WiFi', 'Beach Access', 'AC'],
    lat: 18.295,
    lng: 72.970,
    isPublic: true,
    createdAt: '2026-01-26T00:00:00.000Z'
  },
  {
    id: 'prop-konkan-holiday-home',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Konkan Holiday Home',
    location: 'Dapoli',
    type: 'Holiday Home',
    price: 9200,
    guests: 12,
    bedrooms: 5,
    images: ['../../assets/images/stay-types/holiday-homes.jpg'],
    image: '../../assets/images/stay-types/holiday-homes.jpg',
    description: 'A spacious estate surrounded by betel nut groves. Perfect for family reunions and festive weekend celebrations.',
    amenities: ['Pool', 'Kitchen', 'BBQ Grill', 'Free Parking', 'WiFi'],
    lat: 17.760,
    lng: 73.175,
    isPublic: true,
    createdAt: '2026-01-28T00:00:00.000Z'
  },
  {
    id: 'prop-kashid-coast-resort',
    hostEmail: SEED_HOST_EMAIL,
    title: 'Kashid Coast Resort Suite',
    location: 'Kashid',
    type: 'Resort',
    price: 4700,
    guests: 3,
    bedrooms: 1,
    images: ['../../assets/images/destinations/kashid.avif'],
    image: '../../assets/images/destinations/kashid.avif',
    description: "A premium resort suite on Kashid's famous golden shoreline. Includes breakfast overlooking the waves.",
    amenities: ['Pool', 'AC', 'Beach Access', 'WiFi'],
    lat: 18.310,
    lng: 72.962,
    isPublic: true,
    createdAt: '2026-01-30T00:00:00.000Z'
  }
];

export const SEED_PRIVATE_DETAILS = {
  'hc-prop-alibaug-villa': {
    hostEmail: SEED_HOST_EMAIL,
    hostName: 'Mira Deshmukh',
    hostPhone: '+91 98201 12345',
    upiId: 'mira@okhdfcbank',
    bankAcc: '918237461928',
    bankIfsc: 'HDFC0001234'
  },
  'hc-prop-kashid-beach': {
    hostEmail: SEED_HOST_EMAIL,
    hostName: 'Mira Deshmukh',
    hostPhone: '+91 98201 12345',
    upiId: 'mira@okhdfcbank',
    bankAcc: '918237461928',
    bankIfsc: 'HDFC0001234'
  },
  'hc-prop-tarkarli-cottage': {
    hostEmail: SEED_HOST_EMAIL,
    hostName: 'Mira Deshmukh',
    hostPhone: '+91 98201 12345',
    upiId: 'mira@okhdfcbank',
    bankAcc: '918237461928',
    bankIfsc: 'HDFC0001234'
  },
  'hc-prop-dapoli-farmhouse': {
    hostEmail: SEED_HOST_EMAIL,
    hostName: 'Mira Deshmukh',
    hostPhone: '+91 98201 12345',
    upiId: 'mira@okhdfcbank',
    bankAcc: '918237461928',
    bankIfsc: 'HDFC0001234'
  },
  'hc-prop-malvan-villa': {
    hostEmail: SEED_HOST_EMAIL,
    hostName: 'Mira Deshmukh',
    hostPhone: '+91 98201 12345',
    upiId: 'mira@okhdfcbank',
    bankAcc: '918237461928',
    bankIfsc: 'HDFC0001234'
  },
  'hc-prop-murud-bungalow': {
    hostEmail: SEED_HOST_EMAIL,
    hostName: 'Mira Deshmukh',
    hostPhone: '+91 98201 12345',
    upiId: 'mira@okhdfcbank',
    bankAcc: '918237461928',
    bankIfsc: 'HDFC0001234'
  }
};

export const SEED_BOOKINGS = [
  {
    id: 'KS-RES-7782',
    propId: 'hc-prop-alibaug-villa',
    propTitle: 'Azure Cliffs Villa',
    propLocation: 'Alibaug',
    hostEmail: SEED_HOST_EMAIL,
    customerEmail: 'rohit@example.com',
    customerName: 'Rohit Sharma',
    customerMobile: '+91 98765 43210',
    checkin: '2026-11-10',
    checkout: '2026-11-13',
    guests: 4,
    nights: 3,
    totalPrice: 25500,
    purpose: 'Vacation',
    specialRequest: 'Late check-in around 6 PM',
    txnId: 'UPI-ALB-8831924',
    status: 'Confirmed',
    createdAt: '2026-02-01T10:00:00.000Z'
  },
  {
    id: 'KS-RES-9104',
    propId: 'hc-prop-kashid-beach',
    propTitle: 'Shoreline Beach House',
    propLocation: 'Kashid',
    hostEmail: SEED_HOST_EMAIL,
    customerEmail: 'rohit@example.com',
    customerName: 'Rohit Sharma',
    customerMobile: '+91 98765 43210',
    checkin: '2026-12-05',
    checkout: '2026-12-07',
    guests: 2,
    nights: 2,
    totalPrice: 12400,
    purpose: 'Weekend Getaway',
    specialRequest: '',
    txnId: 'UPI-KSH-992147',
    status: 'Pending verification',
    createdAt: '2026-02-15T14:30:00.000Z'
  }
];

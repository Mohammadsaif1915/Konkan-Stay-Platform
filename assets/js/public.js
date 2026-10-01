import { getProperties, getPropertyOccupiedNights } from './firebase/firestoreService.js';
import { getUserProfile, subscribeToAuthChanges } from './firebase/authService.js';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from './firebase/config.js';
import { calculateStayTotal, escapeHtml, getAvailabilityStatus, getLocalDateString, getOccupiedNightRanges, getStayNights, isPropertyAvailable } from './bookingUtils.mjs';
import { printReservationConfirmation } from './bookingConfirmation.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── State ─────────────────────────────────────────────────────────────────
  let allProperties    = [];
  let currentUser      = null;
  let currentProfile   = null;
  let selectedProp     = null;
  let requestedPropertyId = '';
  let activeAmenities  = new Set();
  const liveAvailability = new Map();
  const liveAvailabilityRequests = new Map();
  const DEMO_BOOKINGS_KEY = 'konkanstay-demo-bookings-v1';
  const DEMO_HOLDS_KEY = 'konkanstay-demo-holds-v1';
  const DEMO_HOLD_DURATION = 10 * 60 * 1000;
  const demoProperties = [
    {
      id: 'demo-cove-for-two', title: 'Cove for Two Cottage', location: 'Kashid', type: 'Cottage',
      price: 2800, guests: 2, images: ['../assets/images/stay-types/cottages.jpg'],
      description: 'An intimate local sample stay for two, included to demonstrate the booking experience.',
      amenities: ['WiFi', 'Beach Access', 'AC']
    },
    {
      id: 'demo-coconut-grove-bungalow', title: 'Coconut Grove Bungalow', location: 'Alibaug', type: 'Bungalow',
      price: 4200, guests: 5, images: ['../assets/images/stay-types/bunglows.jpg'],
      description: 'A local sample bungalow for a small family or friends travelling together.',
      amenities: ['WiFi', 'Kitchen', 'Free Parking']
    },
    {
      id: 'demo-seaview-family-villa', title: 'Seaview Family Villa', location: 'Malvan', type: 'Villa',
      price: 7800, guests: 8, images: ['../assets/images/stays/sea-view-villa.jpg'],
      description: 'A local sample villa with room for a larger family group.',
      amenities: ['WiFi', 'Pool', 'Sea View', 'AC']
    },
    {
      id: 'demo-garden-farmhouse', title: 'Garden Courtyard Farmhouse', location: 'Dapoli', type: 'Farmhouse',
      price: 6400, guests: 10, images: ['../assets/images/stays/konkan-garden-retreat.jpg'],
      description: 'A local sample farmhouse for a large family or group stay.',
      amenities: ['Kitchen', 'BBQ Grill', 'Free Parking', 'Pet Friendly']
    },
    {
      id: 'demo-tarkarli-beach-house', title: 'Tarkarli Beach House', location: 'Tarkarli', type: 'Beach House',
      price: 5600, guests: 6, images: ['../assets/images/stay-types/beach-houses.jpg'],
      description: 'A local sample beach house with space for a family-sized group.',
      amenities: ['Beach Access', 'Sea View', 'WiFi']
    },
    {
      id: 'demo-murud-heritage-cottage', title: 'Murud Heritage Cottage', location: 'Murud', type: 'Cottage',
      price: 3900, guests: 4, images: ['../assets/images/destinations/murud.jpg'],
      description: 'A local sample cottage for a couple or small family.',
      amenities: ['WiFi', 'Kitchen', 'Free Parking']
    },
    {
      id: 'demo-konkan-holiday-home', title: 'Konkan Holiday Home', location: 'Dapoli', type: 'Holiday Home',
      price: 9200, guests: 12, images: ['../assets/images/stay-types/holiday-homes.jpg'],
      description: 'A local sample holiday home with capacity for a large family group.',
      amenities: ['Pool', 'Kitchen', 'BBQ Grill', 'Free Parking']
    },
    {
      id: 'demo-kashid-coast-resort', title: 'Kashid Coast Resort Suite', location: 'Kashid', type: 'Resort',
      price: 4700, guests: 3, images: ['../assets/images/destinations/kashid.jpg'],
      description: 'A local sample resort suite for a couple or small family.',
      amenities: ['Pool', 'AC', 'Beach Access']
    }
  ].map(property => ({ ...property, hostEmail: '', isDemo: true }));

  const grid       = document.getElementById('prop-grid');
  const countEl    = document.getElementById('results-number');

  // ── Auth listener ─────────────────────────────────────────────────────────
  subscribeToAuthChanges(async user => {
    currentUser = user;
    currentProfile = null;
    if (user) {
      try { currentProfile = await getUserProfile(user.uid); }
      catch (error) { console.error('[KonkanStay] Could not load the signed-in profile:', error); }
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const img = (prop) =>
    (prop.images?.[0] || prop.image || '../assets/images/destinations/alibaug.avif')
      .replace(/^\.\.\//, '../');

  const amenityIcon = (a) => {
    const map = { WiFi:'📶', Pool:'🏊', 'Beach Access':'🏖️', AC:'❄️',
      Kitchen:'🍳', 'BBQ Grill':'🔥', 'Sea View':'🌊', 'Pet Friendly':'🐾',
      'Free Parking':'🚗' };
    return map[a] || '✓';
  };

  function getCardAvailability(property, reservations) {
    const checkin = document.getElementById('search-checkin')?.value || '';
    const checkout = document.getElementById('search-checkout')?.value || '';
    let propertyReservations = reservations;
    if (!property.isDemo) {
      if (!liveAvailability.has(property.id)) {
        void loadPropertyAvailability(property.id);
        return { kind: 'unknown', label: 'Checking shared calendar…' };
      }
      const occupiedNights = liveAvailability.get(property.id);
      if (occupiedNights === null) return { kind: 'unknown', label: 'Shared calendar unavailable' };
      propertyReservations = getOccupiedNightRanges(property.id, occupiedNights);
    }
    const result = getAvailabilityStatus(property.id, checkin, checkout, propertyReservations);
    const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short'
    });

    if (result.status === 'choose-dates') return { kind: 'unknown', label: 'Choose both dates to check' };
    if (result.status === 'occupied') return {
      kind: 'occupied',
      label: checkin && checkout
        ? `Occupied for these dates · free ${formatDate(result.availableFrom)}`
        : `Occupied · free ${formatDate(result.availableFrom)}`
    };
    if (checkin && checkout) return { kind: 'available', label: 'Available for selected dates' };
    return {
      kind: 'available',
      label: result.bookedFrom
        ? `Available now · next booked ${formatDate(result.bookedFrom)}`
        : property.isDemo ? 'Available now · demo calendar' : 'Available now'
    };
  }

  async function loadPropertyAvailability(propertyId, refresh = false) {
    if (refresh) {
      const pendingRequest = liveAvailabilityRequests.get(propertyId);
      if (pendingRequest) await pendingRequest;
      liveAvailability.delete(propertyId);
    }
    if (liveAvailability.has(propertyId)) return liveAvailability.get(propertyId);
    if (liveAvailabilityRequests.has(propertyId)) return liveAvailabilityRequests.get(propertyId);

    const request = getPropertyOccupiedNights(propertyId)
      .then(occupiedNights => {
        liveAvailability.set(propertyId, occupiedNights);
        return occupiedNights;
      })
      .catch(error => {
        console.error(`[KonkanStay] Shared availability unavailable for ${propertyId}:`, error);
        liveAvailability.set(propertyId, null);
        return null;
      })
      .finally(() => {
        liveAvailabilityRequests.delete(propertyId);
        applyAndRender();
      });
    liveAvailabilityRequests.set(propertyId, request);
    return request;
  }

  function skeletons(n = 6) {
    return Array.from({length: n}, () => `
      <div class="skeleton">
        <div class="skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line medium"></div>
        </div>
      </div>`).join('');
  }

  // ── Filter & Sort ─────────────────────────────────────────────────────────
  function getFiltered() {
    const dest    = document.getElementById('search-destination')?.value || '';
    const guests  = parseInt(document.getElementById('filter-guests')?.value) || 0;
    const type    = document.getElementById('filter-type')?.value || '';
    const maxPrice = parseInt(document.getElementById('filter-price')?.value) || 99999;
    const sort    = document.getElementById('filter-sort')?.value || 'default';

    let result = allProperties.filter(p => {
      if (dest   && !p.location?.toLowerCase().includes(dest.toLowerCase())) return false;
      if (type   && p.type !== type) return false;
      if (guests && (p.guests || 0) < guests) return false;
      if (p.price > maxPrice) return false;
      if (activeAmenities.size > 0) {
        const pAmen = Array.isArray(p.amenities) ? p.amenities : [];
        for (const a of activeAmenities) {
          if (!pAmen.includes(a)) return false;
        }
      }
      return true;
    });

    if (sort === 'price-asc')    result.sort((a,b) => a.price - b.price);
    if (sort === 'price-desc')   result.sort((a,b) => b.price - a.price);
    if (sort === 'guests-desc')  result.sort((a,b) => b.guests - a.guests);

    return result;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderCards(props) {
    if (!grid) return;
    if (props.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏝️</div>
          <h3>No properties found</h3>
          <p>Try adjusting your filters or searching a different destination.</p>
        </div>`;
      if (countEl) countEl.textContent = '0';
      return;
    }

    if (countEl) countEl.textContent = props.length;

    const now = Date.now();
    const demoReservations = [
      ...readDemoRecords(DEMO_BOOKINGS_KEY),
      ...readDemoRecords(DEMO_HOLDS_KEY).filter(hold => Number(hold.expiresAt) > now)
    ];

    grid.innerHTML = props.map(p => {
      const amenList = Array.isArray(p.amenities) ? p.amenities.slice(0,3) : [];
      const availability = getCardAvailability(p, demoReservations);
      return `
      <article class="prop-card" data-id="${escapeHtml(p.id)}" role="article" tabindex="0"
        aria-label="${escapeHtml(p.title)} in ${escapeHtml(p.location)}">
        <div class="prop-card-img-wrap">
          <img class="prop-card-img" src="${escapeHtml(img(p))}" alt="${escapeHtml(p.title)}" loading="lazy"
            onerror="this.src='../assets/images/destinations/alibaug.avif'" />
          <span class="prop-card-badge">${escapeHtml(p.isDemo ? 'Demo listing' : (p.type || 'Coastal Stay'))}</span>
          <button class="prop-card-wishlist" aria-label="Wishlist" data-wish="${p.id}">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
        </div>
        <div class="prop-card-body">
          <div class="prop-card-location">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ${escapeHtml(p.location || 'Konkan')}
          </div>
          <h3 class="prop-card-title">${escapeHtml(p.title)}</h3>
          <div class="prop-card-meta">
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Up to <strong style="color:#fff">${Number(p.guests) || 0}</strong> guests
            </span>
          </div>
          <div class="prop-card-availability ${availability.kind}" aria-label="Availability: ${escapeHtml(availability.label)}">
            <span class="availability-dot" aria-hidden="true"></span>
            <span>${escapeHtml(availability.label)}</span>
          </div>
          ${amenList.length ? `<div class="prop-amenities">${amenList.map(a => `<span class="prop-amenity-tag">${amenityIcon(a)} ${escapeHtml(a)}</span>`).join('')}</div>` : ''}
          <div class="prop-card-footer">
            <div class="prop-price">
              <span class="prop-price-amt">₹${(p.price||0).toLocaleString('en-IN')}</span>
              <span class="prop-price-per">per night</span>
            </div>
            <button class="btn-view btn-view-detail" data-id="${escapeHtml(p.id)}">View Details</button>
          </div>
        </div>
      </article>`;
    }).join('');

    // Attach events
    grid.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDetail(btn.dataset.id);
      });
    });
    grid.querySelectorAll('.prop-card').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.id));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(card.dataset.id); });
    });
    grid.querySelectorAll('.prop-card-wishlist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('active');
      });
    });
  }

  function applyAndRender() {
    const filtered = getFiltered();
    renderCards(filtered);
  }

  function showDemoCatalog(message) {
    allProperties = demoProperties;
    if (requestedPropertyId && !demoProperties.some(property => property.id === requestedPropertyId)) {
      requestedPropertyId = demoProperties[0].id;
    }
    let fallbackNote = document.querySelector('.demo-fallback-note');
    if (!fallbackNote) {
      fallbackNote = document.createElement('p');
      fallbackNote.className = 'demo-fallback-note';
      grid?.before(fallbackNote);
    }
    fallbackNote.textContent = message;
    applyAndRender();
  }

  // ── Load Data ─────────────────────────────────────────────────────────────
  if (grid) grid.innerHTML = skeletons(6);
  const params = new URLSearchParams(window.location.search);
  const urlDest = params.get('destination') || '';
  const urlGuests = params.get('guests') || '';
  const urlCheckin = params.get('checkin') || '';
  const urlCheckout = params.get('checkout') || '';
  requestedPropertyId = params.get('propertyId') || '';

  if (urlDest) { const field = document.getElementById('search-destination'); if (field) field.value = urlDest; }
  if (urlGuests) { const field = document.getElementById('search-guests'); if (field) field.value = urlGuests; }
  if (urlCheckin) { const field = document.getElementById('search-checkin'); if (field) field.value = urlCheckin; }
  if (urlCheckout) { const field = document.getElementById('search-checkout'); if (field) field.value = urlCheckout; }
  if (urlGuests) {
    const guestFilter = document.getElementById('filter-guests');
    if (guestFilter) {
      const guestCount = parseInt(urlGuests);
      const options = [...guestFilter.options].map(option => parseInt(option.value));
      guestFilter.value = options.filter(option => option <= guestCount).pop() || 0;
    }
  }

  try {
    allProperties = await getProperties();
    if (allProperties.length === 0) {
      showDemoCatalog('No live listings are available yet. Browse these local sample stays; calendars and payments are simulated in this browser.');
    } else {
      applyAndRender();
    }
  } catch (err) {
    console.error('[KonkanStay] Failed to load properties:', err);
    showDemoCatalog('Live listings are unavailable. Browse these local sample stays; calendars and payments are simulated in this browser.');
  }

  // ── Search bar form submit ─────────────────────────────────────────────────
  document.getElementById('search-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    // Copy search-guests value into filter-guests
    const gVal = document.getElementById('search-guests')?.value;
    if (gVal) {
      const fg = document.getElementById('filter-guests');
      const val = parseInt(gVal);
      const opts = fg ? [...fg.options].map(o => parseInt(o.value)) : [];
      const closest = opts.filter(o => o <= val).pop() || 0;
      if (fg) fg.value = closest;
    }
    applyAndRender();
  });

  // ── Sidebar filter events ──────────────────────────────────────────────────
  ['filter-type','filter-guests','filter-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyAndRender);
  });

  // Price slider
  const priceSlider  = document.getElementById('filter-price');
  const priceDisplay = document.getElementById('price-display');
  if (priceSlider) {
    const updateSlider = () => {
      const v = parseInt(priceSlider.value);
      const max = parseInt(priceSlider.max);
      const pct = ((v - parseInt(priceSlider.min)) / (max - parseInt(priceSlider.min))) * 100;
      priceSlider.style.setProperty('--pct', pct + '%');
      priceDisplay.textContent = v >= max ? 'Any' : '₹' + v.toLocaleString('en-IN');
      applyAndRender();
    };
    priceSlider.addEventListener('input', updateSlider);
    updateSlider();
  }

  // Amenity chips
  document.getElementById('amenity-chips')?.querySelectorAll('.amenity-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const a = chip.dataset.amenity;
      if (activeAmenities.has(a)) { activeAmenities.delete(a); chip.classList.remove('active'); chip.setAttribute('aria-pressed', 'false'); }
      else { activeAmenities.add(a); chip.classList.add('active'); chip.setAttribute('aria-pressed', 'true'); }
      applyAndRender();
    });
  });

  // Clear filters
  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    document.getElementById('filter-type').value  = '';
    document.getElementById('filter-guests').value = '0';
    document.getElementById('filter-sort').value   = 'default';
    document.getElementById('search-destination').value = '';
    document.getElementById('search-guests').value = '';
    if (priceSlider) { priceSlider.value = priceSlider.max; priceSlider.dispatchEvent(new Event('input')); }
    activeAmenities.clear();
    document.querySelectorAll('.amenity-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    applyAndRender();
  });

  // ── Detail Modal ───────────────────────────────────────────────────────────
  const detailModal = document.getElementById('detail-modal');

  function openDetail(id) {
    const p = allProperties.find(x => x.id === id);
    if (!p) return;
    selectedProp = p;

    document.getElementById('modal-img').src       = img(p);
    document.getElementById('modal-img').alt       = p.title;
    document.getElementById('modal-title-text').textContent = p.title;
    document.getElementById('modal-location').textContent   = p.location || 'Konkan';
    document.getElementById('modal-desc').textContent       = p.description || 'A beautiful coastal stay.';
    document.getElementById('modal-price').textContent      = '₹' + (p.price||0).toLocaleString('en-IN');

    // Meta row
    document.getElementById('modal-meta-row').innerHTML = `
      <div class="modal-meta-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span>Type: <strong>${escapeHtml(p.type || 'Coastal Stay')}</strong></span>
      </div>
      <div class="modal-meta-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <span>Up to <strong>${Number(p.guests) || 0}</strong> guests</span>
      </div>
      <div class="modal-meta-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span><strong>${escapeHtml(p.location)}</strong>, Konkan</span>
      </div>`;

    // Amenities
    const amen = Array.isArray(p.amenities) ? p.amenities : [];
    document.getElementById('modal-amenities').innerHTML = amen.length
      ? amen.map(a => `<span class="modal-amenity">${amenityIcon(a)} ${escapeHtml(a)}</span>`).join('')
      : '<span style="color:rgba(255,255,255,0.35);font-size:0.85rem;">Not specified</span>';

    detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    detailModal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.getElementById('close-detail-modal')?.addEventListener('click', closeDetail);
  detailModal?.addEventListener('click', (e) => { if (e.target === detailModal) closeDetail(); });

  // ── Browser-only booking demonstration ────────────────────────────────────
  const bookingModal = document.getElementById('booking-modal');
  const checkinInput = document.getElementById('book-checkin');
  const checkoutInput = document.getElementById('book-checkout');
  const nightsInput = document.getElementById('book-nights');
  const guestInput = document.getElementById('book-guests');
  const totalEl = document.getElementById('book-total');
  const bookAlertEl = document.getElementById('book-alert');
  const availabilityStatus = document.getElementById('booking-availability-status');
  const passwordInput = document.getElementById('booking-password');
  const captchaAnswer = document.getElementById('booking-captcha-answer');
  let currentDemoHold = null;
  let completedDemoBooking = null;
  let passwordFailures = 0;
  let expectedCaptchaAnswer = null;

  function readDemoRecords(key) {
    try {
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function writeDemoRecords(key, records) {
    try {
      localStorage.setItem(key, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }

  function clearCurrentDemoHold() {
    if (!currentDemoHold) return;
    const remaining = readDemoRecords(DEMO_HOLDS_KEY)
      .filter(hold => hold.id !== currentDemoHold.id && Number(hold.expiresAt) > Date.now());
    writeDemoRecords(DEMO_HOLDS_KEY, remaining);
    currentDemoHold = null;
    applyAndRender();
  }

  function setBookingStep(step) {
    const stepIds = {
      dates: 'booking-dates-step',
      payment: 'booking-payment-step',
      verify: 'booking-verify-step',
      confirmed: 'booking-confirmed-step'
    };
    Object.entries(stepIds).forEach(([name, id]) => {
      document.getElementById(id).hidden = name !== step;
      const progress = document.querySelector(`[data-booking-progress="${name}"]`);
      if (name === step) progress.setAttribute('aria-current', 'step');
      else progress.removeAttribute('aria-current');
    });
  }

  function showAvailability(message, type = '') {
    availabilityStatus.textContent = message;
    availabilityStatus.className = `demo-status${type ? ` ${type}` : ''}`;
  }

  function refreshDemoCaptcha() {
    const firstNumber = Math.floor(Math.random() * 6) + 2;
    const secondNumber = Math.floor(Math.random() * 7) + 1;
    expectedCaptchaAnswer = String(firstNumber + secondNumber);
    document.getElementById('booking-captcha-prompt').textContent =
      `Demo CAPTCHA: what is ${firstNumber} + ${secondNumber}?`;
    captchaAnswer.value = '';
  }

  function resetDemoBooking() {
    clearCurrentDemoHold();
    completedDemoBooking = null;
    passwordFailures = 0;
    passwordInput.value = '';
    document.getElementById('booking-username').value = '';
    document.getElementById('booking-attempts').textContent = 'Password attempts remaining: 3';
    bookAlertEl.className = 'book-alert';
    bookAlertEl.textContent = '';
    showAvailability('Choose your dates to check this browser\'s demo calendar.');
    setBookingStep('dates');
  }

  function calcTotal() {
    const nights = selectedProp ? getStayNights(checkinInput?.value, checkoutInput?.value) : null;
    const total = selectedProp
      ? calculateStayTotal(Number(selectedProp.price), checkinInput?.value, checkoutInput?.value)
      : null;
    if (nights !== null && total !== null) {
      nightsInput.value = `${nights} night${nights > 1 ? 's' : ''}`;
      totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
      document.getElementById('demo-payment-total').textContent = totalEl.textContent;
    } else {
      nightsInput.value = '';
      totalEl.textContent = '₹—';
      document.getElementById('demo-payment-total').textContent = '₹—';
    }
  }

  checkinInput?.addEventListener('change', () => {
    if (checkinInput.value) checkoutInput.min = checkinInput.value;
    calcTotal();
  });
  checkoutInput?.addEventListener('change', calcTotal);
  guestInput?.addEventListener('change', calcTotal);
  ['search-checkin', 'search-checkout'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyAndRender);
  });

  document.getElementById('btn-open-booking')?.addEventListener('click', async () => {
    closeDetail();
    if (!selectedProp) return;
    resetDemoBooking();
    document.getElementById('book-prop-name').textContent = `${selectedProp.title} — ${selectedProp.location}`;

    const checkin = document.getElementById('search-checkin')?.value;
    const checkout = document.getElementById('search-checkout')?.value;
    const guests = document.getElementById('search-guests')?.value;
    if (checkin) checkinInput.value = checkin;
    if (checkout) checkoutInput.value = checkout;
    if (guests) guestInput.value = guests;
    guestInput.max = String(selectedProp.guests);
    guestInput.value = String(Math.min(Number(guestInput.value) || 1, Number(selectedProp.guests)));

    const today = getLocalDateString();
    checkinInput.min = today;
    checkoutInput.min = checkinInput.value || today;
    calcTotal();

    const authPrompt = document.getElementById('book-auth-prompt');
    const totalWrap = document.getElementById('book-total-wrap');
    if (currentUser) {
      if (!currentProfile) {
        try { currentProfile = await getUserProfile(currentUser.uid); }
        catch { currentProfile = null; }
      }
      authPrompt.style.display = 'none';
      totalWrap.style.display = 'block';
    } else {
      authPrompt.style.display = 'block';
      totalWrap.style.display = 'none';
      const loginLink = authPrompt.querySelector('a');
      if (loginLink) {
        const returnParams = new URLSearchParams({ propertyId: selectedProp.id });
        if (checkinInput.value) returnParams.set('checkin', checkinInput.value);
        if (checkoutInput.value) returnParams.set('checkout', checkoutInput.value);
        if (guestInput.value) returnParams.set('guests', guestInput.value);
        loginLink.href = `login.html?returnTo=${encodeURIComponent(`search.html?${returnParams}`)}`;
      }
    }

    bookingModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  function closeBooking() {
    clearCurrentDemoHold();
    bookingModal?.classList.remove('active');
    document.body.style.overflow = '';
  }
  document.getElementById('close-booking-modal')?.addEventListener('click', closeBooking);
  document.getElementById('btn-close-demo-confirmation')?.addEventListener('click', closeBooking);
  bookingModal?.addEventListener('click', event => {
    if (event.target === bookingModal) closeBooking();
  });

  document.getElementById('btn-check-availability')?.addEventListener('click', async () => {
    if (!currentUser || !selectedProp) return;
    clearCurrentDemoHold();
    const checkin = checkinInput.value;
    const checkout = checkoutInput.value;
    const nights = getStayNights(checkin, checkout);
    const totalPrice = calculateStayTotal(Number(selectedProp.price), checkin, checkout);
    const guests = Number(guestInput.value);
    if (nights === null || totalPrice === null) {
      showAvailability('Choose a valid check-in and a later check-out date.', 'error');
      return;
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > Number(selectedProp.guests)) {
      showAvailability(`Choose between 1 and ${selectedProp.guests} guests for this stay.`, 'error');
      return;
    }

    const now = Date.now();
    const bookings = readDemoRecords(DEMO_BOOKINGS_KEY);
    const holds = readDemoRecords(DEMO_HOLDS_KEY).filter(hold => Number(hold.expiresAt) > now);
    writeDemoRecords(DEMO_HOLDS_KEY, holds);
    let reservations = [...bookings, ...holds];
    if (!selectedProp.isDemo) {
      const occupiedNights = await loadPropertyAvailability(selectedProp.id, true);
      if (occupiedNights === null) {
        showAvailability('The shared calendar could not be checked. These dates cannot be marked available.', 'error');
        return;
      }
      reservations = [...reservations, ...getOccupiedNightRanges(selectedProp.id, occupiedNights)];
    }
    if (!isPropertyAvailable(selectedProp.id, checkin, checkout, reservations, now)) {
      showAvailability('Those dates overlap an occupied night or active demo hold. Try different dates.', 'error');
      return;
    }

    const holdId = `DEMO-HOLD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const hold = {
      id: holdId,
      propId: selectedProp.id,
      checkin,
      checkout,
      status: 'Hold',
      expiresAt: now + DEMO_HOLD_DURATION
    };
    if (!writeDemoRecords(DEMO_HOLDS_KEY, [...holds, hold])) {
      showAvailability('Browser storage is unavailable, so the demo cannot hold these dates.', 'error');
      return;
    }

    currentDemoHold = hold;
    document.getElementById('demo-payment-summary').textContent = `${nights} night${nights > 1 ? 's' : ''}`;
    showAvailability('Available in this browser demo. A 10-minute local hold has started.', 'success');
    setBookingStep('payment');
  });

  function validateDemoHold() {
    if (!currentDemoHold || Number(currentDemoHold.expiresAt) <= Date.now()) {
      clearCurrentDemoHold();
      setBookingStep('dates');
      showAvailability('The 10-minute demo hold expired. Check availability again.', 'error');
      return false;
    }

    const otherHolds = readDemoRecords(DEMO_HOLDS_KEY)
      .filter(hold => hold.id !== currentDemoHold.id && Number(hold.expiresAt) > Date.now());
    const bookings = readDemoRecords(DEMO_BOOKINGS_KEY);
    if (!isPropertyAvailable(selectedProp.id, currentDemoHold.checkin, currentDemoHold.checkout,
      [...bookings, ...otherHolds], Date.now())) {
      clearCurrentDemoHold();
      setBookingStep('dates');
      showAvailability('Those dates were taken by another demo booking. Choose different dates.', 'error');
      return false;
    }
    return true;
  }

  document.getElementById('btn-demo-payment')?.addEventListener('click', () => {
    if (!validateDemoHold()) return;
    const username = currentProfile?.username || currentProfile?.fullname || 'KonkanStay member';
    document.getElementById('booking-username').value = username;
    passwordFailures = 0;
    document.getElementById('booking-attempts').textContent = 'Password attempts remaining: 3';
    refreshDemoCaptcha();
    setBookingStep('verify');
    passwordInput.focus();
  });

  document.getElementById('btn-demo-payment-fail')?.addEventListener('click', () => {
    clearCurrentDemoHold();
    setBookingStep('dates');
    showAvailability('Demo payment declined. No money was charged and the local hold was released.', 'error');
  });

  document.getElementById('btn-verify-booking')?.addEventListener('click', async event => {
    if (!currentUser || !selectedProp || !validateDemoHold()) return;
    if (captchaAnswer.value.trim() !== expectedCaptchaAnswer) {
      refreshDemoCaptcha();
      showBookAlert('Demo CAPTCHA did not match. Try the new challenge; this does not use a password attempt.', 'error');
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) {
      showBookAlert('Your Firebase sign-in session expired. Sign in again to continue.', 'error');
      return;
    }

    const password = passwordInput.value;
    passwordInput.value = '';
    if (!password) {
      showBookAlert('Enter your account password to verify this demo booking.', 'error');
      passwordInput.focus();
      return;
    }

    const verifyButton = event.currentTarget;
    verifyButton.disabled = true;
    verifyButton.textContent = 'Verifying with Firebase…';
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, password);
      await reauthenticateWithCredential(firebaseUser, credential);
      if (!validateDemoHold()) return;

      const nights = getStayNights(currentDemoHold.checkin, currentDemoHold.checkout);
      const totalPrice = calculateStayTotal(Number(selectedProp.price), currentDemoHold.checkin, currentDemoHold.checkout);
      const booking = {
        id: `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        source: 'demo',
        status: 'Demo confirmed',
        propId: selectedProp.id,
        propTitle: selectedProp.title,
        propLocation: selectedProp.location,
        customerUid: firebaseUser.uid,
        customerName: document.getElementById('booking-username').value,
        checkin: currentDemoHold.checkin,
        checkout: currentDemoHold.checkout,
        guests: Number(guestInput.value),
        nights,
        totalPrice,
        paymentMethod: document.querySelector('input[name="demo-payment-method"]:checked')?.value || 'UPI',
        createdAt: new Date().toISOString()
      };
      const savedBookings = readDemoRecords(DEMO_BOOKINGS_KEY);
      if (!writeDemoRecords(DEMO_BOOKINGS_KEY, [...savedBookings, booking])) {
        showBookAlert('Browser storage is unavailable. No demo booking was saved.', 'error');
        return;
      }

      completedDemoBooking = booking;
      clearCurrentDemoHold();
      document.getElementById('demo-confirmation-id').textContent = `Demo reference: ${booking.id}`;
      setBookingStep('confirmed');
    } catch (error) {
      if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error.code)) {
        passwordFailures += 1;
        const remaining = 3 - passwordFailures;
        document.getElementById('booking-attempts').textContent = `Password attempts remaining: ${remaining}`;
        refreshDemoCaptcha();
        if (remaining === 0) {
          clearCurrentDemoHold();
          setBookingStep('dates');
          showAvailability('Demo attempt cancelled after three incorrect passwords. The simulated payment was never charged; no refund is due.', 'error');
        } else {
          showBookAlert(`Firebase could not verify that password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 'error');
        }
      } else {
        console.error('[KonkanStay] Firebase reauthentication failed:', error);
        showBookAlert('Firebase could not verify this account right now. No demo reservation was confirmed.', 'error');
      }
    } finally {
      verifyButton.disabled = false;
      verifyButton.textContent = 'Verify and confirm demo booking';
    }
  });

  document.getElementById('btn-demo-confirmation-pdf')?.addEventListener('click', () => {
    if (completedDemoBooking) printReservationConfirmation(completedDemoBooking);
  });

  if (requestedPropertyId) {
    const requestedProperty = allProperties.find(property => property.id === requestedPropertyId);
    if (requestedProperty) openDetail(requestedProperty.id);
  }

  function showBookAlert(msg, type) {
    bookAlertEl.textContent = msg;
    bookAlertEl.className = `book-alert ${type}`;
  }

});

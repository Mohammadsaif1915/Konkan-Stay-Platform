import { subscribeToAuthChanges, getUserProfile, logoutUser } from './firebase/authService.js';
import { getProperties, getPropertiesByHost, addProperty, getBookingsByCustomer, getBookingsByHost, updateBookingStatus, getPropertyOccupiedNights } from './firebase/firestoreService.js';
import { escapeHtml } from './bookingUtils.mjs';
import { db } from './firebase/config.js';
import { renderKonkanMap } from './konkanMap.js';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { mountBookingWizard, initBookingWizard, openBookingWizard } from './bookingWizard.js';

// ── Compress image to base64 ─────────────────────────────────────────────────
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// ── HARDCODED HOST ACCOUNT & PROPERTIES ─────────────────────────────────────
// Email: mira@konkanstay.com  Password: Password123
const HARDCODED_HOST_EMAIL = 'mira@konkanstay.com';

const hardcodedProperties = [
  {
    id: 'hc-prop-alibaug-villa',
    hostEmail: HARDCODED_HOST_EMAIL,
    title: 'Azure Cliffs Villa',
    location: 'Alibaug',
    type: 'Villa',
    price: 8500,
    guests: 8,
    bedrooms: 4,
    description: 'A stunning sea-facing villa perched on the cliffs of Alibaug. Wake up to breathtaking ocean views, enjoy private beach access, and unwind in the infinity pool. Just 2 hours from Mumbai — your perfect coastal escape.',
    amenities: ['Pool', 'Beach Access', 'Sea View', 'WiFi', 'AC', 'Kitchen', 'Free Parking'],
    images: ['../assets/images/stays/sea-view-villa.jpg'],
    image: '../assets/images/stays/sea-view-villa.jpg',
    lat: 18.648, lng: 72.872,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'hc-prop-kashid-beach',
    hostEmail: HARDCODED_HOST_EMAIL,
    title: 'Shoreline Beach House',
    location: 'Kashid',
    type: 'Beach House',
    price: 6200,
    guests: 6,
    bedrooms: 3,
    description: 'Step directly onto the famous white sands of Kashid from this beautiful beach house. Designed with local Konkan aesthetics and modern comforts — ideal for a family holiday or a friends getaway.',
    amenities: ['Beach Access', 'Sea View', 'WiFi', 'BBQ Grill', 'Free Parking', 'Hot Water'],
    images: ['../assets/images/stay-types/beach-houses.jpg'],
    image: '../assets/images/stay-types/beach-houses.jpg',
    lat: 18.305, lng: 72.967,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-12T00:00:00.000Z'
  },
  {
    id: 'hc-prop-tarkarli-cottage',
    hostEmail: HARDCODED_HOST_EMAIL,
    title: 'Coral Cove Cottage',
    location: 'Tarkarli',
    type: 'Cottage',
    price: 4800,
    guests: 4,
    bedrooms: 2,
    description: 'A charming cottage nestled among coconut palms, 5 minutes from Tarkarli\'s pristine beach. Perfect for couples or a small family. Snorkeling and dolphin spotting tours available nearby.',
    amenities: ['Beach Access', 'WiFi', 'Kitchen', 'Sea View', 'Caretaker'],
    images: ['../assets/images/stays/coastal-escape.jpg'],
    image: '../assets/images/stays/coastal-escape.jpg',
    lat: 16.020, lng: 73.461,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-15T00:00:00.000Z'
  },
  {
    id: 'hc-prop-dapoli-farmhouse',
    hostEmail: HARDCODED_HOST_EMAIL,
    title: 'Mango Grove Farmhouse',
    location: 'Dapoli',
    type: 'Farmhouse',
    price: 9800,
    guests: 14,
    bedrooms: 6,
    description: 'A sprawling farmhouse surrounded by mango orchards in lush Dapoli. Perfect for large family reunions, corporate retreats, or celebrations. Bonfire area, spacious lawns, and a fully equipped kitchen.',
    amenities: ['Kitchen', 'BBQ Grill', 'Free Parking', 'Pet Friendly', 'WiFi', 'Bonfire', 'Caretaker'],
    images: ['../assets/images/stays/konkan-garden-retreat.jpg'],
    image: '../assets/images/stays/konkan-garden-retreat.jpg',
    lat: 17.757, lng: 73.189,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-18T00:00:00.000Z'
  },
  {
    id: 'hc-prop-malvan-villa',
    hostEmail: HARDCODED_HOST_EMAIL,
    title: 'Malvan Heritage Villa',
    location: 'Malvan',
    type: 'Villa',
    price: 7200,
    guests: 10,
    bedrooms: 5,
    description: 'An elegant heritage villa with Indo-Portuguese architecture in the heart of Malvan. Minutes from Sindhudurg Fort, local fish markets, and the famous Malvan seafood cuisine. Authentic Konkan experience guaranteed.',
    amenities: ['Pool', 'AC', 'Kitchen', 'Free Parking', 'WiFi', 'Caretaker', 'Hot Water'],
    images: ['../assets/images/stay-types/villas.jpg'],
    image: '../assets/images/stay-types/villas.jpg',
    lat: 16.060, lng: 73.471,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-20T00:00:00.000Z'
  },
  {
    id: 'hc-prop-murud-bungalow',
    hostEmail: HARDCODED_HOST_EMAIL,
    title: 'Fort View Bungalow',
    location: 'Murud',
    type: 'Bungalow',
    price: 5500,
    guests: 6,
    bedrooms: 3,
    description: 'Wake up to iconic views of Janjira Fort from this beautifully restored colonial bungalow. Peaceful, spacious, and steeped in history — ideal for history lovers and beach enthusiasts alike.',
    amenities: ['Sea View', 'Beach Access', 'WiFi', 'Kitchen', 'Free Parking', 'Hot Water'],
    images: ['../assets/images/stay-types/bunglows.jpg'],
    image: '../assets/images/stay-types/bunglows.jpg',
    lat: 18.324, lng: 72.960,
    isPublic: true,
    isHardcoded: true,
    createdAt: '2026-01-22T00:00:00.000Z'
  }
];

// ── Local storage key for hardcoded host availability ───────────────────────
const HC_AVAIL_KEY = 'konkanstay-hc-availability-v1';

function getHardcodedAvailability() {
  try { return JSON.parse(localStorage.getItem(HC_AVAIL_KEY) || '{}'); }
  catch { return {}; }
}

function saveHardcodedAvailability(data) {
  try { localStorage.setItem(HC_AVAIL_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

// ── Main Dashboard Logic ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let properties = [];
  let bookings = [];
  let isHardcodedHost = false;

  // ─── AUTH CHECK ──────────────────────────────────────────────────────────
  async function handleAuthChange(user) {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const profile = await getUserProfile(user.uid);
    if (!profile) console.warn('[KonkanStay] Profile unavailable.');

    const accountName = profile?.fullname || profile?.username || user.displayName || user.email?.split('@')[0] || 'Traveler';
    currentUser = {
      ...user,
      ...(profile || {}),
      fullname: accountName,
      username: profile?.username || user.email?.split('@')[0] || accountName,
      userType: profile?.userType || 'customer'
    };

    isHardcodedHost = (user.email === HARDCODED_HOST_EMAIL);

    const isHostPage = window.location.href.includes('dashboard-host');
    if (currentUser.userType === 'host' && !isHostPage) {
      window.location.href = 'dashboard-host.html'; return;
    } else if (currentUser.userType !== 'host' && isHostPage) {
      window.location.href = 'dashboard-customer.html'; return;
    }

    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay) nameDisplay.textContent = currentUser.fullname || currentUser.username;

    const avatarEl = document.getElementById('user-avatar-initials');
    if (avatarEl) {
      const name = currentUser.fullname || currentUser.username || currentUser.email || 'U';
      const parts = name.trim().split(/[\s@_.]+/);
      avatarEl.textContent = ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
    }

    await loadInitialData();
  }

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logoutUser();
    window.location.href = '../index.html';
  });

  // ─── SIDEBAR NAVIGATION ──────────────────────────────────────────────────
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  const panels = document.querySelectorAll('.dashboard-panel');

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const target = document.getElementById(e.currentTarget.getAttribute('data-target'));
      if (target) target.classList.add('active');
    });
  });

  // ─── DATA LOADING ────────────────────────────────────────────────────────
  async function loadInitialData() {
    if (currentUser.userType === 'host') {
      if (isHardcodedHost) {
        properties = hardcodedProperties;
        bookings = [];
      } else {
        properties = await getPropertiesByHost(currentUser.email);
        bookings = await getBookingsByHost(currentUser.email);
      }
      initHostLogic();
    } else {
      try {
        const liveProps = await getProperties();
        const liveIds = new Set(liveProps.map(p => p.id));
        const filteredHardcoded = hardcodedProperties.filter(p => !liveIds.has(p.id));
        properties = [...liveProps, ...filteredHardcoded];
      } catch (error) {
        properties = [...hardcodedProperties];
        console.error('[KonkanStay] Customer listings error:', error);
      }
      try { bookings = await getBookingsByCustomer(currentUser.email); }
      catch (error) { bookings = []; }
      initCustomerLogic();
    }
  }

  // ─── RENDER PROPERTIES ───────────────────────────────────────────────────
  const renderProperties = (containerId, propsToRender, isHostView = false) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (propsToRender.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">🏖️</div>
          <h3 style="color:rgba(255,255,255,0.7);font-size:1.1rem;margin-bottom:0.5rem;">No properties yet</h3>
          <p style="color:rgba(255,255,255,0.35);font-size:0.9rem;">Start by posting your first property!</p>
        </div>`;
      return;
    }

    propsToRender.forEach(prop => {
      const card = document.createElement('div');
      card.className = 'prop-card';

      const amenityHtml = (prop.amenities || []).slice(0, 3)
        .map(a => `<span style="font-size:0.7rem;background:rgba(49,130,182,0.12);border:1px solid rgba(49,130,182,0.2);color:hsl(196,80%,72%);padding:0.2rem 0.55rem;border-radius:20px;font-weight:600;">${escapeHtml(a)}</span>`)
        .join('');

      const actionHtml = isHostView
        ? `<div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
            <span style="flex:1;text-align:center;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);color:hsl(160,65%,60%);font-size:0.72rem;font-weight:700;letter-spacing:0.05em;padding:0.35rem 0.75rem;border-radius:20px;text-transform:uppercase;">✓ Active</span>
            <button class="btn btn-sm btn-outline-navy btn-avail-manage" data-prop-id="${escapeHtml(prop.id)}" data-prop-name="${escapeHtml(prop.title)}" style="flex:1;">📅 Availability</button>
           </div>`
        : `<button class="btn btn-primary btn-open-property" data-property-id="${escapeHtml(prop.id)}" style="width:100%;margin-top:0.75rem;">View &amp; Book</button>`;

      card.innerHTML = `
        <div class="prop-img-wrap" style="height:195px;position:relative;">
          <img src="${escapeHtml(prop.image || prop.images?.[0] || '../assets/images/destinations/alibaug.avif')}" 
               alt="${escapeHtml(prop.title)}" 
               onerror="this.src='../assets/images/destinations/alibaug.avif'" 
               style="width:100%;height:100%;object-fit:cover;">
          <div style="position:absolute;top:0.7rem;right:0.7rem;background:rgba(10,18,36,0.85);backdrop-filter:blur(6px);padding:0.3rem 0.7rem;border-radius:20px;font-weight:700;font-size:0.82rem;color:#fff;">₹${Number(prop.price || 0).toLocaleString('en-IN')}/night</div>
          <div style="position:absolute;top:0.7rem;left:0.7rem;background:rgba(10,18,36,0.75);backdrop-filter:blur(6px);padding:0.25rem 0.6rem;border-radius:20px;font-size:0.7rem;font-weight:600;color:rgba(255,255,255,0.8);">${escapeHtml(prop.type || 'Stay')}</div>
        </div>
        <div class="prop-details">
          <h3 class="prop-title">${escapeHtml(prop.title)}</h3>
          <p class="prop-loc">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${escapeHtml(prop.location)}, Konkan
          </p>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.75rem;">${amenityHtml}</div>
          <p class="prop-meta">Up to <strong style="color:#fff;">${Number(prop.guests) || 0}</strong> guests · ${Number(prop.bedrooms) || 0} bedrooms</p>
          ${actionHtml}
        </div>`;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-open-property').forEach(btn => {
      btn.addEventListener('click', () => window.openPropertyModal(btn.dataset.propertyId));
    });

    container.querySelectorAll('.btn-avail-manage').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector('[data-target="panel-availability"]')?.click();
        setTimeout(() => selectAvailabilityProperty(btn.dataset.propId, btn.dataset.propName), 100);
      });
    });
  };

  // ─── CUSTOMER LOGIC ──────────────────────────────────────────────────────
  function initCustomerLogic() {
    const totalPropsEl = document.getElementById('cust-total-props');
    const avgPriceEl = document.getElementById('cust-avg-price');
    if (totalPropsEl) totalPropsEl.textContent = properties.length;
    if (avgPriceEl && properties.length > 0) {
      const avg = Math.round(properties.reduce((s, p) => s + (p.price || 0), 0) / properties.length);
      avgPriceEl.textContent = `₹${avg.toLocaleString('en-IN')}`;
    }

    renderProperties('customer-prop-grid', properties);

    document.getElementById('search-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const loc = document.getElementById('filter-loc').value;
      const guests = parseInt(document.getElementById('filter-guests').value) || 0;
      let filtered = properties;
      if (loc) filtered = filtered.filter(p => p.location.toLowerCase() === loc.toLowerCase());
      if (guests) filtered = filtered.filter(p => (p.guests || 0) >= guests);
      renderProperties('customer-prop-grid', filtered);
      if (totalPropsEl) totalPropsEl.textContent = filtered.length;
      if (avgPriceEl && filtered.length > 0) {
        const avg = Math.round(filtered.reduce((s, p) => s + (p.price || 0), 0) / filtered.length);
        avgPriceEl.textContent = `₹${avg.toLocaleString('en-IN')}`;
      }
    });

    // Animated SVG map — rendered once, the first time panel-map becomes visible
    let mapInitialized = false;

    function initKonkanMap() {
      if (mapInitialized) return;
      const mapEl = document.getElementById('konkan-map');
      if (!mapEl) return;
      try {
        mapInitialized = true;
        renderKonkanMap(mapEl, properties, id => window.openPropertyModal(id));

        // Price chart
        const locGroups = {};
        properties.forEach(p => {
          if (!locGroups[p.location]) locGroups[p.location] = [];
          locGroups[p.location].push(p.price);
        });
        const labels = Object.keys(locGroups);
        const avgs = labels.map(l => Math.round(locGroups[l].reduce((s, v) => s + v, 0) / locGroups[l].length));
        const priceCanvas = document.getElementById('priceChart');
        if (priceCanvas && typeof Chart !== 'undefined') {
          new Chart(priceCanvas, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{ label: 'Avg ₹/night', data: avgs, backgroundColor: ['#8fe9ff', '#ffb35c', '#4fc3d9', '#ff8fa3', '#b8a1ff', '#7ee0a8'], borderColor: 'rgba(4,16,31,0.8)', hoverOffset: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#ccc', font: { family: 'Outfit' } } } } }
          });
        }
      } catch (err) {
        console.error('Map rendering error: ', err);
        mapEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff6b6b;font-size:0.9rem;padding:2rem;text-align:center;">Failed to render map. Error: ${escapeHtml(err.message)}</div>`;
      }
    }

    document.querySelector('[data-target="panel-map"]')?.addEventListener('click', () => {
      setTimeout(initKonkanMap, 100);
    });
    const mapPanel = document.getElementById('panel-map');
    if (mapPanel) {
      new MutationObserver(mutations => {
        mutations.forEach(m => {
          if (m.target.classList.contains('active')) setTimeout(initKonkanMap, 100);
        });
      }).observe(mapPanel, { attributes: true, attributeFilter: ['class'] });
    }

    // Property Details Modal
    const propModal = document.getElementById('property-modal');
    const closePropModal = document.getElementById('close-property-modal');
    const btnProceedBook = document.getElementById('btn-proceed-book');
    let selectedPropId = null;

    // Mount booking wizard for customer
    mountBookingWizard();
    initBookingWizard(currentUser);

    window.openPropertyModal = propId => {
      selectedPropId = propId;
      const prop = properties.find(p => p.id === propId);
      if (!prop) return;

      document.getElementById('detail-title').textContent = prop.title;
      document.getElementById('detail-loc').textContent = `📍 ${prop.location}, Konkan`;
      document.getElementById('detail-desc').textContent = prop.description || 'A beautiful coastal stay.';
      document.getElementById('detail-price').textContent = `₹${(prop.price || 0).toLocaleString('en-IN')}`;
      document.getElementById('detail-guests').textContent = prop.guests || 0;

      const gallery = document.getElementById('detail-gallery');
      const imgs = prop.images?.length > 0 ? prop.images : [prop.image || '../assets/images/destinations/alibaug.avif'];
      gallery.innerHTML = imgs.map(i => `<img src="${escapeHtml(i)}" onerror="this.src='../assets/images/destinations/alibaug.avif'" style="height:100%;border-radius:8px;object-fit:cover;min-width:280px;flex-shrink:0;">`).join('');

      document.getElementById('detail-host-name').textContent = prop.isHardcoded ? 'KonkanStay Verified Host' : 'KonkanStay Host';
      document.getElementById('detail-host-email').textContent = prop.hostEmail || 'Contact via KonkanStay';
      document.getElementById('detail-host-phone').textContent = 'Contact via KonkanStay';

      propModal.classList.add('active');
    };

    closePropModal?.addEventListener('click', () => propModal.classList.remove('active'));
    btnProceedBook?.addEventListener('click', () => {
      if (!selectedPropId) return;
      const prop = properties.find(p => p.id === selectedPropId);
      if (!prop) return;
      propModal.classList.remove('active');
      openBookingWizard(prop);
    });
    propModal?.addEventListener('click', e => { if (e.target === propModal) propModal.classList.remove('active'); });

    renderCustomerBookings();
  }


  function renderCustomerBookings() {
    const tbody = document.getElementById('my-bookings-list');
    if (!tbody) return;
    tbody.innerHTML = bookings.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:3rem;color:rgba(255,255,255,0.3);">
          <div style="font-size:2.5rem;margin-bottom:0.75rem;">🌊</div>
          <div style="font-size:0.95rem;">No bookings yet. Start exploring coastal stays!</div>
         </td></tr>`
      : bookings.map(b => `
          <tr>
            <td style="font-weight:600;color:#fff;">${escapeHtml(b.propTitle)}</td>
            <td><span style="background:rgba(49,130,182,0.12);border:1px solid rgba(49,130,182,0.2);color:hsl(196,80%,72%);padding:0.2rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:600;">${escapeHtml(b.propLocation)}</span></td>
            <td style="white-space:nowrap;">${escapeHtml(b.checkin)} → ${escapeHtml(b.checkout)}</td>
            <td style="font-weight:700;color:hsl(196,80%,72%);">₹${Number(b.totalPrice || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-badge">${escapeHtml(b.status)}</span></td>
            <td>${b.status === 'Confirmed'
          ? `<button type="button" class="btn-print-confirmation" data-booking-id="${escapeHtml(b.id)}" aria-label="Print confirmation for ${escapeHtml(b.propTitle)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>
                  Save PDF
                </button>`
          : `<span class="booking-next-step">Awaiting host</span>`}
            </td>
          </tr>`).join('');

    document.getElementById('my-bookings-list')?.addEventListener('click', event => {
      const button = event.target.closest('.btn-print-confirmation');
      if (!button) return;
      const booking = bookings.find(item => item.id === button.dataset.bookingId);
      if (booking?.status === 'Confirmed') printReservationConfirmation(booking);
    });
  }

  // ─── HOST LOGIC ───────────────────────────────────────────────────────────
  function initHostLogic() {
    updateHostStats();
    renderProperties('host-prop-grid', properties, true);
    initRevenueChart();
    initAddPropertyForm();
    initHostBookingsTable();
    initAvailabilityCalendar();
  }

  function updateHostStats() {
    const confirmedBookings = bookings.filter(b => b.status === 'Confirmed');
    const revenue = confirmedBookings.reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);
    const pending = bookings.filter(b => b.status === 'Pending verification' || b.status === 'Requested').length;

    const revenueEl = document.getElementById('host-total-revenue');
    const bookingsEl = document.getElementById('host-total-bookings');
    const propsEl = document.getElementById('host-active-props');
    const pendingEl = document.getElementById('host-pending-bookings');

    if (revenueEl) revenueEl.textContent = '₹' + revenue.toLocaleString('en-IN');
    if (bookingsEl) bookingsEl.textContent = bookings.length;
    if (propsEl) propsEl.textContent = properties.length;
    if (pendingEl) pendingEl.textContent = pending;
  }

  function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthTotals = new Array(12).fill(0);
    bookings.filter(b => b.status === 'Confirmed').forEach(b => {
      const m = new Date(b.checkin).getMonth();
      monthTotals[(m - 3 + 12) % 12] += parseInt(b.totalPrice) || 0;
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Revenue (₹)',
          data: monthTotals.some(v => v > 0) ? monthTotals : Array(12).fill(0),
          backgroundColor: months.map((_, i) => `hsla(${196 + i * 8}, 65%, 50%, 0.7)`),
          borderColor: months.map((_, i) => `hsl(${196 + i * 8}, 65%, 50%)`),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => `₹${Number(ctx.raw).toLocaleString('en-IN')}` }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Outfit', size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Outfit', size: 11 }, callback: v => `₹${Number(v).toLocaleString('en-IN')}` } }
        }
      }
    });
  }

  function initAddPropertyForm() {
    const propImagesInput = document.getElementById('prop-images');
    const propImagesText = document.getElementById('prop-images-text');
    propImagesInput?.addEventListener('change', e => {
      const files = e.target.files;
      if (files.length > 3) {
        alert('Maximum 3 images allowed.');
        propImagesInput.value = '';
        propImagesText.textContent = 'Click to choose up to 3 images or drag & drop';
      } else if (files.length > 0) {
        propImagesText.textContent = `${files.length} image${files.length > 1 ? 's' : ''} selected ✓`;
      }
    });

    document.getElementById('add-property-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span style="opacity:0.7">Saving...</span>';
      submitBtn.disabled = true;

      const title = document.getElementById('prop-title').value.trim();
      const location = document.getElementById('prop-loc').value;
      const type = document.getElementById('prop-type')?.value || 'Villa';
      const price = document.getElementById('prop-price').value;
      const guests = document.getElementById('prop-guests').value;
      const bedrooms = document.getElementById('prop-bedrooms')?.value || 0;
      const desc = document.getElementById('prop-desc').value.trim();
      const upiId = document.getElementById('host-upi')?.value || '';
      const bankAcc = document.getElementById('host-bank-acc')?.value || '';
      const bankIfsc = document.getElementById('host-bank-ifsc')?.value || '';
      const qrInput = document.getElementById('host-qr');

      const amenities = [...document.querySelectorAll('#prop-amenities-checkboxes input:checked')].map(el => el.value);

      const files = propImagesInput?.files || [];
      const imgs = [];

      try {
        for (let i = 0; i < Math.min(files.length, 3); i++) {
          const compressed = await compressImage(files[i], 800, 0.7);
          imgs.push(compressed);
        }
        let qrBase64 = null;
        if (qrInput?.files?.length > 0) {
          const r = new FileReader();
          qrBase64 = await new Promise((res, rej) => {
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(qrInput.files[0]);
          });
        }

        const locationCoords = {
          'Alibaug': { lat: 18.648, lng: 72.872 }, 'Kashid': { lat: 18.305, lng: 72.967 },
          'Murud': { lat: 18.324, lng: 72.960 }, 'Dapoli': { lat: 17.757, lng: 73.189 },
          'Malvan': { lat: 16.060, lng: 73.471 }, 'Tarkarli': { lat: 16.020, lng: 73.461 }
        };

        const newProp = {
          hostEmail: currentUser.email,
          hostName: currentUser.fullname || '',
          hostPhone: currentUser.phone || '',
          title, location, type,
          price: parseInt(price),
          guests: parseInt(guests),
          bedrooms: parseInt(bedrooms) || 0,
          amenities,
          images: imgs,
          image: imgs[0] || '../assets/images/stays/sea-view-villa.jpg',
          description: desc,
          upiId, qrCode: qrBase64, bankAcc, bankIfsc,
          ...(locationCoords[location] || {})
        };

        const newPropId = await addProperty(newProp);
        properties.push({ id: newPropId, ...newProp });

        updateHostStats();
        window.showToast('🏠 Property listed successfully! It\'s now live on KonkanStay.');
        e.target.reset();
        if (propImagesText) propImagesText.textContent = 'Click to choose up to 3 images or drag & drop';
        renderProperties('host-prop-grid', properties, true);
        document.querySelector('[data-target="panel-my-props"]')?.click();
      } catch (err) {
        alert('Failed to list property: ' + err.message);
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  function initHostBookingsTable() {
    const tbody = document.getElementById('host-bookings-list');
    if (!tbody) return;

    const renderHostBookings = (filter = 'all') => {
      let filtered = bookings;
      if (filter === 'review') filtered = bookings.filter(b => b.status === 'Pending verification' || b.status === 'Requested');
      else if (filter === 'upcoming') filtered = bookings.filter(b => b.status === 'Confirmed' && new Date(b.checkin) > new Date());
      else if (filter === 'in-house') filtered = bookings.filter(b => b.status === 'Checked in');
      else if (filter === 'completed') filtered = bookings.filter(b => b.status === 'Completed' || b.status === 'Checked out');
      else if (filter === 'declined') filtered = bookings.filter(b => b.status === 'Declined');

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="9" style="text-align:center;padding:3rem;color:rgba(255,255,255,0.3);">
            <div style="font-size:2rem;margin-bottom:0.5rem;">📋</div>
            <div>${bookings.length === 0 ? 'No bookings received yet.' : 'No bookings match this filter.'}</div>
           </td></tr>`
        : filtered.map(b => {
          const nights = b.nights || 0;
          return `<tr>
              <td style="font-weight:600;color:#fff;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.propTitle || '')}</td>
              <td style="color:rgba(255,255,255,0.75);">${escapeHtml(b.customerName || b.customerEmail || '')}</td>
              <td style="white-space:nowrap;font-size:0.82rem;">${escapeHtml(b.checkin || '')} → ${escapeHtml(b.checkout || '')}</td>
              <td>${Number(b.guests) || 0}</td>
              <td>${nights}</td>
              <td style="font-weight:700;color:hsl(160,65%,60%);">₹${Number(b.totalPrice || 0).toLocaleString('en-IN')}</td>
              <td style="font-size:0.8rem;color:rgba(255,255,255,0.5);">${escapeHtml(b.txnId || '—')}</td>
              <td><span class="status-badge">${escapeHtml(b.status || '')}</span></td>
              <td>
                ${b.status === 'Pending verification' && b.txnId?.trim()
              ? `<button type="button" class="btn btn-sm btn-primary btn-review-booking" data-booking-id="${escapeHtml(b.id)}" data-status="Confirmed" style="margin-bottom:0.3rem;">Confirm</button>
                     <button type="button" class="btn btn-sm btn-danger btn-review-booking" data-booking-id="${escapeHtml(b.id)}" data-status="Declined">Decline</button>`
              : b.status === 'Requested' ? '<span style="font-size:0.78rem;color:rgba(255,255,255,0.35);">Awaiting payment ref</span>'
                : b.status === 'Confirmed' ? `<button type="button" class="btn btn-sm btn-outline-navy btn-review-booking" data-booking-id="${escapeHtml(b.id)}" data-status="Checked in">Check In</button>`
                  : ''}
              </td>
            </tr>`;
        }).join('');

      tbody.querySelectorAll('.btn-review-booking').forEach(button => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          const nextStatus = button.dataset.status;
          try {
            await updateBookingStatus(button.dataset.bookingId, nextStatus);
            const booking = bookings.find(item => item.id === button.dataset.bookingId);
            if (booking) booking.status = nextStatus;
            renderHostBookings(document.getElementById('host-booking-filter')?.value || 'all');
            updateHostStats();
            showToast(`✅ Booking ${nextStatus === 'Confirmed' ? 'confirmed' : nextStatus.toLowerCase()} successfully!`);
          } catch (error) {
            alert(error.code === 'availability-conflict' ? error.message : 'Could not update booking. Please try again.');
            button.disabled = false;
          }
        });
      });

      const summaryEl = document.getElementById('host-booking-summary');
      if (summaryEl) {
        const pending = bookings.filter(b => b.status === 'Pending verification' || b.status === 'Requested').length;
        const confirmed = bookings.filter(b => b.status === 'Confirmed').length;
        summaryEl.innerHTML = `
          ${pending > 0 ? `<span style="background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);color:hsl(38,88%,65%);padding:0.3rem 0.8rem;border-radius:20px;font-size:0.78rem;font-weight:700;">⏳ ${pending} pending review</span>` : ''}
          ${confirmed > 0 ? `<span style="background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);color:hsl(160,65%,60%);padding:0.3rem 0.8rem;border-radius:20px;font-size:0.78rem;font-weight:700;">✓ ${confirmed} confirmed</span>` : ''}
          ${bookings.length === 0 ? '<span style="color:rgba(255,255,255,0.3);font-size:0.85rem;">No bookings received yet.</span>' : ''}`;
      }
    };

    document.getElementById('host-booking-filter')?.addEventListener('change', e => renderHostBookings(e.target.value));
    renderHostBookings();
  }

  // ─── AVAILABILITY CALENDAR LOGIC ─────────────────────────────────────────
  let selectedAvailPropId = null;
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let blockedDates = {};
  let bookedDates = {};

  function initAvailabilityCalendar() {
    if (isHardcodedHost) {
      const saved = getHardcodedAvailability();
      Object.keys(saved).forEach(propId => {
        blockedDates[propId] = new Set(saved[propId] || []);
      });
    }

    const propList = document.getElementById('avail-property-list');
    if (!propList) return;

    if (properties.length === 0) {
      propList.innerHTML = '<p style="color:rgba(255,255,255,0.35);font-size:0.85rem;">You have no properties listed yet.</p>';
      return;
    }

    propList.innerHTML = '';
    properties.forEach(prop => {
      const btn = document.createElement('button');
      btn.className = 'avail-prop-btn';
      btn.dataset.propId = prop.id;
      btn.dataset.propName = prop.title;
      const img = prop.image || prop.images?.[0] || '../assets/images/destinations/alibaug.avif';
      btn.innerHTML = `
        <img class="avail-prop-btn-img" src="${escapeHtml(img)}" onerror="this.src='../assets/images/destinations/alibaug.avif'" alt="">
        <div>
          <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.85);line-height:1.2;">${escapeHtml(prop.title)}</div>
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.35);margin-top:1px;">📍 ${escapeHtml(prop.location)}</div>
        </div>`;
      btn.addEventListener('click', () => selectAvailabilityProperty(prop.id, prop.title));
      propList.appendChild(btn);
    });

    document.getElementById('avail-prev-month')?.addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });

    document.getElementById('avail-next-month')?.addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });

    const today = new Date().toISOString().split('T')[0];
    const fromInput = document.getElementById('avail-block-from');
    const toInput = document.getElementById('avail-block-to');
    if (fromInput) fromInput.min = today;
    if (toInput) toInput.min = today;

    document.getElementById('btn-block-range')?.addEventListener('click', async () => {
      if (!selectedAvailPropId) { showAvailStatus('Please select a property first.', 'error'); return; }
      const from = fromInput?.value, to = toInput?.value;
      if (!from || !to || from > to) { showAvailStatus('Please select a valid date range.', 'error'); return; }
      await setDateRange(from, to, 'block');
    });

    document.getElementById('btn-unblock-range')?.addEventListener('click', async () => {
      if (!selectedAvailPropId) { showAvailStatus('Please select a property first.', 'error'); return; }
      const from = fromInput?.value, to = toInput?.value;
      if (!from || !to || from > to) { showAvailStatus('Please select a valid date range.', 'error'); return; }
      await setDateRange(from, to, 'unblock');
    });

    renderCalendar();
  }

  function selectAvailabilityProperty(propId, propName) {
    selectedAvailPropId = propId;
    document.querySelectorAll('.avail-prop-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.propId === propId);
    });
    const nameEl = document.getElementById('avail-property-name');
    if (nameEl) nameEl.textContent = `Managing availability for: ${propName}`;

    if (!isHardcodedHost) {
      getPropertyOccupiedNights(propId).then(occupied => {
        bookedDates[propId] = new Set(Object.keys(occupied));
        renderCalendar();
      }).catch(() => {
        bookedDates[propId] = new Set();
        renderCalendar();
      });
    }
    renderCalendar();
  }

  function getDatesBetween(from, to) {
    const dates = [];
    const cur = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  async function setDateRange(from, to, action) {
    const dates = getDatesBetween(from, to);
    if (!blockedDates[selectedAvailPropId]) blockedDates[selectedAvailPropId] = new Set();

    if (action === 'block') dates.forEach(d => blockedDates[selectedAvailPropId].add(d));
    else dates.forEach(d => blockedDates[selectedAvailPropId].delete(d));

    try {
      if (isHardcodedHost) {
        const allBlocked = getHardcodedAvailability();
        allBlocked[selectedAvailPropId] = [...blockedDates[selectedAvailPropId]];
        saveHardcodedAvailability(allBlocked);
      } else {
        const batch = [];
        for (const date of dates) {
          const docRef = doc(db, 'properties', selectedAvailPropId, 'hostBlocked', date);
          if (action === 'block') {
            batch.push(setDoc(docRef, { date, blockedByHost: true, createdAt: new Date().toISOString() }));
          } else {
            batch.push(deleteDoc(docRef));
          }
        }
        await Promise.all(batch);
      }
      showAvailStatus(`${dates.length} date${dates.length > 1 ? 's' : ''} ${action === 'block' ? 'blocked' : 'unblocked'} successfully! ✓`, 'success');
    } catch (err) {
      console.error('[KonkanStay] Availability update failed:', err);
      showAvailStatus('Failed to update availability. Please try again.', 'error');
    }
    renderCalendar();
  }

  function renderCalendar() {
    const calBody = document.getElementById('avail-cal-body');
    const calTitle = document.getElementById('avail-cal-title');
    if (!calBody || !calTitle) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    calTitle.textContent = `${monthNames[calMonth]} ${calYear}`;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

    const myBlocked = blockedDates[selectedAvailPropId] || new Set();
    const myBooked = bookedDates[selectedAvailPropId] || new Set();

    calBody.innerHTML = '';

    for (let i = firstDay - 1; i >= 0; i--) {
      const div = document.createElement('div');
      div.className = 'avail-cal-day other-month';
      div.textContent = daysInPrevMonth - i;
      calBody.appendChild(div);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const div = document.createElement('div');
      div.textContent = d;

      const isPast = dateStr < todayStr;
      const isBooked = myBooked.has(dateStr);
      const isBlocked = myBlocked.has(dateStr);
      const isToday = dateStr === todayStr;

      div.className = 'avail-cal-day';
      if (isPast) div.classList.add('past');
      else if (isBooked) div.classList.add('blocked-booking');
      else if (isBlocked) div.classList.add('blocked-host');
      if (isToday) div.classList.add('today');

      if (!isPast && !isBooked && selectedAvailPropId) {
        div.title = isBlocked ? 'Click to unblock' : 'Click to block';
        div.addEventListener('click', async () => {
          await setDateRange(dateStr, dateStr, isBlocked ? 'unblock' : 'block');
        });
      }

      calBody.appendChild(div);
    }

    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    let nextDay = 1;
    for (let i = firstDay + daysInMonth; i < totalCells; i++) {
      const div = document.createElement('div');
      div.className = 'avail-cal-day other-month';
      div.textContent = nextDay++;
      calBody.appendChild(div);
    }
  }

  function showAvailStatus(msg, type = '') {
    const el = document.getElementById('avail-save-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `avail-save-status${type ? ` ${type}` : ''}`;
    setTimeout(() => { el.textContent = ''; el.className = 'avail-save-status'; }, 4000);
  }

  // ─── TOAST ────────────────────────────────────────────────────────────────
  window.showToast = msg => {
    let toast = document.getElementById('dash-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dash-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.transform = 'translateY(80px)';
      toast.style.opacity = '0';
    }, 4000);
  };

  // ─── PRINT CONFIRMATION ───────────────────────────────────────────────────
  function printReservationConfirmation(booking) {
    const printWindow = window.open('', '_blank', 'popup,width=820,height=900');
    if (!printWindow) { alert('Allow pop-ups to print your reservation confirmation.'); return; }
    const formatDate = v => { const d = new Date(`${v}T00:00:00`); return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); };
    const markUrl = new URL('../assets/images/konkanstay-mark.svg', window.location.href).href;
    printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KonkanStay Reservation</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#f2f0e8;color:#193435;font-family:Georgia,serif}.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:22mm 20mm;background:#fbfaf6}.top{display:flex;align-items:center;gap:12px;padding-bottom:22px;border-bottom:2px solid #174f4d}.brand{font-size:23px;font-weight:700;color:#174f4d}.tag{font:11px Arial,sans-serif;letter-spacing:1.5px;color:#687878}.eyebrow{margin-top:38px;color:#b57843;font:700 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}h1{margin:8px 0 12px;font-size:36px;font-weight:500;color:#174f4d}.status{display:inline-block;margin:22px 0;padding:8px 12px;border-radius:4px;background:#e3f1e9;color:#286247;font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase}.property{padding:22px 0;border-top:1px solid #d9dfd7;border-bottom:1px solid #d9dfd7}.property h2{margin:0 0 5px;font-size:24px;font-weight:500}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 36px;padding:25px 0}.label{display:block;margin-bottom:5px;color:#788483;font:700 10px Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase}.value{font:16px Arial,sans-serif;color:#193435}.total{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:17px 0;border-top:1px solid #d9dfd7;border-bottom:1px solid #d9dfd7}.total strong{font:700 20px Arial,sans-serif;color:#174f4d}.code{margin-top:25px;color:#687878;font:12px Arial,sans-serif}.note{margin-top:42px;padding-top:14px;border-top:1px solid #d9dfd7;color:#77817e;font:11px/1.6 Arial,sans-serif}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}</style></head><body><main class="sheet"><header class="top"><img src="${markUrl}" alt="" width="42" height="42"><div><div class="brand">KonkanStay</div><div class="tag">COASTAL ESCAPES</div></div></header><div class="eyebrow">Your Konkan journey</div><h1>Reservation confirmed</h1><div class="status">Host confirmed</div><section class="property"><h2>${escapeHtml(booking.propTitle)}</h2><p>${escapeHtml(booking.propLocation)} · Konkan, Maharashtra</p></section><section class="grid"><div><span class="label">Check-in</span><span class="value">${formatDate(booking.checkin)}</span></div><div><span class="label">Check-out</span><span class="value">${formatDate(booking.checkout)}</span></div><div><span class="label">Guests</span><span class="value">${Number(booking.guests) || 0}</span></div><div><span class="label">Nights</span><span class="value">${Number(booking.nights) || 0}</span></div></section><div class="total"><span>Stay total</span><strong>₹${Number(booking.totalPrice || 0).toLocaleString('en-IN')}</strong></div><p class="code">Confirmation: ${escapeHtml(booking.id)}</p><p class="note">KonkanStay does not process or verify payments. This is a reservation confirmation only, not a tax invoice or payment receipt.</p></main><script>window.addEventListener('load',()=>{window.focus();window.print();});<\/script></body></html>`);
    printWindow.document.close();
  }

  // ─── BOOTSTRAP ────────────────────────────────────────────────────────────
  subscribeToAuthChanges(handleAuthChange);
});
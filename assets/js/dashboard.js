import { subscribeToAuthChanges, getUserProfile, logoutUser } from './firebase/authService.js';
import { getProperties, getPropertiesByHost, addProperty, getBookingsByCustomer, getBookingsByHost, updateBookingStatus } from './firebase/firestoreService.js';
import { escapeHtml } from './bookingUtils.mjs';
import { printReservationConfirmation as printDemoReservationConfirmation } from './bookingConfirmation.js';
// Compress image to base64 — keeps Firestore docs well under the 1MB limit
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width  = img.width;
        let height = img.height;
        if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

document.addEventListener('DOMContentLoaded', () => {

  let currentUser = null;
  let properties = [];
  // ─── 1. AUTH CHECK ───────────────────────────────────────────────────────────
  async function handleAuthChange(user) {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    // Get profile from Firestore
    const profile = await getUserProfile(user.uid);
    if (!profile) console.warn('[KonkanStay] Profile unavailable; opening the customer dashboard with Firebase account details.');
    const accountName = profile?.fullname || profile?.username || user.displayName || user.email?.split('@')[0] || 'Traveler';
    currentUser = {
      ...user,
      ...(profile || {}),
      fullname: accountName,
      username: profile?.username || user.email?.split('@')[0] || accountName,
      userType: profile?.userType || 'customer'
    };
    
    // Redirect if they are on the wrong dashboard
    const isHostPage = window.location.href.includes('dashboard-host');
    if (currentUser.userType === 'host' && !isHostPage) {
      window.location.href = 'dashboard-host.html';
      return;
    } else if (currentUser.userType !== 'host' && isHostPage) {
      window.location.href = 'dashboard-customer.html';
      return;
    }

    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay) nameDisplay.textContent = currentUser.fullname || currentUser.username;

    // Load initial data
    await loadInitialData();
  }

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logoutUser();
    window.location.href = '../index.html';
  });

  // ─── 2. SIDEBAR NAVIGATION ───────────────────────────────────────────────────
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  const panels   = document.querySelectorAll('.dashboard-panel');

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

  // ─── DATA LOADING ────────────────────────────────────────────────────────────
  async function loadInitialData() {
    if (currentUser.userType === 'host') {
      properties = await getPropertiesByHost(currentUser.email);
      bookings = await getBookingsByHost(currentUser.email);
      initHostLogic();
    } else {
      try { properties = await getProperties(); }
      catch (error) {
        properties = [];
        console.error('[KonkanStay] Customer listings are unavailable:', error);
      }
      try { bookings = await getBookingsByCustomer(currentUser.email); }
      catch (error) {
        bookings = [];
        console.error('[KonkanStay] Customer bookings are unavailable:', error);
      }
      initCustomerLogic();
    }
  }

  // ─── 4. RENDER PROPERTIES ────────────────────────────────────────────────────
  const renderProperties = (containerId, propsToRender, isHostView = false) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (propsToRender.length === 0) {
      container.innerHTML = '<p style="color:var(--clr-text-mid);grid-column:1/-1;text-align:center;padding:3rem;">No properties found.</p>';
      return;
    }

    propsToRender.forEach(prop => {
      const card = document.createElement('div');
      card.className = 'prop-card';
      const actionHtml = isHostView
        ? `<span class="status-badge success" style="float:right;">Active</span>`
        : `<button class="btn btn-primary btn-open-property" data-property-id="${escapeHtml(prop.id)}" style="width:100%;padding:0.6rem;">View Details</button>`;

      const amenityHtml = (prop.amenities || []).slice(0, 3)
        .map(a => `<span style="font-size:0.72rem;background:rgba(49,130,182,0.08);color:var(--clr-sea);padding:0.2rem 0.6rem;border-radius:20px;font-weight:600;">${escapeHtml(a)}</span>`)
        .join('');

      card.innerHTML = `
        <div class="prop-img-wrap" style="height:210px;position:relative;">
          <img src="${escapeHtml(prop.image || prop.images?.[0] || '../assets/images/destinations/alibaug.avif')}" alt="${escapeHtml(prop.title)}" onerror="this.src='../assets/images/destinations/alibaug.avif'" style="width:100%;height:100%;object-fit:cover;">
          <div style="position:absolute;top:0.75rem;right:0.75rem;background:rgba(255,255,255,0.9);backdrop-filter:blur(6px);padding:0.3rem 0.75rem;border-radius:20px;font-weight:700;font-size:0.85rem;color:var(--clr-navy);">₹${Number(prop.price || 0).toLocaleString('en-IN')}/night</div>
        </div>
        <div class="prop-details">
          <h3 class="prop-title" style="font-size:1.2rem;">${escapeHtml(prop.title)}</h3>
          <p class="prop-loc"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(prop.location)}</p>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:1rem;">${amenityHtml}</div>
          <div class="prop-meta" style="margin-bottom:1rem;">
            <div style="font-size:0.82rem;color:var(--clr-text-light);">Up to ${Number(prop.guests) || 0} guests</div>
          </div>
          ${actionHtml}
        </div>`;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-open-property').forEach(button => {
      button.addEventListener('click', () => window.openPropertyModal(button.dataset.propertyId));
    });
  };

  // ─── 5. CUSTOMER LOGIC ───────────────────────────────────────────────────────
  function initCustomerLogic() {
    // Stat cards
    const totalPropsEl = document.getElementById('cust-total-props');
    const avgPriceEl   = document.getElementById('cust-avg-price');
    if (totalPropsEl) totalPropsEl.textContent = properties.length;
    if (avgPriceEl && properties.length > 0) {
      const avg = Math.round(properties.reduce((s, p) => s + p.price, 0) / properties.length);
      avgPriceEl.textContent = `₹${avg.toLocaleString()}`;
    }

    renderProperties('customer-prop-grid', properties);

    // Search / Filter
    document.getElementById('search-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const loc    = document.getElementById('filter-loc').value;
      const guests = parseInt(document.getElementById('filter-guests').value) || 0;
      let filtered = properties;
      if (loc)    filtered = filtered.filter(p => p.location.toLowerCase() === loc.toLowerCase());
      if (guests) filtered = filtered.filter(p => p.guests >= guests);
      renderProperties('customer-prop-grid', filtered);

      if (totalPropsEl) totalPropsEl.textContent = filtered.length;
      if (avgPriceEl && filtered.length > 0) {
        const avg = Math.round(filtered.reduce((s, p) => s + p.price, 0) / filtered.length);
        avgPriceEl.textContent = `₹${avg.toLocaleString()}`;
      }
    });

    // ── Leaflet Map ─────────────────────────────────────────────────────────────
    let mapInitialized = false;
    document.querySelector('[data-target="panel-map"]')?.addEventListener('click', () => {
      setTimeout(() => {
        if (mapInitialized) return;
        mapInitialized = true;

        const map = L.map('konkan-map', { zoomControl: false }).setView([17.5, 73.2], 7);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Premium CartoDB Voyager map tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        const customMarkerHTML = `
          <div style="background:var(--clr-sea); color:white; padding:8px 12px; border-radius:24px; font-weight:700; box-shadow:0 4px 12px rgba(49,130,182,0.4); border:2px solid white; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Stay
          </div>
        `;

        properties.forEach(prop => {
          if (!prop.lat || !prop.lng) return;
          const premiumIcon = L.divIcon({
            html: customMarkerHTML,
            className: 'custom-map-marker',
            iconSize: [80, 40],
            iconAnchor: [40, 40],
            popupAnchor: [0, -42]
          });
          const marker = L.marker([prop.lat, prop.lng], { icon: premiumIcon }).addTo(map);
          marker.bindPopup(`
            <div style="font-family:'Outfit',sans-serif;min-width:180px;">
              <img src="${escapeHtml(prop.image || '../assets/images/destinations/alibaug.avif')}" onerror="this.src='../assets/images/destinations/alibaug.avif'" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;">
              <strong style="font-size:1rem;">${escapeHtml(prop.title)}</strong><br>
              <span style="color:#777;font-size:0.85rem;">📍 ${escapeHtml(prop.location)}</span><br>
              <span style="font-weight:700;color:#0a1224;">₹${Number(prop.price || 0).toLocaleString('en-IN')}/night</span><br>
              <button onclick="document.querySelector('[data-target=panel-browse]').click();openPropertyModal('${prop.id}')"
                style="margin-top:8px;width:100%;padding:6px;background:linear-gradient(135deg,#3182b6,#1a5276);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
                View & Book
              </button>
            </div>`);
        });

        // Price by location chart
        const locGroups = {};
        properties.forEach(p => {
          if (!locGroups[p.location]) locGroups[p.location] = [];
          locGroups[p.location].push(p.price);
        });
        const locLabels = Object.keys(locGroups);
        const locAvgs   = locLabels.map(l => Math.round(locGroups[l].reduce((s, v) => s + v, 0) / locGroups[l].length));

        new Chart(document.getElementById('priceChart'), {
          type: 'pie',
          data: {
            labels: locLabels,
            datasets: [{
              label: 'Avg. Price / Night (₹)',
              data: locAvgs,
              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
          }
        });
      }, 100);
    });

    // ── Property Details Modal ──────────────────────────────────────────────────
    const propModal        = document.getElementById('property-modal');
    const closePropModal   = document.getElementById('close-property-modal');
    const btnProceedBook   = document.getElementById('btn-proceed-book');
    let selectedPropId     = null;

    window.openPropertyModal = propId => {
      selectedPropId = propId;
      const prop = properties.find(p => p.id === propId);

      document.getElementById('detail-title').textContent  = prop.title;
      document.getElementById('detail-loc').textContent    = `📍 ${prop.location}`;
      document.getElementById('detail-desc').textContent   = prop.description;
      document.getElementById('detail-price').textContent  = `₹${prop.price.toLocaleString()}`;
      document.getElementById('detail-guests').textContent = prop.guests;

      const gallery = document.getElementById('detail-gallery');
      gallery.innerHTML = '';
      const imgs = (prop.images && prop.images.length > 0) ? prop.images : [prop.image];
      imgs.forEach(img => {
        gallery.innerHTML += `<img src="${escapeHtml(img)}" onerror="this.src='../assets/images/destinations/alibaug.avif'" style="height:100%;border-radius:var(--radius-md);object-fit:cover;min-width:300px;flex-shrink:0;box-shadow:var(--shadow-sm);">`;
      });

      document.getElementById('detail-host-name').textContent  = 'KonkanStay Host';
      document.getElementById('detail-host-email').textContent = prop.hostEmail || 'Contact via KonkanStay';
      document.getElementById('detail-host-phone').textContent = 'Contact via KonkanStay';

      propModal.classList.add('active');
    };

    closePropModal?.addEventListener('click', () => propModal.classList.remove('active'));
    btnProceedBook?.addEventListener('click', () => {
      if (!selectedPropId) return;
      const params = new URLSearchParams({ propertyId: selectedPropId });
      const checkin = document.getElementById('filter-checkin')?.value;
      const checkout = document.getElementById('filter-checkout')?.value;
      const guests = document.getElementById('filter-guests')?.value;
      if (checkin) params.set('checkin', checkin);
      if (checkout) params.set('checkout', checkout);
      if (guests) params.set('guests', guests);
      window.location.href = `search.html?${params}`;
    });
    propModal?.addEventListener('click', e => { if (e.target === propModal) propModal.classList.remove('active'); });

    const renderCustomerBookings = () => {
      const tbody     = document.getElementById('my-bookings-list');
      if (!tbody) return;
      tbody.innerHTML  = bookings.length === 0
        ? '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--clr-text-light);">No bookings yet. Start exploring!</td></tr>'
        : bookings.map(b => `
            <tr>
              <td style="font-weight:600;">${escapeHtml(b.propTitle)}</td>
              <td>${escapeHtml(b.propLocation)}</td>
              <td>${b.checkin} → ${b.checkout}</td>
              <td style="font-weight:700;color:var(--clr-sea);">₹${Number(b.totalPrice).toLocaleString('en-IN')}</td>
              <td><span class="status-badge">${escapeHtml(b.status)}</span></td>
              <td>${b.status === 'Confirmed'
                ? `<button type="button" class="btn-print-confirmation" data-booking-id="${escapeHtml(b.id)}" aria-label="Print confirmation for ${escapeHtml(b.propTitle)}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>
                    Save as PDF
                  </button>`
                : '<span class="booking-next-step">Available after host confirmation</span>'}</td>
            </tr>`).join('');
    };

    document.getElementById('my-bookings-list')?.addEventListener('click', event => {
      const button = event.target.closest('.btn-print-confirmation');
      if (!button) return;
      const booking = bookings.find(item => item.id === button.dataset.bookingId);
      if (booking?.status === 'Confirmed') {
        printReservationConfirmation(booking);
      }
    });

    function printReservationConfirmation(booking) {
      const printWindow = window.open('', '_blank', 'popup,width=820,height=900');
      if (!printWindow) {
        alert('Allow pop-ups to print or save your reservation confirmation.');
        return;
      }

      const formatDate = value => {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime())
          ? escapeHtml(value)
          : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      };
      const markUrl = new URL('../assets/images/konkanstay-mark.svg', window.location.href).href;
      printWindow.document.write(`<!doctype html>
        <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>KonkanStay reservation confirmation</title><style>
          @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#f2f0e8;color:#193435;font-family:Georgia,serif}
          .sheet{width:210mm;min-height:297mm;margin:0 auto;padding:22mm 20mm;background:#fbfaf6}
          .top{display:flex;align-items:center;gap:12px;padding-bottom:22px;border-bottom:2px solid #174f4d}
          .top img{width:42px;height:42px}.brand{font-size:23px;font-weight:700;color:#174f4d}.tag{font:11px Arial,sans-serif;letter-spacing:1.5px;color:#687878}
          .eyebrow{margin-top:38px;color:#b57843;font:700 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
          h1{margin:8px 0 12px;font-size:36px;font-weight:500;color:#174f4d}.intro{max-width:470px;color:#647372;font:14px/1.7 Arial,sans-serif}
          .status{display:inline-block;margin:22px 0;padding:8px 12px;border-radius:4px;background:#e3f1e9;color:#286247;font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase}
          .property{padding:22px 0;border-top:1px solid #d9dfd7;border-bottom:1px solid #d9dfd7}.property h2{margin:0 0 5px;font-size:24px;font-weight:500}.property p{margin:0;color:#687878;font:13px Arial,sans-serif}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 36px;padding:25px 0}.label{display:block;margin-bottom:5px;color:#788483;font:700 10px Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase}.value{font:16px Arial,sans-serif;color:#193435}
          .total{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:17px 0;border-top:1px solid #d9dfd7;border-bottom:1px solid #d9dfd7}.total strong{font:700 20px Arial,sans-serif;color:#174f4d}
          .code{margin-top:25px;color:#687878;font:12px Arial,sans-serif;overflow-wrap:anywhere}.note{margin-top:42px;padding-top:14px;border-top:1px solid #d9dfd7;color:#77817e;font:11px/1.6 Arial,sans-serif}
          @media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}
        </style></head><body><main class="sheet">
          <header class="top"><img src="${markUrl}" alt=""><div><div class="brand">KonkanStay</div><div class="tag">COASTAL ESCAPES</div></div></header>
          <div class="eyebrow">Your Konkan journey</div><h1>Reservation confirmed</h1>
          <p class="intro">Your host has confirmed this stay. Keep this confirmation handy when you travel.</p>
          <div class="status">Host confirmed</div>
          <section class="property"><h2>${escapeHtml(booking.propTitle)}</h2><p>${escapeHtml(booking.propLocation)} · Konkan, Maharashtra</p></section>
          <section class="grid">
            <div><span class="label">Check-in</span><span class="value">${formatDate(booking.checkin)}</span></div>
            <div><span class="label">Check-out</span><span class="value">${formatDate(booking.checkout)}</span></div>
            <div><span class="label">Guests</span><span class="value">${Number(booking.guests) || 0}</span></div>
            <div><span class="label">Nights</span><span class="value">${Number(booking.nights) || 0}</span></div>
          </section>
          <div class="total"><span>Stay total</span><strong>₹${Number(booking.totalPrice).toLocaleString('en-IN')}</strong></div>
          <p class="code">Confirmation ID: ${escapeHtml(booking.id)}</p>
          <p class="note">Reservation confirmation only. KonkanStay does not process or verify payments; the host reviewed the transaction reference submitted with this booking. This document is not a tax invoice or payment receipt.</p>
        </main><script>window.addEventListener('load',()=>{window.focus();window.print()});</script></body></html>`);
      printWindow.document.close();
    }

    renderCustomerBookings();
  }

  // ─── 6. HOST LOGIC ───────────────────────────────────────────────────────────
  function initHostLogic() {
    const revenue    = bookings.filter(b => b.status === 'Confirmed')
      .reduce((sum, booking) => sum + (Number(booking.totalPrice) || 0), 0);

    // Stat cards
    const revenueEl  = document.getElementById('host-total-revenue');
    const bookingsEl = document.getElementById('host-total-bookings');
    const propsEl    = document.getElementById('host-active-props');
    if (revenueEl)  revenueEl.textContent  = '₹' + revenue.toLocaleString();
    if (bookingsEl) bookingsEl.textContent = bookings.length;
    if (propsEl)    propsEl.textContent    = properties.length;

    renderProperties('host-prop-grid', properties, true);

    // Revenue chart
    const ctx = document.getElementById('revenueChart');
    let revenueChart = null;
    if (ctx) {
      const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
      const monthTotals = new Array(12).fill(0);
      bookings.filter(booking => booking.status === 'Confirmed').forEach(b => {
        const m = new Date(b.checkin).getMonth();
        monthTotals[((m - 3 + 12) % 12)] += parseInt(b.totalPrice) || 0;
      });
      const hasSomeData = monthTotals.some(v => v > 0);
      const chartData   = hasSomeData ? monthTotals
        : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      revenueChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: months,
          datasets: [{
            label: 'Revenue (₹)',
            data: chartData,
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
              '#9966FF', '#FF9F40', '#E7E9ED', '#8A2BE2', 
              '#00FA9A', '#DC143C', '#00FFFF', '#FF1493'
            ],
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right' } },
        }
      });
    }

    // Image upload preview
    const propImagesInput = document.getElementById('prop-images');
    const propImagesText  = document.getElementById('prop-images-text');
    propImagesInput?.addEventListener('change', e => {
      const files = e.target.files;
      if (files.length > 3) { alert('Maximum 3 images allowed.'); propImagesInput.value = ''; propImagesText.textContent = 'Choose up to 3 images or drag & drop'; }
      else if (files.length > 0) propImagesText.textContent = `${files.length} image${files.length > 1 ? 's' : ''} selected ✓`;
    });

    // Add property form
    document.getElementById('add-property-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;
      
      const title    = document.getElementById('prop-title').value;
      const location = document.getElementById('prop-loc').value;
      const price    = document.getElementById('prop-price').value;
      const guests   = document.getElementById('prop-guests').value;
      const desc     = document.getElementById('prop-desc').value;
      const upiId    = document.getElementById('host-upi').value;
      const bankAcc  = document.getElementById('host-bank-acc').value;
      const bankIfsc = document.getElementById('host-bank-ifsc').value;
      const qrInput  = document.getElementById('host-qr');

      const toBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result); r.onerror = rej; });
      const files    = propImagesInput?.files || [];
      const imgs     = [];
      
      try {
        // Store images as base64 directly in Firestore (free — no Storage needed)
        for (let i = 0; i < Math.min(files.length, 3); i++) {
          // Compress image to keep Firestore document under 1MB
          const compressed = await compressImage(files[i], 800, 0.7);
          imgs.push(compressed);
        }

        let qrBase64 = null;
        if (qrInput?.files?.length > 0) {
          qrBase64 = await toBase64(qrInput.files[0]);
        }

        const locationCoords = {
          'Alibaug':  { lat: 18.648, lng: 72.872 }, 'Kashid':   { lat: 18.305, lng: 72.967 },
          'Murud':    { lat: 18.324, lng: 72.960 }, 'Dapoli':   { lat: 17.757, lng: 73.189 },
          'Malvan':   { lat: 16.060, lng: 73.471 }, 'Tarkarli': { lat: 16.020, lng: 73.461 }
        };

        const newProp = {
          hostEmail: currentUser.email,
          hostName: currentUser.fullname || '',
          hostPhone: currentUser.phone || '',
          title, location,
          price: parseInt(price), guests: parseInt(guests),
          images: imgs, image: imgs[0] || '../assets/images/stays/sea-view-villa.jpg',
          description: desc, upiId, qrCode: qrBase64, bankAcc, bankIfsc,
          ...(locationCoords[location] || {})
        };

        const newPropId = await addProperty(newProp);
        properties.push({ id: newPropId, ...newProp });

        // Update stats
        if (propsEl) propsEl.textContent = properties.length;

        showToast('🏠 Property listed successfully!');
        e.target.reset();
        if (propImagesText) propImagesText.textContent = 'Choose up to 3 images or drag & drop';
        renderProperties('host-prop-grid', properties, true);
        document.querySelector('[data-target="panel-my-props"]').click();
      } catch (err) {
        alert('Failed to list property: ' + err.message);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });

    // Bookings received table
    const tbody = document.getElementById('host-bookings-list');
    if (tbody) {
      const renderHostBookings = () => {
        tbody.innerHTML = bookings.length === 0
          ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--clr-text-light);">No bookings received yet.</td></tr>'
          : bookings.map(booking => `
            <tr>
              <td style="font-weight:600;">${escapeHtml(booking.propTitle)}</td>
              <td>${escapeHtml(booking.customerName || booking.customerEmail)}</td>
              <td>${escapeHtml(booking.checkin)} → ${escapeHtml(booking.checkout)}</td>
              <td>${Number(booking.guests) || 0}</td>
              <td style="font-weight:700;color:#27ae60;">₹${Number(booking.totalPrice).toLocaleString('en-IN')}</td>
              <td>${escapeHtml(booking.txnId || 'No payment submitted')}</td>
              <td><span class="status-badge">${escapeHtml(booking.status)}</span>
                ${booking.status === 'Pending verification' && booking.txnId?.trim()
                    ? `<button type="button" class="btn-review-booking btn btn-primary" data-booking-id="${escapeHtml(booking.id)}" data-status="Confirmed">Confirm</button>
                      <button type="button" class="btn-review-booking btn btn-outline-navy" data-booking-id="${escapeHtml(booking.id)}" data-status="Declined">Decline</button>`
                    : booking.status === 'Requested'
                      ? '<small>Awaiting payment reference</small>'
                      : ''}
              </td>
            </tr>`).join('');

        tbody.querySelectorAll('.btn-review-booking').forEach(button => {
          button.addEventListener('click', async () => {
            button.disabled = true;
            const nextStatus = button.dataset.status;
            try {
              await updateBookingStatus(button.dataset.bookingId, nextStatus);
              const booking = bookings.find(item => item.id === button.dataset.bookingId);
              if (booking) booking.status = nextStatus;
              renderHostBookings();

              const confirmedBookings = bookings.filter(item => item.status === 'Confirmed');
              const confirmedRevenue = confirmedBookings.reduce(
                (sum, item) => sum + (Number(item.totalPrice) || 0), 0
              );
              if (revenueEl) revenueEl.textContent = `₹${confirmedRevenue.toLocaleString('en-IN')}`;

              if (revenueChart) {
                const monthTotals = new Array(12).fill(0);
                confirmedBookings.forEach(item => {
                  const month = new Date(`${item.checkin}T00:00:00Z`).getUTCMonth();
                  monthTotals[(month - 3 + 12) % 12] += Number(item.totalPrice) || 0;
                });
                revenueChart.data.datasets[0].data = monthTotals;
                revenueChart.update();
              }
            } catch (error) {
              console.error('[KonkanStay] Unable to confirm booking:', error);
              alert(error.code === 'availability-conflict'
                ? error.message
                : 'Could not update this booking. Please try again.');
              button.disabled = false;
            }
          });
        });
      };

      renderHostBookings();
    }
  }

  // ─── 7. TOAST UTILITY ────────────────────────────────────────────────────────
  window.showToast = msg => {
    let toast = document.getElementById('dash-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dash-toast';
      toast.style.cssText = `position:fixed;bottom:2rem;right:2rem;background:var(--clr-navy);color:#fff;padding:1rem 1.75rem;border-radius:12px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9999;transition:all 0.4s;transform:translateY(80px);opacity:0;`;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.transform = 'translateY(80px)'; toast.style.opacity = '0'; }, 4000);
  };

  subscribeToAuthChanges(handleAuthChange);

});

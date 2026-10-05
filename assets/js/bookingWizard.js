// bookingWizard.js — 5-stage animated booking wizard
// Stage 1: Booking details  Stage 2: Preview  Stage 3: Demo payment  Stage 4: Verify identity  Stage 5: Download PDF

import { addBooking } from './firebase/firestoreService.js';
import { escapeHtml } from './bookingUtils.mjs';

let _currentUser = null;
let _currentProp = null;
let _wizardData = {};

// ─── Public init ──────────────────────────────────────────────────────────────
export function initBookingWizard(currentUser) {
  _currentUser = currentUser;
}

export function openBookingWizard(prop) {
  _currentProp = prop;
  _wizardData = {};
  document.getElementById('bwiz-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  buildStage1();
  showStage(1);
}

function closeWizard() {
  document.getElementById('bwiz-overlay').classList.remove('active');
  document.body.style.overflow = '';
  _wizardData = {};
}

// ─── Stage router ─────────────────────────────────────────────────────────────
function showStage(n) {
  document.querySelectorAll('.bwiz-stage').forEach(s => s.classList.remove('active'));
  const stage = document.getElementById(`bwiz-stage-${n}`);
  if (stage) {
    stage.classList.add('active');
    stage.scrollTop = 0;
  }
  // Update step dots
  document.querySelectorAll('.bwiz-dot').forEach((d, i) => {
    d.classList.toggle('done', i + 1 < n);
    d.classList.toggle('active', i + 1 === n);
    d.classList.remove('active-dot');
  });
  updateStepBar(n);
}

function updateStepBar(n) {
  document.querySelectorAll('.bwiz-step').forEach((s, i) => {
    s.classList.toggle('completed', i + 1 < n);
    s.classList.toggle('current', i + 1 === n);
  });
  const pct = ((n - 1) / 4) * 100;
  const bar = document.getElementById('bwiz-progress-fill');
  if (bar) bar.style.width = pct + '%';
}

// ─── Stage 1: Booking Details ─────────────────────────────────────────────────
function buildStage1() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const el = document.getElementById('bwiz-stage-1');
  el.innerHTML = `
    <div class="bwiz-stage-header">
      <div class="bwiz-stage-icon">📋</div>
      <h2>Your Stay Details</h2>
      <p>Tell us a bit about yourself and your trip</p>
    </div>
    <form id="bwiz-form-1" class="bwiz-form" novalidate>
      <div class="bwiz-field-row">
        <div class="bwiz-field">
          <label>Full Name *</label>
          <input type="text" id="bwiz-name" placeholder="e.g. Rohan Sharma" required>
        </div>
        <div class="bwiz-field">
          <label>Mobile Number *</label>
          <input type="tel" id="bwiz-mobile" placeholder="+91 98765 43210" required>
        </div>
      </div>
      <div class="bwiz-field-row">
        <div class="bwiz-field">
          <label>Check-in Date *</label>
          <input type="date" id="bwiz-checkin" min="${today}" value="${today}" required>
        </div>
        <div class="bwiz-field">
          <label>Check-out Date *</label>
          <input type="date" id="bwiz-checkout" min="${tomorrow}" value="${tomorrow}" required>
        </div>
      </div>
      <div class="bwiz-field-row">
        <div class="bwiz-field">
          <label>Number of Guests *</label>
          <input type="number" id="bwiz-guests" min="1" max="${_currentProp?.guests || 10}" value="2" required>
        </div>
        <div class="bwiz-field">
          <label>Special Requests</label>
          <input type="text" id="bwiz-special" placeholder="e.g. early check-in, sea view room">
        </div>
      </div>
      <div class="bwiz-field">
        <label>Purpose of Visit</label>
        <select id="bwiz-purpose">
          <option value="leisure">Leisure / Vacation</option>
          <option value="family">Family Trip</option>
          <option value="honeymoon">Honeymoon</option>
          <option value="friends">Friends Getaway</option>
          <option value="work">Work &amp; Leisure</option>
        </select>
      </div>
      <div id="bwiz-stay-summary" class="bwiz-stay-pill"></div>
      <div class="bwiz-actions">
        <button type="button" class="bwiz-btn-ghost" onclick="document.getElementById('bwiz-overlay').classList.remove('active');document.body.style.overflow=''">Cancel</button>
        <button type="submit" class="bwiz-btn-primary">Review Details →</button>
      </div>
    </form>`;

  const calcSummary = () => {
    const ci = document.getElementById('bwiz-checkin')?.value;
    const co = document.getElementById('bwiz-checkout')?.value;
    const g = document.getElementById('bwiz-guests')?.value;
    if (ci && co && ci < co) {
      const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
      const total = nights * (_currentProp?.price || 0);
      document.getElementById('bwiz-stay-summary').innerHTML =
        `🌊 <strong>${nights} night${nights > 1 ? 's' : ''}</strong> · ${g || 1} guest${Number(g) > 1 ? 's' : ''} · <strong>₹${total.toLocaleString('en-IN')}</strong> total`;
    } else {
      document.getElementById('bwiz-stay-summary').innerHTML = '';
    }
  };

  ['bwiz-checkin', 'bwiz-checkout', 'bwiz-guests'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', calcSummary));
  calcSummary();

  document.getElementById('bwiz-form-1').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('bwiz-name').value.trim();
    const mobile = document.getElementById('bwiz-mobile').value.trim();
    const checkin = document.getElementById('bwiz-checkin').value;
    const checkout = document.getElementById('bwiz-checkout').value;
    const guests = parseInt(document.getElementById('bwiz-guests').value) || 1;

    if (!name) return bwizAlert('Please enter your full name.');
    if (!mobile || !/^\+?[0-9\s\-]{8,15}$/.test(mobile)) return bwizAlert('Please enter a valid mobile number.');
    if (!checkin || !checkout) return bwizAlert('Please select check-in and check-out dates.');
    if (checkin >= checkout) return bwizAlert('Check-out must be after check-in.');
    if (guests < 1 || guests > (_currentProp?.guests || 10)) return bwizAlert(`Max ${_currentProp?.guests || 10} guests allowed.`);

    const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
    _wizardData = {
      name, mobile, checkin, checkout, guests, nights,
      special: document.getElementById('bwiz-special').value.trim(),
      purpose: document.getElementById('bwiz-purpose').value,
      totalPrice: nights * (_currentProp?.price || 0)
    };
    buildStage2();
    showStage(2);
  });
}

// ─── Stage 2: Preview ─────────────────────────────────────────────────────────
function buildStage2() {
  const d = _wizardData;
  const p = _currentProp;
  const formatDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('bwiz-stage-2').innerHTML = `
    <div class="bwiz-stage-header">
      <div class="bwiz-stage-icon">👁️</div>
      <h2>Review Your Booking</h2>
      <p>Please confirm all details before proceeding</p>
    </div>
    <div class="bwiz-preview-card">
      <div class="bwiz-preview-prop">
        <img src="${escapeHtml(p.image || '../assets/images/destinations/alibaug.avif')}" onerror="this.src='../assets/images/destinations/alibaug.avif'" alt="">
        <div>
          <div class="bwiz-preview-prop-title">${escapeHtml(p.title)}</div>
          <div class="bwiz-preview-prop-loc">📍 ${escapeHtml(p.location)}, Konkan</div>
          <div class="bwiz-preview-prop-type">${escapeHtml(p.type || 'Coastal Stay')}</div>
        </div>
      </div>
      <div class="bwiz-preview-grid">
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Guest Name</span><span class="bwiz-prev-val">${escapeHtml(d.name)}</span></div>
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Mobile</span><span class="bwiz-prev-val">${escapeHtml(d.mobile)}</span></div>
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Check-in</span><span class="bwiz-prev-val">${formatDate(d.checkin)}</span></div>
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Check-out</span><span class="bwiz-prev-val">${formatDate(d.checkout)}</span></div>
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Nights</span><span class="bwiz-prev-val">${d.nights}</span></div>
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Guests</span><span class="bwiz-prev-val">${d.guests}</span></div>
        <div class="bwiz-prev-item"><span class="bwiz-prev-label">Purpose</span><span class="bwiz-prev-val">${escapeHtml(d.purpose)}</span></div>
        ${d.special ? `<div class="bwiz-prev-item"><span class="bwiz-prev-label">Special Request</span><span class="bwiz-prev-val">${escapeHtml(d.special)}</span></div>` : ''}
      </div>
      <div class="bwiz-total-box">
        <span>₹${(p.price || 0).toLocaleString('en-IN')} × ${d.nights} night${d.nights > 1 ? 's' : ''}</span>
        <div class="bwiz-total-amount">₹${d.totalPrice.toLocaleString('en-IN')}</div>
      </div>
    </div>
    <div class="bwiz-actions">
      <button class="bwiz-btn-ghost" onclick="showBwizStage(1)">← Edit Details</button>
      <button class="bwiz-btn-primary" onclick="showBwizStage(3)">Proceed to Pay →</button>
    </div>`;
}

// ─── Stage 3: Demo Payment ────────────────────────────────────────────────────
function buildStage3() {
  const p = _currentProp;
  const d = _wizardData;

  document.getElementById('bwiz-stage-3').innerHTML = `
    <div class="bwiz-pay-header">
      <div class="bwiz-rzp-logo">
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#072654"/><path d="M10 28L20 8l4 8-8 4 14-2" stroke="#3395FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Secure Payment</span>
      </div>
      <div class="bwiz-pay-amount">₹${d.totalPrice.toLocaleString('en-IN')}</div>
      <div class="bwiz-pay-prop">${escapeHtml(p.title)} · ${d.nights} nights</div>
    </div>
    <div class="bwiz-pay-methods">
      <button class="bwiz-method-tab active" data-method="upi">📱 UPI</button>
      <button class="bwiz-method-tab" data-method="card">💳 Card</button>
      <button class="bwiz-method-tab" data-method="nb">🏦 Net Banking</button>
    </div>
    <div id="bwiz-pay-body">
      <div id="bwiz-upi-panel" class="bwiz-pay-panel active">
        <div class="bwiz-upi-apps">
          <button class="bwiz-upi-app" onclick="fillUpi('user@gpay')"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png" alt="GPay" onerror="this.style.display='none'"><span>GPay</span></button>
          <button class="bwiz-upi-app" onclick="fillUpi('user@phonepe')"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/PhonePe_Logo.svg/512px-PhonePe_Logo.svg.png" alt="PhonePe" onerror="this.style.display='none'"><span>PhonePe</span></button>
          <button class="bwiz-upi-app" onclick="fillUpi('user@paytm')"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/800px-Paytm_Logo_%28standalone%29.svg.png" alt="Paytm" onerror="this.style.display='none'"><span>Paytm</span></button>
        </div>
        <label style="display:block;color:rgba(255,255,255,0.6);font-size:0.8rem;margin-bottom:0.4rem;">Or enter UPI ID</label>
        <input type="text" id="bwiz-upi-id" placeholder="yourname@upi" class="bwiz-pay-input">
      </div>
      <div id="bwiz-card-panel" class="bwiz-pay-panel">
        <input type="text" placeholder="Card Number" class="bwiz-pay-input" maxlength="19" oninput="formatCardNum(this)" value="4111 1111 1111 1111">
        <div class="bwiz-field-row" style="gap:0.75rem;">
          <input type="text" placeholder="MM/YY" class="bwiz-pay-input" maxlength="5" value="12/28" style="flex:1">
          <input type="text" placeholder="CVV" class="bwiz-pay-input" maxlength="3" value="•••" style="flex:1">
        </div>
        <input type="text" placeholder="Name on Card" class="bwiz-pay-input" value="DEMO USER">
      </div>
      <div id="bwiz-nb-panel" class="bwiz-pay-panel">
        <select class="bwiz-pay-input" id="bwiz-bank-select">
          <option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option>
          <option>Axis Bank</option><option>Kotak Mahindra</option><option>Punjab National Bank</option>
        </select>
        <p style="color:rgba(255,255,255,0.4);font-size:0.78rem;margin-top:0.5rem;">You will be redirected to your bank's secure page.</p>
      </div>
    </div>
    <div class="bwiz-pay-secure-badge">🔒 256-bit SSL encrypted · Demo payment only</div>
    <div class="bwiz-actions">
      <button class="bwiz-btn-ghost" onclick="showBwizStage(2)">← Back</button>
      <button class="bwiz-btn-pay" id="bwiz-pay-btn" onclick="simulatePayment()">Pay ₹${d.totalPrice.toLocaleString('en-IN')}</button>
    </div>`;

  // Tab switching
  document.querySelectorAll('.bwiz-method-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bwiz-method-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.bwiz-pay-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`bwiz-${tab.dataset.method}-panel`)?.classList.add('active');
    });
  });
}

window.fillUpi = function(id) {
  const inp = document.getElementById('bwiz-upi-id');
  if (inp) inp.value = id;
};

window.formatCardNum = function(el) {
  el.value = el.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
};

window.showBwizStage = function(n) {
  if (n === 1) { buildStage1(); showStage(1); }
  else if (n === 2) { buildStage2(); showStage(2); }
  else if (n === 3) { buildStage3(); showStage(3); }
  else if (n === 4) { buildStage4(); showStage(4); }
  else if (n === 5) { buildStage5(); showStage(5); }
};

window.simulatePayment = function() {
  const btn = document.getElementById('bwiz-pay-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="bwiz-spinner"></span> Processing…`;

  // Show processing animation overlay
  const body = document.getElementById('bwiz-pay-body');
  if (body) {
    body.innerHTML = `
      <div class="bwiz-processing">
        <div class="bwiz-processing-ring"></div>
        <div class="bwiz-processing-ring r2"></div>
        <div class="bwiz-processing-ring r3"></div>
        <div class="bwiz-processing-icon">₹</div>
      </div>
      <p class="bwiz-processing-label">Contacting your bank…</p>`;
  }

  // Simulate steps
  const steps = ['Contacting your bank…', 'Verifying transaction…', 'Securing your booking…', 'Almost done…'];
  let i = 0;
  const interval = setInterval(() => {
    const label = document.querySelector('.bwiz-processing-label');
    if (label && steps[i]) label.textContent = steps[i++];
  }, 700);

  setTimeout(() => {
    clearInterval(interval);
    // Show success
    if (body) {
      body.innerHTML = `
        <div class="bwiz-pay-success">
          <div class="bwiz-success-ring"></div>
          <svg class="bwiz-success-check" viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path fill="none" d="M14 27l8 8 16-16"/></svg>
        </div>
        <p class="bwiz-processing-label" style="color:#6effa4;font-weight:700;">Payment Successful! 🎉</p>`;
    }
    if (btn) { btn.textContent = 'Verified ✓'; btn.style.background = 'linear-gradient(135deg,#1a6b3a,#2ecc71)'; }

    // Generate txn ID and go to stage 4
    _wizardData.txnId = 'TXN' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();
    setTimeout(() => { buildStage4(); showStage(4); }, 1200);
  }, 3000);
};

// ─── Stage 4: Identity Verification ──────────────────────────────────────────
function buildStage4() {
  const username = _currentUser?.username || _currentUser?.fullname || '';

  document.getElementById('bwiz-stage-4').innerHTML = `
    <div class="bwiz-stage-header">
      <div class="bwiz-stage-icon">🔐</div>
      <h2>Confirm Your Identity</h2>
      <p>One last step — verify your account to finalize the booking</p>
    </div>
    <div class="bwiz-id-card">
      <div class="bwiz-id-icon">👤</div>
      <div class="bwiz-field">
        <label>Username</label>
        <input type="text" id="bwiz-verify-username" value="${escapeHtml(username)}" ${username ? 'readonly' : ''} placeholder="your username" class="bwiz-pay-input ${username ? 'readonly-field' : ''}">
      </div>
      <div class="bwiz-field">
        <label>Account Password *</label>
        <div style="position:relative;">
          <input type="password" id="bwiz-verify-password" placeholder="Enter your KonkanStay password" class="bwiz-pay-input">
          <button type="button" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:1rem;" onclick="const i=document.getElementById('bwiz-verify-password');i.type=i.type==='password'?'text':'password'">👁</button>
        </div>
      </div>
      <p id="bwiz-id-error" style="color:#ff6b6b;font-size:0.82rem;min-height:1.2rem;"></p>
    </div>
    <div class="bwiz-actions">
      <button class="bwiz-btn-ghost" onclick="showBwizStage(3)">← Back</button>
      <button class="bwiz-btn-primary" id="bwiz-verify-btn" onclick="verifyAndBook()">Confirm Booking 🎉</button>
    </div>`;
}

window.verifyAndBook = async function() {
  const password = document.getElementById('bwiz-verify-password')?.value;
  const errEl = document.getElementById('bwiz-id-error');
  const btn = document.getElementById('bwiz-verify-btn');

  if (!password) { if (errEl) errEl.textContent = 'Please enter your password.'; return; }
  if (password.length < 6) { if (errEl) errEl.textContent = 'Password must be at least 6 characters.'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }

  try {
    // Re-authenticate user to verify password
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('./firebase/config.js');
    await signInWithEmailAndPassword(auth, _currentUser.email, password);

    if (errEl) errEl.textContent = '';
    if (btn) { btn.textContent = 'Saving booking…'; }

    // Save booking to Firestore
    const bookingData = {
      propId: _currentProp.id,
      propTitle: _currentProp.title,
      propLocation: _currentProp.location,
      hostEmail: _currentProp.hostEmail || '',
      customerEmail: _currentUser.email,
      customerName: _wizardData.name,
      customerMobile: _wizardData.mobile,
      checkin: _wizardData.checkin,
      checkout: _wizardData.checkout,
      guests: _wizardData.guests,
      nights: _wizardData.nights,
      totalPrice: _wizardData.totalPrice,
      purpose: _wizardData.purpose,
      specialRequest: _wizardData.special || '',
      txnId: _wizardData.txnId,
      status: 'Pending verification',
    };

    const bookingId = await addBooking(bookingData);
    _wizardData.bookingId = bookingId;
    _wizardData.bookingData = bookingData;

    buildStage5();
    showStage(5);

  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking 🎉'; }
    if (errEl) {
      if (err.code?.includes('wrong-password') || err.code?.includes('invalid-credential')) {
        errEl.textContent = 'Incorrect password. Please try again.';
      } else {
        errEl.textContent = 'Verification failed: ' + (err.message || 'Please try again.');
      }
    }
  }
};

// ─── Stage 5: Success + PDF ───────────────────────────────────────────────────
function buildStage5() {
  const d = _wizardData;
  const p = _currentProp;

  document.getElementById('bwiz-stage-5').innerHTML = `
    <div class="bwiz-success-stage">
      <div class="bwiz-confetti-wrap">
        ${Array.from({length: 20}, (_, i) => `<div class="bwiz-confetti-piece" style="--i:${i};--c:${['#8fe9ff','#ffb35c','#6effa4','#ff8fa3','#b8a1ff'][i % 5]}"></div>`).join('')}
      </div>
      <div class="bwiz-big-check">
        <div class="bwiz-check-ring"></div>
        <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path fill="none" d="M14 27l8 8 16-16"/></svg>
      </div>
      <h2 style="font-family:'Playfair Display',serif;font-size:2rem;margin:1rem 0 0.5rem;background:linear-gradient(100deg,#fff 30%,#8fe9ff 75%,#ffb35c);-webkit-background-clip:text;background-clip:text;color:transparent;">Booking Confirmed!</h2>
      <p style="color:rgba(255,255,255,0.55);margin-bottom:0.5rem;">Your coastal escape is locked in 🌊</p>
      <div class="bwiz-booking-ref">Ref: <strong>${d.bookingId || 'KS-DEMO'}</strong></div>
      <div class="bwiz-success-details">
        <span>🏠 ${escapeHtml(p.title)}</span>
        <span>📅 ${d.checkin} → ${d.checkout}</span>
        <span>💰 ₹${d.totalPrice.toLocaleString('en-IN')}</span>
      </div>
      <div class="bwiz-actions" style="justify-content:center;flex-wrap:wrap;gap:1rem;margin-top:2rem;">
        <button class="bwiz-btn-primary" onclick="downloadBookingPdf()">⬇️ Download PDF Confirmation</button>
        <button class="bwiz-btn-ghost" onclick="document.getElementById('bwiz-overlay').classList.remove('active');document.body.style.overflow='';window.location.reload();">Done</button>
      </div>
      <p style="margin-top:1rem;font-size:0.78rem;color:rgba(255,255,255,0.3);">The host will confirm within 24 hours. Check My Bookings for status updates.</p>
    </div>`;
}

// ─── PDF Generation ───────────────────────────────────────────────────────────
window.downloadBookingPdf = function() {
  const d = _wizardData;
  const p = _currentProp;
  const bd = d.bookingData || {};

  const formatDate = s => {
    const dt = new Date(s + 'T00:00:00');
    return isNaN(dt) ? s : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const now = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const win = window.open('', '_blank', 'popup,width=900,height=1200');
  if (!win) { alert('Allow pop-ups to download your booking PDF.'); return; }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>KonkanStay Booking Confirmation</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Outfit', sans-serif; background: #fff; color: #1a2e3b; }

  /* PAGE 1 */
  .page { width: 210mm; min-height: 297mm; background: #fff; position: relative; overflow: hidden; }
  .page-1 { background: linear-gradient(160deg, #03111f 0%, #072a4a 45%, #0b5e7a 100%); color: #fff; }

  /* Header */
  .hdr { padding: 14mm 16mm 10mm; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand-group { display: flex; align-items: center; gap: 10px; }
  .brand-icon { width: 48px; height: 48px; background: linear-gradient(135deg,#8fe9ff,#4fc3d9); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .brand-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #fff; }
  .brand-tag { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(143,233,255,0.7); }
  .booking-badge { background: rgba(143,233,255,0.15); border: 1px solid rgba(143,233,255,0.4); border-radius: 10px; padding: 8px 14px; text-align: right; }
  .booking-badge .bbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.55); }
  .booking-badge .bbv { font-size: 13px; font-weight: 700; color: #8fe9ff; font-family: monospace; }

  /* Hero strip */
  .hero-strip { margin: 0 16mm; background: linear-gradient(135deg, rgba(143,233,255,0.18), rgba(79,195,217,0.1)); border: 1px solid rgba(143,233,255,0.25); border-radius: 18px; padding: 18px 24px; display: flex; align-items: center; gap: 18px; }
  .hero-icon { font-size: 52px; line-height: 1; }
  .hero-title { font-family: 'Playfair Display', serif; font-size: 28px; color: #fff; margin-bottom: 4px; }
  .hero-sub { font-size: 13px; color: rgba(255,255,255,0.55); }
  .status-chip { margin-top: 8px; display: inline-block; background: linear-gradient(90deg,#1a6b3a,#2ecc71); color: #fff; border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }

  /* Property card on PDF */
  .prop-section { margin: 8mm 16mm; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px 18px; }
  .info-card-title { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 10px; }
  .info-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 7px; }
  .info-label { font-size: 11px; color: rgba(255,255,255,0.5); }
  .info-val { font-size: 12px; font-weight: 600; color: #fff; text-align: right; max-width: 130px; }

  /* Dates strip */
  .dates-strip { margin: 0 16mm; background: rgba(255,255,255,0.05); border: 1px solid rgba(143,233,255,0.2); border-radius: 14px; padding: 14px 20px; display: flex; align-items: center; gap: 0; }
  .date-block { flex: 1; text-align: center; }
  .date-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
  .date-val { font-size: 14px; font-weight: 700; color: #fff; }
  .date-sub { font-size: 10px; color: rgba(143,233,255,0.7); margin-top: 2px; }
  .date-arrow { font-size: 22px; color: rgba(143,233,255,0.5); padding: 0 10px; }

  /* Price section */
  .price-section { margin: 6mm 16mm; background: linear-gradient(135deg, rgba(255,179,92,0.15), rgba(255,179,92,0.05)); border: 1px solid rgba(255,179,92,0.3); border-radius: 14px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
  .price-breakdown { font-size: 12px; color: rgba(255,255,255,0.55); }
  .price-total-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,179,92,0.7); margin-bottom: 4px; }
  .price-total { font-size: 28px; font-weight: 800; color: #ffb35c; }
  .txn-row { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 4px; }

  /* TXN ID */
  .txn-section { margin: 4mm 16mm 0; text-align: center; }
  .txn-id { font-family: monospace; font-size: 11px; background: rgba(255,255,255,0.06); border: 1px dashed rgba(255,255,255,0.2); border-radius: 8px; padding: 6px 14px; color: rgba(255,255,255,0.5); display: inline-block; }

  /* PAGE 2 */
  .page-2 { background: #f8f7f3; }
  .p2-header { background: linear-gradient(135deg, #072a4a, #0b5e7a); color: #fff; padding: 10mm 16mm 8mm; display: flex; justify-content: space-between; align-items: center; }
  .p2-brand { font-size: 14px; font-weight: 700; color: #fff; }
  .p2-title { font-size: 16px; font-weight: 700; font-family: 'Playfair Display', serif; color: #fff; }
  .p2-body { padding: 8mm 16mm; }
  .p2-section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #0b5e7a; font-weight: 700; margin-bottom: 8px; margin-top: 14px; border-bottom: 1px solid #d0e8f0; padding-bottom: 4px; }
  .p2-terms { font-size: 10px; line-height: 1.7; color: #4a5568; }
  .p2-terms li { margin-bottom: 5px; }
  .p2-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .p2-info { background: #fff; border: 1px solid #d0e8f0; border-radius: 10px; padding: 10px 14px; }
  .p2-info .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; color: #0b5e7a; margin-bottom: 3px; }
  .p2-info .val { font-size: 12px; font-weight: 600; color: #1a2e3b; }
  .p2-footer { position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center; border-top: 1px solid #d0e8f0; padding-top: 6mm; margin: 0 16mm; }
  .p2-footer-text { font-size: 9px; color: #9aabba; }
  .qr-placeholder { width: 80px; height: 80px; background: linear-gradient(135deg,#072a4a,#0b5e7a); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #8fe9ff; font-size: 24px; }

  /* Wave decoration */
  .wave-deco { position: absolute; bottom: 0; left: 0; right: 0; opacity: 0.06; }

  @media print {
    body { background: #fff; }
    .no-print { display: none; }
    .page { page-break-after: always; }
  }
</style>
</head>
<body>

<!-- ═══════════════════ PAGE 1 ═══════════════════ -->
<div class="page page-1">
  <svg class="wave-deco" viewBox="0 0 900 120" preserveAspectRatio="none"><path d="M0 80 C 150 20, 350 120, 500 70 S 750 10, 900 60 L900 120 L0 120Z" fill="#8fe9ff"/></svg>

  <div class="hdr">
    <div class="brand-group">
      <div class="brand-icon">🌊</div>
      <div>
        <div class="brand-name">KonkanStay</div>
        <div class="brand-tag">Coastal Escapes · Maharashtra</div>
      </div>
    </div>
    <div class="booking-badge">
      <div class="bbl">Booking Reference</div>
      <div class="bbv">${escapeHtml(d.bookingId || 'KS-DEMO-' + Date.now())}</div>
    </div>
  </div>

  <div class="hero-strip">
    <div class="hero-icon">🏖️</div>
    <div>
      <div class="hero-title">${escapeHtml(p.title)}</div>
      <div class="hero-sub">📍 ${escapeHtml(p.location)}, Konkan Coast, Maharashtra</div>
      <div class="status-chip">✓ Booking Received</div>
    </div>
  </div>

  <div class="dates-strip" style="margin-top:6mm;">
    <div class="date-block">
      <div class="date-label">Check-in</div>
      <div class="date-val">${formatDate(d.checkin)}</div>
      <div class="date-sub">From 12:00 PM</div>
    </div>
    <div class="date-arrow">→</div>
    <div class="date-block">
      <div class="date-label">Check-out</div>
      <div class="date-val">${formatDate(d.checkout)}</div>
      <div class="date-sub">By 10:00 AM</div>
    </div>
    <div class="date-arrow">·</div>
    <div class="date-block">
      <div class="date-label">Duration</div>
      <div class="date-val">${d.nights} Night${d.nights > 1 ? 's' : ''}</div>
      <div class="date-sub">${d.guests} Guest${d.guests > 1 ? 's' : ''}</div>
    </div>
  </div>

  <div class="prop-section">
    <div class="info-card">
      <div class="info-card-title">Guest Information</div>
      <div class="info-row"><span class="info-label">Full Name</span><span class="info-val">${escapeHtml(d.name)}</span></div>
      <div class="info-row"><span class="info-label">Mobile</span><span class="info-val">${escapeHtml(d.mobile)}</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-val">${escapeHtml(_currentUser?.email || '')}</span></div>
      <div class="info-row"><span class="info-label">Purpose</span><span class="info-val">${escapeHtml(d.purpose || 'Leisure')}</span></div>
      ${d.special ? `<div class="info-row"><span class="info-label">Special Request</span><span class="info-val">${escapeHtml(d.special)}</span></div>` : ''}
    </div>
    <div class="info-card">
      <div class="info-card-title">Property Details</div>
      <div class="info-row"><span class="info-label">Property</span><span class="info-val">${escapeHtml(p.title)}</span></div>
      <div class="info-row"><span class="info-label">Location</span><span class="info-val">${escapeHtml(p.location)}, Konkan</span></div>
      <div class="info-row"><span class="info-label">Type</span><span class="info-val">${escapeHtml(p.type || 'Coastal Stay')}</span></div>
      <div class="info-row"><span class="info-label">Capacity</span><span class="info-val">${p.guests || 'N/A'} guests max</span></div>
      <div class="info-row"><span class="info-label">Bedrooms</span><span class="info-val">${p.bedrooms || 'N/A'}</span></div>
    </div>
  </div>

  <div class="price-section">
    <div>
      <div class="price-breakdown">₹${(p.price || 0).toLocaleString('en-IN')} per night × ${d.nights} nights</div>
      <div class="txn-row">Demo Transaction ID: ${escapeHtml(d.txnId || 'DEMO')}</div>
      <div class="txn-row">Booked on: ${now}</div>
    </div>
    <div style="text-align:right;">
      <div class="price-total-label">Total Amount</div>
      <div class="price-total">₹${d.totalPrice.toLocaleString('en-IN')}</div>
    </div>
  </div>

  <div class="txn-section">
    <span class="txn-id">TXN: ${escapeHtml(d.txnId || 'DEMO')}</span>
  </div>
</div>

<!-- ═══════════════════ PAGE 2 ═══════════════════ -->
<div class="page page-2" style="page-break-before:always;">
  <div class="p2-header">
    <div class="p2-brand">🌊 KonkanStay</div>
    <div class="p2-title">Terms, Conditions &amp; Policies</div>
  </div>
  <div class="p2-body">
    <div class="p2-section-title">Booking Summary</div>
    <div class="p2-grid">
      <div class="p2-info"><div class="lbl">Booking ID</div><div class="val">${escapeHtml(d.bookingId || 'KS-DEMO')}</div></div>
      <div class="p2-info"><div class="lbl">Status</div><div class="val">Pending Host Confirmation</div></div>
      <div class="p2-info"><div class="lbl">Payment</div><div class="val">Demo Payment (₹${d.totalPrice.toLocaleString('en-IN')})</div></div>
      <div class="p2-info"><div class="lbl">Date Issued</div><div class="val">${now}</div></div>
    </div>

    <div class="p2-section-title">Cancellation Policy</div>
    <ul class="p2-terms">
      <li><strong>Free cancellation:</strong> Cancel up to 7 days before check-in for a full refund.</li>
      <li><strong>Partial refund:</strong> Cancellations 3–7 days before check-in receive a 50% refund.</li>
      <li><strong>No refund:</strong> Cancellations within 72 hours of check-in are non-refundable.</li>
      <li>All cancellations must be submitted through the KonkanStay platform.</li>
    </ul>

    <div class="p2-section-title">House Rules</div>
    <ul class="p2-terms">
      <li>Check-in time: 12:00 PM · Check-out time: 10:00 AM. Late check-out may incur additional charges.</li>
      <li>No smoking inside the property premises. Smoking is only allowed in designated outdoor areas.</li>
      <li>Parties and events are strictly prohibited without prior written approval from the host.</li>
      <li>Guests are responsible for any damage caused to the property during their stay.</li>
      <li>Pets are allowed only if explicitly stated in the property listing. Please confirm with the host.</li>
      <li>Noise levels must be kept to a minimum between 10:00 PM and 8:00 AM.</li>
    </ul>

    <div class="p2-section-title">Payment &amp; Disclaimers</div>
    <ul class="p2-terms">
      <li>This document is a booking confirmation only and is not a tax invoice or payment receipt.</li>
      <li>KonkanStay does not process or hold payments on behalf of hosts or guests.</li>
      <li>All payment disputes must be resolved directly between the guest and the host.</li>
      <li>This is a demonstration booking system. No real financial transaction has occurred.</li>
      <li>KonkanStay reserves the right to cancel bookings that violate platform policies.</li>
    </ul>

    <div class="p2-section-title">Emergency &amp; Support</div>
    <ul class="p2-terms">
      <li>For urgent issues during your stay, contact KonkanStay support: <strong>support@konkanstay.com</strong></li>
      <li>Maharashtra Tourism Helpline: <strong>1800-111-363</strong></li>
      <li>Local Police Emergency: <strong>100</strong> · Medical Emergency: <strong>108</strong></li>
    </ul>
  </div>

  <div class="p2-footer">
    <div class="p2-footer-text">© ${new Date().getFullYear()} KonkanStay · Coastal Escapes, Maharashtra · Booking ID: ${escapeHtml(d.bookingId || 'KS-DEMO')} · Generated: ${now}</div>
    <div class="p2-footer-text" style="margin-top:4px;">This document is computer-generated and does not require a signature.</div>
  </div>
</div>

<script>
  window.addEventListener('load', () => {
    window.focus();
    setTimeout(() => window.print(), 400);
  });
<\/script>
</body>
</html>`);
  win.document.close();
};

// ─── Mount wizard HTML ─────────────────────────────────────────────────────────
export function mountBookingWizard() {
  if (document.getElementById('bwiz-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'bwiz-overlay';
  overlay.innerHTML = `
    <div class="bwiz-modal" role="dialog" aria-modal="true" aria-label="Booking Wizard">
      <button class="bwiz-close" onclick="document.getElementById('bwiz-overlay').classList.remove('active');document.body.style.overflow='';" aria-label="Close">&times;</button>

      <!-- Progress bar -->
      <div class="bwiz-progress-bar"><div class="bwiz-progress-fill" id="bwiz-progress-fill"></div></div>

      <!-- Step indicators -->
      <div class="bwiz-steps">
        <div class="bwiz-step" data-step="1"><div class="bwiz-step-dot">1</div><div class="bwiz-step-label">Details</div></div>
        <div class="bwiz-step-line"></div>
        <div class="bwiz-step" data-step="2"><div class="bwiz-step-dot">2</div><div class="bwiz-step-label">Review</div></div>
        <div class="bwiz-step-line"></div>
        <div class="bwiz-step" data-step="3"><div class="bwiz-step-dot">3</div><div class="bwiz-step-label">Payment</div></div>
        <div class="bwiz-step-line"></div>
        <div class="bwiz-step" data-step="4"><div class="bwiz-step-dot">4</div><div class="bwiz-step-label">Verify</div></div>
        <div class="bwiz-step-line"></div>
        <div class="bwiz-step" data-step="5"><div class="bwiz-step-dot">5</div><div class="bwiz-step-label">Done</div></div>
      </div>

      <!-- Stages -->
      <div class="bwiz-stages-wrap">
        <div class="bwiz-stage" id="bwiz-stage-1"></div>
        <div class="bwiz-stage" id="bwiz-stage-2"></div>
        <div class="bwiz-stage" id="bwiz-stage-3"></div>
        <div class="bwiz-stage" id="bwiz-stage-4"></div>
        <div class="bwiz-stage" id="bwiz-stage-5"></div>
      </div>
    </div>`;

  // Inject CSS
  const style = document.createElement('style');
  style.innerHTML = `
    #bwiz-overlay {
      display:none; position:fixed; inset:0; z-index:10000;
      background:rgba(2,8,20,0.88); backdrop-filter:blur(18px);
      align-items:center; justify-content:center; padding:1rem;
    }
    #bwiz-overlay.active { display:flex; animation:bwiz-bg-in .3s ease; }
    @keyframes bwiz-bg-in { from{opacity:0} }

    .bwiz-modal {
      background:linear-gradient(160deg,#0b1f3a,#061428);
      border:1px solid rgba(143,233,255,0.2);
      border-radius:24px;
      box-shadow:0 40px 100px rgba(0,0,0,0.7),0 0 60px rgba(79,195,217,0.08);
      width:100%; max-width:640px; max-height:90vh;
      overflow-y:auto; position:relative;
      animation:bwiz-modal-in .4s cubic-bezier(.2,.8,.2,1) both;
    }
    @keyframes bwiz-modal-in { from{opacity:0;transform:translateY(40px) scale(.96)} }

    .bwiz-close {
      position:sticky; top:1rem; float:right; margin-right:1rem;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
      color:#fff; font-size:1.4rem; width:36px; height:36px;
      border-radius:50%; cursor:pointer; z-index:10; display:flex;
      align-items:center; justify-content:center; transition:background .2s;
    }
    .bwiz-close:hover { background:rgba(255,255,255,0.16); }

    .bwiz-progress-bar {
      height:3px; background:rgba(255,255,255,0.08);
      border-radius:3px; margin:1rem 1.5rem;
    }
    .bwiz-progress-fill {
      height:100%; width:0%;
      background:linear-gradient(90deg,#8fe9ff,#ffb35c);
      border-radius:3px; transition:width .5s ease;
    }

    .bwiz-steps {
      display:flex; align-items:center; padding:0 1.5rem 1rem;
    }
    .bwiz-step { display:flex; flex-direction:column; align-items:center; gap:4px; }
    .bwiz-step-dot {
      width:28px; height:28px; border-radius:50%;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      color:rgba(255,255,255,0.35); font-size:0.75rem; font-weight:700;
      display:flex; align-items:center; justify-content:center; transition:.3s;
    }
    .bwiz-step.current .bwiz-step-dot {
      background:linear-gradient(135deg,#8fe9ff,#4fc3d9); color:#04202e;
      border-color:transparent; box-shadow:0 0 16px rgba(143,233,255,0.5);
    }
    .bwiz-step.completed .bwiz-step-dot {
      background:linear-gradient(135deg,#1a6b3a,#2ecc71); color:#fff; border-color:transparent;
    }
    .bwiz-step-label { font-size:0.6rem; color:rgba(255,255,255,0.35); text-transform:uppercase; letter-spacing:.08em; }
    .bwiz-step.current .bwiz-step-label { color:rgba(143,233,255,0.8); }
    .bwiz-step-line { flex:1; height:1px; background:rgba(255,255,255,0.1); margin-bottom:16px; }

    .bwiz-stages-wrap { padding:0 1.5rem 1.5rem; }
    .bwiz-stage { display:none; }
    .bwiz-stage.active { display:block; animation:bwiz-stage-in .35s ease; }
    @keyframes bwiz-stage-in { from{opacity:0;transform:translateX(20px)} }

    .bwiz-stage-header { text-align:center; margin-bottom:1.5rem; }
    .bwiz-stage-icon { font-size:2.5rem; margin-bottom:0.5rem; }
    .bwiz-stage-header h2 {
      font-family:'Playfair Display',serif; font-size:1.6rem; color:#fff;
      background:linear-gradient(100deg,#fff 30%,#8fe9ff);
      -webkit-background-clip:text; background-clip:text; color:transparent;
    }
    .bwiz-stage-header p { color:rgba(255,255,255,0.45); font-size:0.88rem; margin-top:0.25rem; }

    .bwiz-form { display:flex; flex-direction:column; gap:0.85rem; }
    .bwiz-field { display:flex; flex-direction:column; gap:0.35rem; }
    .bwiz-field label { font-size:0.78rem; font-weight:600; color:rgba(255,255,255,0.55); text-transform:uppercase; letter-spacing:.06em; }
    .bwiz-field input, .bwiz-field select {
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
      border-radius:12px; padding:0.7rem 1rem; color:#fff; font-family:'Outfit',sans-serif;
      font-size:0.9rem; width:100%; transition:border-color .2s, box-shadow .2s;
    }
    .bwiz-field input:focus, .bwiz-field select:focus {
      outline:none; border-color:rgba(143,233,255,0.5);
      box-shadow:0 0 0 3px rgba(143,233,255,0.12);
    }
    .bwiz-field-row { display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; }
    .bwiz-stay-pill {
      background:rgba(143,233,255,0.08); border:1px solid rgba(143,233,255,0.2);
      border-radius:10px; padding:0.6rem 1rem; font-size:0.88rem; color:rgba(255,255,255,0.75);
      text-align:center; min-height:2.5rem;
    }

    .bwiz-actions { display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.25rem; }
    .bwiz-btn-primary {
      background:linear-gradient(135deg,#8fe9ff,#4fc3d9); color:#04202e;
      font-weight:700; border:0; border-radius:12px; padding:0.7rem 1.5rem;
      cursor:pointer; font-family:'Outfit',sans-serif; font-size:0.9rem;
      transition:transform .2s, box-shadow .2s;
    }
    .bwiz-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(143,233,255,0.35); }
    .bwiz-btn-ghost {
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
      color:rgba(255,255,255,0.6); border-radius:12px; padding:0.7rem 1.25rem;
      cursor:pointer; font-family:'Outfit',sans-serif; font-size:0.9rem; transition:.2s;
    }
    .bwiz-btn-ghost:hover { background:rgba(255,255,255,0.1); color:#fff; }

    /* Preview */
    .bwiz-preview-card {
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
      border-radius:18px; overflow:hidden;
    }
    .bwiz-preview-prop {
      display:flex; gap:1rem; align-items:center;
      padding:1rem; background:rgba(143,233,255,0.06); border-bottom:1px solid rgba(255,255,255,0.08);
    }
    .bwiz-preview-prop img { width:80px; height:60px; object-fit:cover; border-radius:10px; }
    .bwiz-preview-prop-title { font-weight:700; color:#fff; font-size:0.95rem; }
    .bwiz-preview-prop-loc { font-size:0.8rem; color:rgba(255,255,255,0.45); margin-top:2px; }
    .bwiz-preview-prop-type { font-size:0.72rem; background:rgba(143,233,255,0.15); color:#8fe9ff; padding:2px 8px; border-radius:20px; display:inline-block; margin-top:4px; }
    .bwiz-preview-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; }
    .bwiz-prev-item { padding:0.65rem 1rem; border-bottom:1px solid rgba(255,255,255,0.05); }
    .bwiz-prev-item:nth-child(odd) { border-right:1px solid rgba(255,255,255,0.05); }
    .bwiz-prev-label { font-size:0.7rem; text-transform:uppercase; letter-spacing:.07em; color:rgba(255,255,255,0.4); display:block; margin-bottom:2px; }
    .bwiz-prev-val { font-size:0.88rem; color:#fff; font-weight:600; }
    .bwiz-total-box {
      display:flex; justify-content:space-between; align-items:center;
      padding:1rem; background:rgba(255,179,92,0.08); border-top:1px solid rgba(255,179,92,0.2);
      font-size:0.88rem; color:rgba(255,255,255,0.55);
    }
    .bwiz-total-amount { font-size:1.6rem; font-weight:800; color:#ffb35c; }

    /* Payment */
    .bwiz-pay-header {
      background:linear-gradient(135deg,rgba(7,38,84,0.8),rgba(11,94,122,0.6));
      border:1px solid rgba(51,149,255,0.2); border-radius:16px;
      padding:1.2rem 1.5rem; text-align:center; margin-bottom:1rem;
    }
    .bwiz-rzp-logo { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:0.5rem; color:rgba(255,255,255,0.7); font-size:0.85rem; font-weight:600; }
    .bwiz-pay-amount { font-size:2rem; font-weight:800; color:#fff; }
    .bwiz-pay-prop { font-size:0.78rem; color:rgba(255,255,255,0.4); margin-top:4px; }
    .bwiz-pay-methods { display:flex; gap:0.5rem; margin-bottom:1rem; }
    .bwiz-method-tab {
      flex:1; padding:0.55rem; background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.1); border-radius:10px;
      color:rgba(255,255,255,0.55); cursor:pointer; font-family:'Outfit',sans-serif;
      font-size:0.8rem; transition:.2s;
    }
    .bwiz-method-tab.active { background:rgba(143,233,255,0.15); border-color:rgba(143,233,255,0.4); color:#8fe9ff; }
    .bwiz-pay-panel { display:none; flex-direction:column; gap:0.75rem; }
    .bwiz-pay-panel.active { display:flex; }
    .bwiz-pay-input {
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
      border-radius:12px; padding:0.7rem 1rem; color:#fff;
      font-family:'Outfit',sans-serif; font-size:0.9rem; width:100%;
    }
    .bwiz-pay-input:focus { outline:none; border-color:rgba(143,233,255,0.5); }
    .bwiz-upi-apps { display:flex; gap:0.75rem; margin-bottom:0.75rem; }
    .bwiz-upi-app {
      flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
      border-radius:12px; padding:0.7rem 0.5rem; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; gap:4px;
      color:rgba(255,255,255,0.7); font-size:0.75rem; transition:.2s;
    }
    .bwiz-upi-app:hover { background:rgba(255,255,255,0.1); }
    .bwiz-upi-app img { width:32px; height:32px; object-fit:contain; }
    .bwiz-pay-secure-badge {
      text-align:center; font-size:0.72rem; color:rgba(255,255,255,0.3);
      margin:0.75rem 0; padding:0.5rem;
      background:rgba(255,255,255,0.03); border-radius:8px;
    }
    .bwiz-btn-pay {
      background:linear-gradient(135deg,#1a6b3a,#2ecc71); color:#fff;
      font-weight:800; border:0; border-radius:12px; padding:0.85rem 2rem;
      cursor:pointer; font-family:'Outfit',sans-serif; font-size:1rem;
      transition:transform .2s, box-shadow .2s; display:flex; align-items:center; gap:8px;
    }
    .bwiz-btn-pay:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(46,204,113,0.4); }

    /* Processing animation */
    .bwiz-processing {
      position:relative; width:100px; height:100px; margin:1.5rem auto;
    }
    .bwiz-processing-ring {
      position:absolute; inset:0; border-radius:50%;
      border:3px solid transparent; border-top-color:#8fe9ff;
      animation:bwiz-spin 1s linear infinite;
    }
    .bwiz-processing-ring.r2 { inset:10px; border-top-color:#ffb35c; animation-duration:0.7s; animation-direction:reverse; }
    .bwiz-processing-ring.r3 { inset:20px; border-top-color:#6effa4; animation-duration:0.5s; }
    .bwiz-processing-icon {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-size:1.5rem; font-weight:800; color:#8fe9ff;
    }
    @keyframes bwiz-spin { to{transform:rotate(360deg)} }
    .bwiz-processing-label { text-align:center; color:rgba(255,255,255,0.55); font-size:0.88rem; margin-bottom:1rem; }

    /* Success animation */
    .bwiz-pay-success { position:relative; width:90px; height:90px; margin:1.5rem auto; }
    .bwiz-success-ring {
      position:absolute; inset:0; border-radius:50%;
      border:3px solid #2ecc71; animation:bwiz-success-pop .5s ease forwards;
    }
    @keyframes bwiz-success-pop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
    .bwiz-pay-success svg { position:absolute; inset:0; width:90px; height:90px; }
    .bwiz-pay-success path { stroke:#2ecc71; stroke-width:4; stroke-dasharray:58; stroke-dashoffset:58; animation:bwiz-draw .5s .4s ease forwards; }
    @keyframes bwiz-draw { to{stroke-dashoffset:0} }

    .bwiz-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:bwiz-spin .7s linear infinite; }

    /* Verify stage */
    .bwiz-id-card {
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
      border-radius:16px; padding:1.5rem; display:flex; flex-direction:column; gap:1rem;
    }
    .bwiz-id-icon { font-size:2rem; text-align:center; }
    .readonly-field { opacity:0.6; cursor:not-allowed; }

    /* Success stage */
    .bwiz-success-stage { text-align:center; padding:1rem 0 0.5rem; position:relative; overflow:hidden; }
    .bwiz-confetti-wrap { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
    .bwiz-confetti-piece {
      position:absolute; width:8px; height:12px; background:var(--c);
      top:-20px; left:calc(var(--i) * 5% + 2%);
      border-radius:2px; opacity:0;
      animation:bwiz-fall calc(1.5s + var(--i) * 0.1s) calc(var(--i) * 0.08s) ease-in forwards;
    }
    @keyframes bwiz-fall {
      0% { top:-20px; opacity:1; transform:rotate(0deg) translateX(0); }
      100% { top:110%; opacity:0; transform:rotate(calc(var(--i) * 30deg)) translateX(calc(var(--i) * 2px - 20px)); }
    }
    .bwiz-big-check { position:relative; width:90px; height:90px; margin:0 auto 1rem; }
    .bwiz-check-ring {
      position:absolute; inset:0; border-radius:50%;
      background:linear-gradient(135deg,rgba(46,204,113,0.2),rgba(46,204,113,0.05));
      border:2px solid #2ecc71; animation:bwiz-check-ring-pop .6s cubic-bezier(.2,1.2,.3,1) forwards;
    }
    @keyframes bwiz-check-ring-pop { from{transform:scale(0)} to{transform:scale(1)} }
    .bwiz-big-check svg { position:absolute; inset:0; width:90px; height:90px; }
    .bwiz-big-check circle { stroke:rgba(46,204,113,0.3); }
    .bwiz-big-check path { stroke:#2ecc71; stroke-width:4; stroke-dasharray:60; stroke-dashoffset:60; animation:bwiz-draw .6s .5s ease forwards; }
    .bwiz-booking-ref {
      display:inline-block; background:rgba(143,233,255,0.1); border:1px solid rgba(143,233,255,0.25);
      border-radius:10px; padding:0.4rem 1rem; font-size:0.82rem;
      color:rgba(255,255,255,0.55); margin-bottom:1rem; font-family:monospace;
    }
    .bwiz-success-details {
      display:flex; flex-wrap:wrap; justify-content:center; gap:0.75rem; margin-bottom:1rem;
    }
    .bwiz-success-details span {
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
      border-radius:20px; padding:0.3rem 0.85rem; font-size:0.8rem; color:rgba(255,255,255,0.65);
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeWizard(); });
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function bwizAlert(msg) {
  const existing = document.getElementById('bwiz-alert');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'bwiz-alert';
  el.style.cssText = 'background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.35);color:#ff8a8a;padding:0.6rem 0.9rem;border-radius:10px;font-size:0.82rem;margin-top:-0.5rem;';
  el.textContent = msg;
  document.getElementById('bwiz-form-1')?.prepend(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

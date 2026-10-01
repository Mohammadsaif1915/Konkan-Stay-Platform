/**
 * KonkanStay — main.js
 * Landing Page JavaScript | Stage 1
 * Vanilla JS only. No frameworks.
 */

// ── DOM Ready ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initScrollReveal();
  initWishlist();
  initHeroScroll();
  initSearchDates();
});

// ══════════════════════════════════════════════════════════════════════════
// 1. NAVBAR — transparent → solid on scroll
// ══════════════════════════════════════════════════════════════════════════
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const SCROLL_THRESHOLD = 60;

  function updateNavbar() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      navbar.classList.add('nav-scrolled');
      navbar.classList.remove('nav-transparent');
    } else {
      navbar.classList.remove('nav-scrolled');
      navbar.classList.add('nav-transparent');
    }
  }

  // Initial state
  navbar.classList.add('nav-transparent');
  updateNavbar();

  window.addEventListener('scroll', updateNavbar, { passive: true });
}

// ══════════════════════════════════════════════════════════════════════════
// 2. MOBILE MENU toggle
// ══════════════════════════════════════════════════════════════════════════
function initMobileMenu() {
  const toggle  = document.getElementById('nav-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggle || !mobileNav) return;

  let isOpen = false;

  function openMenu() {
    isOpen = true;
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    mobileNav.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    isOpen = false;
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    isOpen ? closeMenu() : openMenu();
  });

  // Close on mobile link click
  mobileNav.querySelectorAll('.mobile-nav-link, .btn-mobile-full').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !toggle.contains(e.target) && !mobileNav.contains(e.target)) {
      closeMenu();
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 3. SCROLL REVEAL — animate elements into view
// ══════════════════════════════════════════════════════════════════════════
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Animate once
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    }
  );

  revealEls.forEach(el => observer.observe(el));
}

// ══════════════════════════════════════════════════════════════════════════
// 4. WISHLIST — heart toggle (UI only in Stage 1)
// ══════════════════════════════════════════════════════════════════════════
function initWishlist() {
  document.querySelectorAll('.stay-wishlist').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      this.classList.toggle('active');
      const icon = this.querySelector('svg');
      if (icon) {
        // Subtle scale animation
        icon.style.transform = 'scale(1.3)';
        setTimeout(() => { icon.style.transform = 'scale(1)'; }, 200);
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 5. HERO SCROLL — smooth scroll to next section
// ══════════════════════════════════════════════════════════════════════════
function initHeroScroll() {
  const scrollBtn = document.getElementById('hero-scroll');
  if (!scrollBtn) return;

  scrollBtn.addEventListener('click', () => {
    const destinations = document.getElementById('destinations');
    if (destinations) {
      destinations.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 6. SEARCH DATE FIELDS — set min dates to today
// ══════════════════════════════════════════════════════════════════════════
function initSearchDates() {
  const checkin  = document.getElementById('search-checkin');
  const checkout = document.getElementById('search-checkout');
  if (!checkin || !checkout) return;

  const today = getLocalDateString();
  checkin.min  = today;
  checkout.min = today;

  checkin.addEventListener('change', () => {
    if (checkin.value) {
      checkout.min = checkin.value;
      if (checkout.value && checkout.value < checkin.value) {
        checkout.value = '';
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 7. AUTH-AWARE NAVBAR — swap login button for profile avatar on sign-in
// ══════════════════════════════════════════════════════════════════════════
import { subscribeToAuthChanges, logoutUser, getUserProfile } from './firebase/authService.js';
import { escapeHtml, getLocalDateString } from './bookingUtils.mjs';

(function initAuthNav() {
  const navActions    = document.getElementById('nav-actions');
  const mobileActions = document.getElementById('mobile-nav-actions');
  const isPagesRoute  = window.location.pathname.split('/').includes('pages');
  const pagePrefix    = isPagesRoute ? '' : 'pages/';
  const homeHref      = isPagesRoute ? '../index.html' : 'index.html';
  const hostCtaHref   = `${homeHref}#host-cta`;

  function getInitials(str) {
    if (!str) return '?';
    const parts = str.trim().split(/[\s@_.\-]+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
  }

  function renderLoggedIn(user, profile) {
    const displayName = profile?.username || profile?.fullname || user.email.split('@')[0];
    const initials    = getInitials(displayName);
    const role        = profile?.userType || 'customer';
    const dashHref    = `${pagePrefix}${role === 'host' ? 'dashboard-host.html' : 'dashboard-customer.html'}`;
    const searchHref  = `${pagePrefix}search.html`;
    const shortName   = displayName.length > 14 ? displayName.slice(0, 13) + '…' : displayName;

    // ── Desktop ────────────────────────────────────────────────
    if (navActions) {
      navActions.innerHTML = `
        <div class="nav-profile" id="nav-profile" aria-haspopup="true" aria-expanded="false">
          <div class="nav-avatar">${escapeHtml(initials)}</div>
          <span class="nav-profile-name">${escapeHtml(shortName)}</span>
          <svg class="nav-profile-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <div class="nav-profile-dropdown" role="menu">
            <div class="dropdown-user-info">
              <div class="dropdown-user-label">Signed in as</div>
              <div class="dropdown-user-email">${escapeHtml(user.email)}</div>
              <span class="dropdown-user-role ${role}">${role === 'host' ? '🏠 Host' : '🧳 Traveler'}</span>
            </div>
            <a href="${dashHref}" class="dropdown-item" role="menuitem">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              ${role === 'host' ? 'Host Dashboard' : 'My Bookings'}
            </a>
            <a href="${searchHref}" class="dropdown-item" role="menuitem">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Search Properties
            </a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" id="btn-signout" role="menuitem">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        </div>`;

      const profileEl = document.getElementById('nav-profile');
      profileEl?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileEl.classList.toggle('open');
        profileEl.setAttribute('aria-expanded', isOpen);
      });
      document.addEventListener('click', () => profileEl?.classList.remove('open'));

      document.getElementById('btn-signout')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await logoutUser();
        window.location.reload();
      });
    }

    // ── Mobile ─────────────────────────────────────────────────
    if (mobileActions) {
      mobileActions.innerHTML = `
        <div style="padding:0.5rem 1rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:0.5rem;">
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.25rem;">Signed in as</div>
          <div style="font-size:0.88rem;color:rgba(255,255,255,0.85);font-weight:500;">${escapeHtml(displayName)}</div>
        </div>
        <a href="${dashHref}" class="btn-mobile-full btn-mobile-host" style="margin-bottom:0.4rem;">
          ${role === 'host' ? 'Host Dashboard' : 'My Bookings'}
        </a>
        <button class="btn-mobile-full btn-mobile-login" id="btn-mobile-signout"
          style="background:rgba(180,40,40,0.18);border-color:rgba(200,50,50,0.3);color:#ff8a8a;">
          Sign Out
        </button>`;

      document.getElementById('btn-mobile-signout')?.addEventListener('click', async () => {
        await logoutUser();
        window.location.reload();
      });
    }
  }

  function renderLoggedOut() {
    if (navActions) {
      navActions.innerHTML = `
        <a href="${pagePrefix}login.html" class="btn-nav-login">Login</a>
        <a href="${hostCtaHref}" class="btn-nav-host">List Your Property</a>`;
    }
    if (mobileActions) {
      mobileActions.innerHTML = `
        <a href="${pagePrefix}login.html" class="btn-mobile-full btn-mobile-login">Login</a>
        <a href="${hostCtaHref}" class="btn-mobile-full btn-mobile-host">List Your Property</a>`;
    }
  }

  subscribeToAuthChanges(async (user) => {
    if (user) {
      let profile = null;
      try { profile = await getUserProfile(user.uid); } catch (_) {}
      renderLoggedIn(user, profile);
    } else {
      renderLoggedOut();
    }
  });
})();


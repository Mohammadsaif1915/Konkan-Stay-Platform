import { registerUser, loginUser, getUserProfile } from './firebase/authService.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── Toast notification system (works regardless of CSS class names) ────────
  function showToast(msg, type = 'error') {
    // Try the dedicated auth-alert element first
    const alertEl = document.getElementById('auth-alert');
    if (alertEl) {
      alertEl.textContent = msg;
      alertEl.style.cssText = type === 'success'
        ? 'display:block;padding:0.85rem 1rem;border-radius:10px;font-size:0.875rem;font-weight:500;margin-bottom:0.5rem;background:rgba(46,204,113,0.15);border:1px solid rgba(46,204,113,0.35);color:#6effa4;'
        : 'display:block;padding:0.85rem 1rem;border-radius:10px;font-size:0.875rem;font-weight:500;margin-bottom:0.5rem;background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.35);color:#ff8a8a;';
      alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    // Fallback: floating toast
    let toast = document.getElementById('__ks_toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '__ks_toast';
      toast.style.cssText = 'position:fixed;top:1.5rem;left:50%;transform:translateX(-50%);z-index:9999;max-width:420px;width:90%;padding:1rem 1.25rem;border-radius:12px;font-family:inherit;font-size:0.9rem;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:opacity 0.3s;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === 'success' ? 'rgba(46,204,113,0.9)' : 'rgba(200,50,50,0.9)';
    toast.style.color = '#fff';
    toast.style.opacity = '1';
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    if (type !== 'success') {
      toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 4000);
    }
  }

  function hideAlert() {
    const alertEl = document.getElementById('auth-alert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }
  }

  function friendlyFirebaseError(code = '') {
    if (code.includes('email-already-in-use'))   return 'This email is already registered. Try logging in instead.';
    if (code.includes('weak-password'))           return 'Password is too weak. Use at least 8 characters.';
    if (code.includes('invalid-email'))           return 'Please enter a valid email address.';
    if (code.includes('too-many-requests'))       return 'Too many attempts. Please wait a moment and try again.';
    if (code.includes('user-not-found'))          return 'No account found with this email. Please register first.';
    if (code.includes('wrong-password'))          return 'Incorrect password. Please try again.';
    if (code.includes('invalid-credential'))      return 'Incorrect email or password. Please try again.';
    if (code.includes('network'))                 return 'Network error. Check your connection and try again.';
    return null;
  }

  function getSafeBookingReturn() {
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    if (!returnTo) return null;
    try {
      const returnUrl = new URL(returnTo, window.location.href);
      if (returnUrl.origin !== window.location.origin
        || !returnUrl.pathname.endsWith('/pages/search.html')) return null;
      return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
    } catch {
      return null;
    }
  }

  // ── REGISTRATION ────────────────────────────────────────────────────────────
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email           = document.getElementById('email')?.value.trim() || '';
      const password        = document.getElementById('password')?.value || '';
      const confirmPassword = document.getElementById('confirm-password')?.value || '';
      const userType        = document.querySelector('input[name="userType"]:checked')?.value || 'customer';
      const username        = document.getElementById('username')?.value.trim() || '';

      // ── Client-side validation ──────────────────────────────────────────────
      if (userType === 'customer') {
        if (!username)                      { showToast('Please enter a username.'); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) { showToast('Username can only contain letters, numbers and underscores.'); return; }
      }
      if (!email)                           { showToast('Please enter your email address.'); return; }
      if (password.length < 8)              { showToast('Password must be at least 8 characters.'); return; }
      if (password !== confirmPassword)     { showToast('Passwords do not match!'); return; }

      // ── Build profile object ────────────────────────────────────────────────
      const profile = { email, userType };
      if (userType === 'customer') {
        profile.username = username;
      }

      if (userType === 'host') {
        const fullname = document.getElementById('fullname')?.value.trim() || '';
        const phone    = document.getElementById('phone')?.value.trim() || '';
        const surveyNo = document.getElementById('survey-no')?.value.trim() || '';

        if (!fullname) { showToast('Full legal name is required.'); return; }
        if (!phone)    { showToast('Phone number is required.'); return; }
        if (!surveyNo) { showToast('Property Survey/Registration No. is required.'); return; }

        Object.assign(profile, { fullname, phone, surveyNo });
      }

      // ── Submit ──────────────────────────────────────────────────────────────
      const btn = document.getElementById('btn-register');
      const origText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Creating Account…'; btn.disabled = true; }

      try {
        await registerUser(email, password, profile);
        showToast('🎉 Account created! Redirecting to login…', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 500);
      } catch (err) {
        console.error('[KonkanStay Register Error]', err);
        const msg = friendlyFirebaseError(err.code) || err.message || 'Registration failed. Please try again.';
        showToast(msg);
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }
    });
  }

  // ── LOGIN ───────────────────────────────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email    = document.getElementById('email')?.value.trim() || '';
      const password = document.getElementById('password')?.value || '';

      if (!email)    { showToast('Please enter your email address.'); return; }
      if (!password) { showToast('Please enter your password.'); return; }

      const btn = document.getElementById('btn-login');
      const origText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

      try {
        const firebaseUser = await loginUser(email, password);
        showToast('Signed in. Opening your account…', 'success');

        const profile = await Promise.race([
          getUserProfile(firebaseUser.uid).catch(() => null),
          new Promise(resolve => setTimeout(() => resolve(null), 1500))
        ]);

        const dest = getSafeBookingReturn()
          || ((profile?.userType === 'host') ? 'dashboard-host.html' : 'dashboard-customer.html');
        window.location.assign(new URL(dest, window.location.href).href);

      } catch (err) {
        console.error('[KonkanStay Login Error]', err);
        const msg = friendlyFirebaseError(err.code) || 'Incorrect email or password. Please try again.';
        showToast(msg);
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }
    });
  }

});

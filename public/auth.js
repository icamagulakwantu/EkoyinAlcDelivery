// ═══════════════════════════════════════════════
// EKOYINI — Supabase Auth wrapper (auth.js)
// Load the Supabase JS SDK (CDN) BEFORE this file, then this file BEFORE
// script.js on any page that needs auth:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="auth.js"></script>
//   <script src="script.js"></script>
// ═══════════════════════════════════════════════

// Safe to expose client-side — this is the public anon key, not a secret.
const SUPABASE_URL = 'https://ahntznqdxmgjasckcknj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobnR6bnFkeG1namFzY2tja25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDA2MTUsImV4cCI6MjEwNTA3NjYxNX0.8S-wEJATUmU90WxlhIDwnGsB-UwcDspo3wgQMlqos6E';

const ekoyiniAuth = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Re-broadcast Supabase's auth state as a plain DOM event so any page can
// react without importing Supabase types directly.
ekoyiniAuth.auth.onAuthStateChange((_event, session) => {
  window.dispatchEvent(new CustomEvent('ekoyini:auth-changed', { detail: { session } }));
});

async function getSession() {
  const { data } = await ekoyiniAuth.auth.getSession();
  return data.session;
}

// Redirect to login if not signed in. Call at the top of any auth-gated
// page. Pass the current page so login can send the user back afterward.
async function requireAuth(redirectTo) {
  const session = await getSession();
  if (!session) {
    const back = redirectTo || window.location.pathname.split('/').pop();
    window.location.href = `login.html?redirect=${encodeURIComponent(back)}`;
    return null;
  }
  return session;
}

async function signUp(email, password) {
  const { data, error } = await ekoyiniAuth.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await ekoyiniAuth.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await ekoyiniAuth.auth.signOut();
}

// fetch() wrapper that auto-attaches the current session's bearer token.
async function authedFetch(url, options = {}) {
  const session = await getSession();
  const headers = { ...(options.headers || {}) };
  if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
  return fetch(url, { ...options, headers });
}

// Populates any <div id="navAuthSlot"> in a page's navbar with a "Log In"
// pill (signed out) or an avatar + name chip (signed in). Call once on
// page load, and it re-runs automatically on every auth state change.
async function renderNavAuth() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;
  const session = await getSession();
  if (session) {
    const name = session.user.email.split('@')[0];
    slot.innerHTML = `<a href="profile.html" class="nav-auth-chip">
      <span class="nav-auth-avatar">${name[0].toUpperCase()}</span>
      <span class="nav-auth-name">${name}</span>
    </a>`;
  } else {
    slot.innerHTML = `<a href="login.html" class="nav-auth-chip nav-auth-pill">Log In</a>`;
  }
}
window.addEventListener('ekoyini:auth-changed', renderNavAuth);

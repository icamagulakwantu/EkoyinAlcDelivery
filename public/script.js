// ═══════════════════════════════════════════════
// EKOYINI — Global script.js
// Shared utilities across all pages
// ═══════════════════════════════════════════════

// ── Cart ─────────────────────────────────────────
const EkoyiniCart = {
  // A corrupted value (manual edit, old app version) must never break every page.
  get() {
    try {
      const v = JSON.parse(localStorage.getItem('ekoyini_cart') || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  },
  save(cart) {
    localStorage.setItem('ekoyini_cart', JSON.stringify(cart));
    broadcastCartChange();
  },
  // Reconcile device-stored cart IDs against the live catalogue. Catalogue
  // refreshes can retire/recreate SKU rows while a customer's browser still
  // has the previous IDs saved locally. Never submit those stale IDs.
  reconcile(products) {
    const validIds = new Set((Array.isArray(products) ? products : []).map(p => String(p.id)));
    const saved = this.get();
    const clean = {};
    let removed = 0;
    Object.entries(saved).forEach(([id, qty]) => {
      const amount = Number(qty);
      if (validIds.has(String(id)) && Number.isSafeInteger(amount) && amount > 0) clean[id] = amount;
      else removed++;
    });
    if (removed) this.save(clean);
    return { cart: clean, removed };
  },
  count() { return Object.values(this.get()).reduce((a, b) => a + (Number(b) || 0), 0); },
  clear() {
    localStorage.removeItem('ekoyini_cart');
    broadcastCartChange();
  }
};

// ── Address ──────────────────────────────────────
const EkoyiniAddress = {
  get() { return localStorage.getItem('ekoyini_address') || ''; },
  save(v) { localStorage.setItem('ekoyini_address', v); }
};

// ── Age gate (shared across pages) ────────────────
// index.html owns the actual gate UI (full-screen overlay, shown on
// first run). Any other page that shows alcohol — shop, cart — calls
// this first so a shared/bookmarked deep link can't skip verification.
// Redirects to index.html with a return path; ageGateConfirm() there
// sends the user back once they've confirmed.
function requireAgeGate() {
  if (localStorage.getItem('ekoyini_age_verified') === 'true') return true;
  const ret = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `index.html?return=${ret}`;
  return false;
}

// ── Favorites (per-device, like the cart) ─────────
const EkoyiniFavorites = {
  get() {
    try {
      const v = JSON.parse(localStorage.getItem('ekoyini_favorites') || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  },
  has(skuId) { return this.get().includes(skuId); },
  toggle(skuId) {
    const favs = this.get();
    const idx = favs.indexOf(skuId);
    if (idx === -1) favs.push(skuId); else favs.splice(idx, 1);
    localStorage.setItem('ekoyini_favorites', JSON.stringify(favs));
    return idx === -1; // true if just added
  }
};

// ── Cross-tab live sync ──────────────────────────
// Any page that mutates the cart calls broadcastCartChange(). Pages
// listening for 'ekoyini:cart-updated' re-render without a refresh. The
// native 'storage' event fires only in *other* tabs, so we re-dispatch it
// as the same custom event to keep the handling logic in one place.
function broadcastCartChange() {
  window.dispatchEvent(new CustomEvent('ekoyini:cart-updated'));
}
window.addEventListener('storage', (e) => {
  if (e.key === 'ekoyini_cart') broadcastCartChange();
});

// ── Toast (bottom, default) ──────────────────────
// Optional action, e.g. showToast('Removed', 4000, { label: 'Undo', onClick })
// — the pattern big delivery apps use instead of "are you sure?" dialogs.
function showToast(msg, duration = 2400, action = null) {
  let t = document.getElementById('toastEl');
  if (!t) { t = document.createElement('div'); t.id = 'toastEl'; t.className = 'toast'; document.body.appendChild(t); }
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = '';
  const text = document.createElement('span');
  text.textContent = msg;
  t.appendChild(text);
  t.classList.toggle('has-action', !!action);
  if (action && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label || 'Undo';
    btn.onclick = () => { t.classList.remove('show'); action.onClick(); };
    t.appendChild(btn);
  }
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Toast (top, Instagram-style slide-down) — used for cart adds ──
function showToastTop(msg, duration = 1600) {
  let t = document.getElementById('toastTopEl');
  if (!t) { t = document.createElement('div'); t.id = 'toastTopEl'; t.className = 'toast-top'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Small shared helpers ─────────────────────────
// Anything from the database or the user goes through this before innerHTML.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// R1 234.50 — South African formatting, always two decimals.
function formatRand(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return 'R' + safe.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, '.').replace(/ /g, ' ');
}

// Same rule as normalizeSaPhone in lib/order-rules.js (the server's check).
function isValidSaPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return (digits.length === 10 && digits.startsWith('0'))
    || (digits.length === 11 && digits.startsWith('27'))
    || (digits.length === 9 && !digits.startsWith('0'));
}

// Database category keys → names people actually say.
const CATEGORY_LABELS = {
  BEER: 'Beer', CIDER_RTD: 'Cider & RTDs', BRANDY: 'Brandy', WHISKY: 'Whisky', COGNAC: 'Cognac',
  GIN: 'Gin', VODKA: 'Vodka', VODKA_PREMIUM: 'Premium Vodka', TEQUILA: 'Tequila',
  TEQUILA_PREMIUM: 'Premium Tequila', LIQUEUR: 'Liqueurs', RUM: 'Rum', WINE: 'Wine',
  WINE_BOX: 'Boxed Wine', SPARKLING: 'Sparkling Wine', CHAMPAGNE: 'Champagne',
  MIXER: 'Mixers', ENERGY_DRINK: 'Energy Drinks', WATER: 'Water', ICE: 'Ice',
};
function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || String(cat || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Hour of day in South Africa (UTC+2, no daylight saving), whatever the
// phone's own time zone is set to.
function saHour(now = new Date()) {
  return new Date(now.getTime() + 2 * 3600 * 1000).getUTCHours();
}

// Remembered checkout contact details (this device only).
const EkoyiniContact = {
  get() { try { return JSON.parse(localStorage.getItem('ekoyini_contact') || '{}'); } catch { return {}; } },
  save(c) { try { localStorage.setItem('ekoyini_contact', JSON.stringify(c)); } catch {} },
};

// ── Dev tool: find dead ends on the current page ──
// Run auditDeadEnds() in devtools on any page. Flags (and outlines in red)
// href="#" links with no click handler, onclick handlers that reference an
// undefined function, and inert buttons with neither onclick nor a type
// that submits a form.
function auditDeadEnds() {
  const issues = [];

  document.querySelectorAll('a[href="#"]').forEach((el) => {
    if (!el.onclick && !el.getAttribute('onclick')) {
      issues.push({ el, reason: 'href="#" with no click handler' });
    }
  });

  document.querySelectorAll('[onclick]').forEach((el) => {
    const call = el.getAttribute('onclick');
    const fnName = (call.match(/^([a-zA-Z0-9_$]+)\s*\(/) || [])[1];
    if (fnName && typeof window[fnName] !== 'function') {
      issues.push({ el, reason: `onclick calls undefined function "${fnName}()"` });
    }
  });

  document.querySelectorAll('button').forEach((el) => {
    if (!el.onclick && !el.getAttribute('onclick') && el.type !== 'submit' && !el.closest('label')) {
      issues.push({ el, reason: 'button with no onclick and not type="submit"' });
    }
  });

  issues.forEach(({ el }) => { el.style.outline = '2px solid red'; });
  console.table(issues.map(({ el, reason }) => ({ tag: el.tagName, text: el.textContent.trim().slice(0, 40), reason })));
  console.log(`auditDeadEnds: ${issues.length} issue(s) found and outlined in red.`);
  return issues;
}
window.auditDeadEnds = auditDeadEnds;

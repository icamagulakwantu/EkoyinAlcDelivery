// ═══════════════════════════════════════════════
// EKOYINI — Global script.js
// Shared utilities across all pages
// ═══════════════════════════════════════════════

// ── Cart ─────────────────────────────────────────
const EkoyiniCart = {
  get() { return JSON.parse(localStorage.getItem('ekoyini_cart') || '{}'); },
  save(cart) {
    localStorage.setItem('ekoyini_cart', JSON.stringify(cart));
    broadcastCartChange();
  },
  count() { return Object.values(this.get()).reduce((a, b) => a + b, 0); },
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
  get() { return JSON.parse(localStorage.getItem('ekoyini_favorites') || '[]'); },
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
function showToast(msg, duration = 2000) {
  let t = document.getElementById('toastEl');
  if (!t) { t = document.createElement('div'); t.id = 'toastEl'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
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

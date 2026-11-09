// admin/order-alerts.js
//
// New-order alerts for the dispatch team. Every person with the admin
// dashboard open (phone or computer) gets, for each new order:
//   - a flashing banner at the top of the dashboard,
//   - a sound and a vibration,
//   - a system notification (if they allowed notifications),
//   - "(2) New orders" in the browser tab title.
// While an order is still waiting for a driver after REMIND_AFTER_MIN
// minutes, the alert repeats every REMIND_EVERY_MIN minutes.
//
// Browsers only allow sound and notifications after a tap, so each person
// taps "Turn on order alerts" once per device. The choice is remembered.
//
// Limit: this works while the dashboard is open in a tab (it can be in the
// background). A closed browser gets nothing; email alerts cover that.

(function () {
  const STORE_SEEN = 'ekoyini_admin_seen_orders';
  const STORE_ON = 'ekoyini_admin_alerts_on';
  const REMIND_AFTER_MIN = 3;
  const REMIND_EVERY_MIN = 3;
  const WAITING = new Set(['PENDING', 'PAYMENT_PENDING']);

  let seen = null; // Set of order codes already announced on this device
  let lastReminder = 0;
  let audioCtx = null;
  let unread = 0;
  const baseTitle = document.title;

  function readSeen() {
    try { return new Set(JSON.parse(localStorage.getItem(STORE_SEEN) || '[]')); } catch { return new Set(); }
  }
  function saveSeen() {
    try { localStorage.setItem(STORE_SEEN, JSON.stringify([...seen].slice(-500))); } catch {}
  }
  function alertsOn() {
    try { return localStorage.getItem(STORE_ON) === 'true'; } catch { return false; }
  }

  // Short two-tone chime made in the browser (no sound file to load).
  function chime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      [[880, 0], [1320, 0.18], [880, 0.5], [1320, 0.68]].forEach(([freq, at]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + at);
        gain.gain.exponentialRampToValueAtTime(0.4, t + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.16);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t + at);
        osc.stop(t + at + 0.18);
      });
    } catch {}
  }

  function money(n) { return 'R' + Number(n || 0).toFixed(2); }

  // Area only (last part of the address, no house number): what dispatch
  // needs at a glance, and safe to show on a lock screen.
  function areaOf(order) {
    const parts = String(order.address || '').split(',').map((s) => s.trim()).filter(Boolean);
    const last = (parts.length > 1 ? parts[parts.length - 1] : '').replace(/^\d+[a-z]?\s+/i, '').trim();
    return last || 'area on the order';
  }

  function payLabel(order) {
    if (order.status === 'PAYMENT_PENDING') return 'EFT, waiting for payment';
    return { card: 'Paid by card', cod: 'Cash on delivery', eft: 'EFT paid' }[order.paymentMethod] || order.paymentMethod;
  }

  function banner(text, sub) {
    let el = document.getElementById('orderAlertBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'orderAlertBanner';
      el.setAttribute('role', 'alert');
      el.innerHTML = '<div class="oab-text"><strong></strong><span></span></div><button type="button" class="oab-close" aria-label="Dismiss">Got it</button>';
      el.querySelector('.oab-close').onclick = (e) => { e.stopPropagation(); clearUnread(); el.classList.remove('show'); };
      el.onclick = () => {
        clearUnread();
        el.classList.remove('show');
        const tab = document.getElementById('sectionTabOrders');
        if (tab && typeof window.showSection === 'function') window.showSection('orders', tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      document.body.appendChild(el);
    }
    el.querySelector('strong').textContent = text;
    el.querySelector('span').textContent = sub || '';
    el.classList.add('show');
  }

  function notify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, tag, renotify: true, icon: '/images/brand/favicon-192.png' });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      // Android Chrome only shows notifications through a service worker.
      navigator.serviceWorker?.getRegistration?.().then((reg) => reg && reg.showNotification(title, { body, tag, renotify: true, icon: '/images/brand/favicon-192.png' })).catch(() => {});
    }
  }

  function setTitle() {
    document.title = unread > 0 ? `(${unread}) New order${unread === 1 ? '' : 's'} · ${baseTitle}` : baseTitle;
  }
  function clearUnread() { unread = 0; setTitle(); }

  function ring(title, body, tag) {
    if (!alertsOn()) return;
    chime();
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {}
    notify(title, body, tag);
  }

  // Called by admin-api.js after every /orders load.
  function onOrders(orders) {
    if (!Array.isArray(orders)) return;
    const first = seen === null;
    if (first) seen = readSeen();

    const fresh = orders.filter((o) => WAITING.has(o.status) && !seen.has(o.code));
    // First load on a new device: remember what's there without ringing for
    // old orders, but still show what is waiting.
    if (first && seen.size === 0) {
      orders.forEach((o) => seen.add(o.code));
      saveSeen();
    } else if (fresh.length) {
      fresh.forEach((o) => seen.add(o.code));
      saveSeen();
      unread += fresh.length;
      setTitle();
      const o = fresh[0];
      const more = fresh.length > 1 ? ` (+${fresh.length - 1} more)` : '';
      const title = `New order ${o.code}${more}`;
      const body = `${money(o.total)} · ${areaOf(o)} · ${payLabel(o)}`;
      banner(title, body + ' · tap to view');
      ring(title, body, 'new-order');
      return;
    }

    // Reminder: orders still without a driver after a few minutes.
    const now = Date.now();
    const stale = orders.filter((o) => o.status === 'PENDING' && !o.driverName && now - new Date(o.createdAt).getTime() > REMIND_AFTER_MIN * 60000);
    if (stale.length && now - lastReminder > REMIND_EVERY_MIN * 60000) {
      lastReminder = now;
      const oldest = stale[stale.length - 1];
      const mins = Math.round((now - new Date(oldest.createdAt).getTime()) / 60000);
      const title = `${stale.length} order${stale.length === 1 ? '' : 's'} still need a driver`;
      const body = `Oldest: ${oldest.code}, waiting ${mins} min · ${areaOf(oldest)}`;
      banner(title, body);
      ring(title, body, 'waiting');
    }
  }

  // ── "Turn on order alerts" switch in the dashboard header ──
  function renderSwitch() {
    const holder = document.getElementById('orderAlertSwitch');
    if (!holder) return;
    const on = alertsOn();
    const blocked = 'Notification' in window && Notification.permission === 'denied';
    holder.innerHTML = on
      ? `<button type="button" class="alert-switch on" title="Tap to turn off on this device">🔔 Order alerts on</button>${blocked ? '<small>Notifications are blocked in this browser: sound and banner only</small>' : ''}`
      : '<button type="button" class="alert-switch">🔕 Turn on order alerts</button>';
    holder.querySelector('button').onclick = on ? turnOff : turnOn;
  }

  async function turnOn() {
    try { localStorage.setItem(STORE_ON, 'true'); } catch {}
    // Unlock sound on this tap (browsers block audio until a user gesture).
    chime();
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    renderSwitch();
    if (typeof window.startAutoRefresh === 'function') window.startAutoRefresh();
  }
  function turnOff() {
    try { localStorage.setItem(STORE_ON, 'false'); } catch {}
    renderSwitch();
  }

  window.EkoyiniOrderAlerts = { onOrders, alertsOn, renderSwitch, areaOf };
  document.addEventListener('DOMContentLoaded', renderSwitch);
  renderSwitch();
})();

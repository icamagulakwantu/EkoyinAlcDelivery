// ============================================
// ADMIN: DELAY ALERTS BAR (founder, 18 Nov 2026)
// ============================================
// Every 30 seconds: orders that sit still (no driver, not collected, driver's
// location silent, out for delivery too long). Amber at the limit, red at
// twice the limit. A red alert also plays a short sound. The team also gets
// an email from the server, so alerts arrive even with Admin closed.
(function () {
  const POLL_MS = 30000;
  let lastReds = new Set();
  let audioCtx = null;

  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      [0, 0.25, 0.5].forEach((at) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = 520;
        gain.gain.setValueAtTime(0.0001, t + at);
        gain.gain.exponentialRampToValueAtTime(0.35, t + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t + at);
        osc.stop(t + at + 0.2);
      });
    } catch {}
  }

  function bar() {
    let el = document.getElementById('dispatchAlerts');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dispatchAlerts';
      el.setAttribute('role', 'status');
      const orders = document.getElementById('ordersSection');
      if (orders) orders.insertBefore(el, orders.firstChild);
    }
    return el;
  }

  const ACTION = {
    NOT_ASSIGNED: 'Assign a driver',
    NOT_PICKED_UP: 'Call the tavern and the driver',
    LOCATION_SILENT: 'Call the driver',
    DELIVERY_SLOW: 'Call the driver, then the customer',
  };

  async function check() {
    if (typeof adminFetch !== 'function' || document.body.classList.contains('admin-locked')) return;
    try {
      const res = await adminFetch('/admin/alerts');
      if (!res.ok) return;
      const list = await res.json();
      const el = bar();
      if (!list.length) { el.innerHTML = ''; el.className = ''; lastReds = new Set(); return; }
      const reds = new Set(list.filter((a) => a.level === 'red').map((a) => `${a.code}:${a.kind}`));
      if ([...reds].some((k) => !lastReds.has(k))) beep();
      lastReds = reds;
      el.className = 'da-bar' + (reds.size ? ' da-red' : '');
      el.innerHTML = `<b>${list.length} order${list.length === 1 ? '' : 's'} need attention</b>` + list.map((a) => `
        <div class="da-row da-${esc(a.level)}">
          <span class="da-code">${esc(a.code)}</span>
          <span class="da-text">${esc(a.text)} · ${esc(a.minutes)} min${a.driverName ? ` · ${esc(a.driverName)}` : ''}${a.tavern ? ` · ${esc(a.tavern)}` : ''}</span>
          <span class="da-act">${esc(ACTION[a.kind] || '')}</span>
        </div>`).join('');
    } catch (err) {
      console.error('alerts', err);
    }
  }

  setInterval(check, POLL_MS);
  setTimeout(check, 3000);
})();

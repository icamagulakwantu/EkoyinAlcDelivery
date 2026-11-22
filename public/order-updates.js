// "Get updates on this phone" for the customer's tracking page (22 Nov 2026).
// One tap saves this phone for ONE order: we then tell the customer when it is packed, out for
// delivery (with the live link) and delivered, even with the browser closed. Free web push.
// iPhone needs Ekoyini added to the Home Screen first. See lib/customer-push.js.
(function () {
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = () => window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const storeKey = (code) => 'ekoyini_order_updates_' + code;
  const isOn = (code) => { try { return localStorage.getItem(storeKey(code)) === 'on'; } catch { return false; } };

  function keyBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function subscribe(code) {
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return 'blocked';
    const cfg = await (await fetch('/api/push/key')).json();
    if (!cfg.enabled || !cfg.publicKey) return 'server-off';
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const want = keyBytes(cfg.publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey) {
      const have = new Uint8Array(sub.options.applicationServerKey);
      if (have.length !== want.length || have.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
    const res = await fetch(`/api/order/${encodeURIComponent(code)}/push-subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    return res.ok ? 'on' : 'error';
  }

  // Draws the button (or a short hint) into `slot`. Returns nothing; safe to call on every refresh.
  function mount(slot, code) {
    if (!slot) return;
    slot.innerHTML = '';
    const note = (text) => { const p = document.createElement('p'); p.className = 'track-help'; p.style.cssText = 'font-size:12px;opacity:.8;margin:6px 0 0;'; p.textContent = text; slot.appendChild(p); };
    if (isOn(code) && supported() && Notification.permission === 'granted') return note('🔔 Updates are on for this order on this phone.');
    if (!supported()) return isIphone() && !installed() ? note('Want phone updates? On iPhone tap Share, then Add to Home Screen, and open Ekoyini from there.') : undefined;
    if (Notification.permission === 'denied') return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'track-again';
    btn.textContent = '🔔 Get updates on this phone';
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = 'Turning on…';
      let state = 'error';
      try { state = await subscribe(code); } catch { state = 'error'; }
      if (state === 'on') { try { localStorage.setItem(storeKey(code), 'on'); } catch {} return mount(slot, code); }
      btn.disabled = false;
      btn.textContent = '🔔 Get updates on this phone';
      note(state === 'blocked' ? 'Notifications are blocked for this site. Allow them in your browser settings.' : 'Could not turn on updates. Please try again.');
    };
    slot.appendChild(btn);
  }

  window.EkoyiniOrderUpdates = { mount, isOn };
})();

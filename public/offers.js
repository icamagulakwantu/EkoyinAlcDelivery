// Tells the pages whether this customer still gets the Cooler Box discount
// (first 5 orders only, founder 19 Nov 2026). Signed-out visitors are treated
// as new customers. The server makes the real decision when the order is
// priced, so this only keeps the screens honest.
(function () {
  var state = (window.EkoyiniOffers = { coolerAllowed: true, ordersLeft: null, loaded: false });
  var css = document.createElement('style');
  css.textContent = '.no-cooler #coolerBar,.no-cooler #hxCooler,.no-cooler .hx-promo.p1{display:none!important}';
  document.head.appendChild(css);

  async function load() {
    try {
      if (typeof getSession !== 'function' || typeof authedFetch !== 'function') return;
      var session = await getSession();
      if (!session) return;
      var res = await authedFetch('/api/my-offers');
      if (!res.ok) return;
      var d = await res.json();
      state.coolerAllowed = d.coolerAllowed !== false;
      state.ordersLeft = d.coolerOrdersLeft;
      state.loaded = true;
      document.documentElement.classList.toggle('no-cooler', !state.coolerAllowed);
      window.dispatchEvent(new Event('ekoyini:offers'));
    } catch (e) { /* offers are a nicety; the server decides */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
  window.addEventListener('ekoyini:auth-changed', load);
})();

// ═══════════════════════════════════════════════
// EKOYINI — address suggestions while typing (founder, 18 Nov 2026)
// Google Places (New) autocomplete, limited to Nelson Mandela Bay. Attaches
// to every <input data-address-suggest>. Does nothing at all until the
// GOOGLE_MAPS_API_KEY is set on the server (/api/maps-config), so the plain
// address box keeps working without it. Only street addresses are filled in;
// the delivery pin and landmark still come from the customer.
// ═══════════════════════════════════════════════
(function () {
  // Nelson Mandela Bay (Gqeberha, Kariega, Motherwell, Despatch...).
  const NMB = { south: -34.06, west: 25.30, north: -33.66, east: 25.92 };
  let placesLib = null;
  let loading = null;

  async function loadPlaces() {
    if (placesLib) return placesLib;
    if (loading) return loading;
    loading = (async () => {
      const res = await fetch('/api/maps-config');
      const { key } = res.ok ? await res.json() : {};
      if (!key) return null;
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__ekoyiniMaps&region=ZA&language=en`;
        s.async = true;
        window.__ekoyiniMaps = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      placesLib = await google.maps.importLibrary('places');
      return placesLib;
    })().catch((err) => { console.warn('[address] suggestions unavailable', err); return null; });
    return loading;
  }

  function attach(input) {
    if (input.dataset.suggestReady) return;
    input.dataset.suggestReady = '1';
    input.setAttribute('autocomplete', 'off');
    const wrap = input.parentElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    const list = document.createElement('div');
    list.className = 'addr-suggest';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    wrap.appendChild(list);

    let session = null;
    let timer = null;
    let lastQuery = '';
    let items = [];

    const close = () => { list.hidden = true; list.innerHTML = ''; items = []; };

    async function search(q) {
      const lib = await loadPlaces();
      if (!lib || q !== input.value.trim()) return;
      session = session || new lib.AutocompleteSessionToken();
      try {
        const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: session,
          includedRegionCodes: ['za'],
          locationRestriction: NMB,
          language: 'en',
        });
        if (q !== input.value.trim()) return;
        items = (suggestions || []).map((s) => s.placePrediction).filter(Boolean).slice(0, 5);
        if (!items.length) { close(); return; }
        list.innerHTML = items.map((p, i) => `<button type="button" role="option" data-i="${i}"><b></b><span></span></button>`).join('');
        [...list.children].forEach((btn, i) => {
          btn.querySelector('b').textContent = items[i].mainText ? items[i].mainText.text : items[i].text.text;
          btn.querySelector('span').textContent = items[i].secondaryText ? items[i].secondaryText.text : '';
          btn.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
        });
        list.hidden = false;
      } catch (err) {
        console.warn('[address] lookup failed', err);
        close();
      }
    }

    async function pick(i) {
      const p = items[i];
      if (!p) return;
      let text = p.text ? p.text.text : input.value;
      try {
        // Ends the billing session; formattedAddress reads cleaner than the prediction.
        const place = p.toPlace();
        await place.fetchFields({ fields: ['formattedAddress'] });
        if (place.formattedAddress) text = place.formattedAddress.replace(/,\s*South Africa$/, '');
      } catch {}
      session = null;
      input.value = text;
      close();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 3 || q === lastQuery) { if (q.length < 3) close(); return; }
      timer = setTimeout(() => { lastQuery = q; search(q); }, 250);
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function scan() { document.querySelectorAll('input[data-address-suggest]').forEach(attach); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  window.EkoyiniAddressSuggest = { scan };
})();

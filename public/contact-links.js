// WhatsApp and call links between customer, driver and dispatcher (founder approved 22 Nov 2026).
// One-tap click-to-chat (free): the message is pre-filled with the live tracking link, the person taps send.
// Used by the customer track page, the driver app and the admin dashboard. Works in the browser and in Node tests.
(function (root) {
  // "071 973 6683" and "+27 71 973 6683" both become 27719736683.
  function waNumber(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (d.length === 10 && d.startsWith('0')) return '27' + d.slice(1);
    if (d.length === 11 && d.startsWith('27')) return d;
    if (d.length === 9 && !d.startsWith('0')) return '27' + d;
    return '';
  }
  const waLink = (phone, text) => { const n = waNumber(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text || '')}` : ''; };
  const telLink = (phone) => { const n = waNumber(phone); return n ? `tel:+${n}` : ''; };
  const trackUrl = (origin, code) => `${origin}/track.html?code=${encodeURIComponent(code)}`;
  const first = (name) => String(name || '').trim().split(/\s+/)[0];

  // Customer to driver (only offered while the order is out for delivery).
  const customerToDriver = ({ driverName, code }) =>
    `Hi ${first(driverName) || 'driver'}, I'm the customer for Ekoyini order ${code}. `;

  // Driver to customer: includes the live tracking link, so the customer can follow the driver on the map.
  const driverToCustomer = ({ customerName, driverName, code, origin }) =>
    `Hi ${first(customerName) || 'there'}, it's ${first(driverName) || 'your driver'} from Ekoyini. I'm on my way with your order ${code}. Follow me live here: ${trackUrl(origin, code)}`;

  // Dispatch to customer: tracking link, plus who is bringing it once a driver is assigned.
  const dispatchToCustomer = ({ customerName, code, driverName, driverVehicle, origin }) =>
    `Hi ${first(customerName) || 'there'}, this is Ekoyini about your order ${code}.` +
    (driverName ? ` ${driverName}${driverVehicle ? ` (${driverVehicle})` : ''} is delivering it.` : '') +
    ` Follow it live here: ${trackUrl(origin, code)}`;

  // Dispatch to driver (a quick check-in on a job that is already assigned).
  const dispatchToDriver = ({ driverName, code }) =>
    `Hi ${first(driverName) || 'driver'}, Ekoyini dispatch here about order ${code}. `;

  // Google Maps link to the driver's last position, only while it is fresh (default 10 minutes).
  function driverMapUrl(order, now = Date.now(), maxAgeMs = 10 * 60 * 1000) {
    if (!order || order.driverLat == null || order.driverLng == null || !order.driverLocationAt) return '';
    if (now - new Date(order.driverLocationAt).getTime() > maxAgeMs) return '';
    return `https://www.google.com/maps?q=${Number(order.driverLat)},${Number(order.driverLng)}`;
  }

  const api = { waNumber, waLink, telLink, trackUrl, customerToDriver, driverToCustomer, dispatchToCustomer, dispatchToDriver, driverMapUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EkoyiniContact = api;
})(typeof window !== 'undefined' ? window : globalThis);

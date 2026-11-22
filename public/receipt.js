// Receipts and time stamps (founder, 22 Nov 2026): every order gets a detailed receipt that proves what was
// ordered, when it was ordered and when the driver delivered it. Shared by the emails (server), the printable
// receipt page, the track page and the admin card. All times are South African time.
(function (root) {
  const SELLER = {
    tradingName: 'Ekoyini Holdings (Pty) Ltd',
    legalName: 'K2020465422 (South Africa) (Pty) Ltd',
    registration: '2020/465422/07',
    address: '7 Torquay Street, Summerstrand, Gqeberha, 6001',
    whatsapp: '064 004 5465',
    email: 'support@ekoyini.co.za',
    website: 'www.ekoyini.co.za',
    vatNote: 'We are not yet registered for VAT, so this receipt is not a tax invoice and no VAT is included.',
  };
  const PAYMENT_LABEL = { card: 'Card (Yoco)', eft: 'EFT', cod: 'Cash on delivery' };

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'R' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
  const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

  function parts(date, withSeconds) {
    const o = { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    if (withSeconds) o.second = '2-digit';
    return new Intl.DateTimeFormat('en-GB', o).formatToParts(new Date(date)).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  }
  // "22 Nov 2026, 14:07:32" (South African time)
  function stamp(date) {
    if (!date) return '';
    const p = parts(date, true);
    return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}:${p.second}`;
  }
  // "22 Nov 14:07"
  function shortStamp(date) {
    if (!date) return '';
    const p = parts(date, false);
    return `${p.day} ${p.month} ${p.hour}:${p.minute}`;
  }
  function duration(from, to) {
    if (!from || !to) return '';
    const mins = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)} h ${mins % 60} min`;
  }

  // The stages that have a time. Cash orders show "pay on delivery" until the order is delivered.
  function timelineRows(o) {
    const rows = [{ key: 'ordered', label: 'Order placed', at: o.createdAt }];
    if (o.paymentMethod === 'cod') rows.push({ key: 'paid', label: 'Payment', at: o.deliveredAt, note: o.deliveredAt ? 'Cash paid on delivery' : 'Cash on delivery' });
    else rows.push({ key: 'paid', label: 'Payment received', at: o.paidAt });
    rows.push({ key: 'ready', label: 'Packed and ready at the outlet', at: o.readyAt });
    rows.push({ key: 'assigned', label: 'Driver assigned', at: o.assignedAt });
    rows.push({ key: 'collected', label: 'Collected by the driver', at: o.pickedUpAt });
    rows.push({ key: 'delivered', label: 'Delivered (driver confirmed)', at: o.deliveredAt });
    return rows.filter((r) => r.at || r.key === 'delivered' || r.key === 'ordered');
  }

  function buildReceipt(o) {
    const items = (o.items || []).map((i) => ({ name: i.name, quantity: Number(i.quantity), unit: r2(i.price), line: r2(i.price * i.quantity) }));
    const subtotal = r2(items.reduce((s, i) => s + i.line, 0));
    const lines = [];
    const add = (label, amount) => { if (amount && Math.abs(amount) >= 0.005) lines.push({ label, amount: r2(amount) }); };
    if (o.promoDiscount) add(`Promo${o.promoCode ? ' ' + o.promoCode : ''}`, -o.promoDiscount);
    add('Delivery', o.deliveryFee);
    add('Busy-time surge', o.surgeFee);
    add('Super Priority', o.priorityFee);
    add('Care & Handling', o.serviceFee);
    add('Safety Seal', o.safetySealFee);
    add('Bottles & crates (returnable)', o.bottleDepositFee);
    const accounted = r2(subtotal + lines.reduce((s, l) => s + l.amount, 0));
    const rest = r2(Number(o.total || 0) - accounted);
    if (rest < -0.005) lines.push({ label: 'Discount (Cooler Box)', amount: rest });
    else if (rest > 0.005) lines.push({ label: 'Other charges', amount: rest });
    const delivered = !!o.deliveredAt;
    return {
      code: o.code,
      status: o.status,
      title: o.status === 'CANCELLED' ? 'Cancelled order' : delivered ? 'Delivery receipt' : 'Order receipt',
      seller: SELLER,
      customerName: o.customerName || '',
      address: o.address || '',
      landmark: o.landmark || '',
      outlet: o.tavern ? `${o.tavern.name} (${o.tavern.area})` : '',
      driver: o.driverName ? `${o.driverName}${o.driverVehicle ? ' (' + o.driverVehicle + ')' : ''}` : '',
      payment: PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod || '',
      items, subtotal, lines, total: r2(o.total),
      timeline: timelineRows(o).map((r) => ({ ...r, stamp: stamp(r.at) })),
      orderedAt: stamp(o.createdAt),
      deliveredAt: delivered ? stamp(o.deliveredAt) : '',
      orderToDelivery: duration(o.createdAt, o.deliveredAt),
      pickupToDelivery: duration(o.pickedUpAt, o.deliveredAt),
    };
  }

  // Inline-styled so it works in email clients and on the printable page.
  function renderReceiptHtml(r, opts = {}) {
    const td = 'padding:4px 0;font-size:13px;color:#333;';
    const tdr = td + 'text-align:right;white-space:nowrap;';
    const items = r.items.map((i) => `<tr><td style="${td}">${esc(i.name)} × ${i.quantity}<div style="font-size:11px;color:#888;">${money(i.unit)} each</div></td><td style="${tdr}">${money(i.line)}</td></tr>`).join('');
    const lines = r.lines.map((l) => `<tr><td style="${td}">${esc(l.label)}</td><td style="${tdr}">${l.amount < 0 ? '-' : ''}${money(Math.abs(l.amount))}</td></tr>`).join('');
    const times = r.timeline.map((t) => `<tr><td style="${td}">${esc(t.label)}${t.note ? `<div style="font-size:11px;color:#888;">${esc(t.note)}</div>` : ''}</td><td style="${tdr}">${t.stamp ? esc(t.stamp) : '<span style="color:#aaa;">not yet</span>'}</td></tr>`).join('');
    const proof = r.deliveredAt
      ? `<div style="background:#eef7f0;border:1px solid #b7dfc2;border-radius:8px;padding:12px;margin:14px 0;text-align:center;">
          <div style="font-size:11px;color:#2d6a3e;text-transform:uppercase;letter-spacing:.5px;">Delivered</div>
          <div style="font-size:16px;font-weight:700;color:#14532d;">${esc(r.deliveredAt)}</div>
          <div style="font-size:12px;color:#2d6a3e;">Ordered ${esc(r.orderedAt)}${r.orderToDelivery ? ` · ${esc(r.orderToDelivery)} from order to door` : ''}${r.pickupToDelivery ? ` · ${esc(r.pickupToDelivery)} from pickup` : ''}</div>
        </div>`
      : `<div style="background:#f7f4ec;border-radius:8px;padding:12px;margin:14px 0;text-align:center;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Order placed</div>
          <div style="font-size:16px;font-weight:700;color:#222;">${esc(r.orderedAt)}</div>
          <div style="font-size:12px;color:#888;">${r.status === 'CANCELLED' ? 'This order was cancelled.' : 'You will get this receipt again with the delivery time once it arrives.'}</div>
        </div>`;
    const s = r.seller;
    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="font-size:18px;font-weight:700;color:#222;">${esc(r.title)}</div>
        <div style="font-size:12px;color:#888;margin-bottom:4px;">Receipt for order <b style="font-family:monospace;color:#cc3700;">${esc(r.code)}</b></div>
        ${proof}
        <table style="width:100%;border-collapse:collapse;">${items}
          <tr><td style="${td}border-top:1px solid #e8dcc0;padding-top:8px;">Items subtotal</td><td style="${tdr}border-top:1px solid #e8dcc0;padding-top:8px;">${money(r.subtotal)}</td></tr>
          ${lines}
          <tr><td style="padding:8px 0 0;font-size:15px;font-weight:700;border-top:2px solid #222;">Total paid</td><td style="padding:8px 0 0;font-size:15px;font-weight:700;text-align:right;border-top:2px solid #222;">${money(r.total)}</td></tr>
        </table>
        <div style="font-size:12px;color:#555;margin:6px 0 14px;">Paid by: ${esc(r.payment)}</div>
        <div style="font-size:12px;font-weight:700;color:#222;margin-top:12px;">Time stamps (South African time)</div>
        <table style="width:100%;border-collapse:collapse;">${times}</table>
        <div style="font-size:12px;color:#555;margin-top:14px;line-height:1.6;">
          ${r.customerName ? `<b>Customer:</b> ${esc(r.customerName)}<br>` : ''}
          <b>Delivered to:</b> ${esc(r.address)}${r.landmark ? ` (${esc(r.landmark)})` : ''}<br>
          ${r.outlet ? `<b>Sold and packed by:</b> ${esc(r.outlet)}<br>` : ''}
          ${r.driver ? `<b>Delivered by:</b> ${esc(r.driver)}<br>` : ''}
        </div>
        <div style="font-size:11px;color:#999;margin-top:14px;border-top:1px solid #f0ebe0;padding-top:10px;line-height:1.5;">
          ${esc(s.tradingName)} (${esc(s.legalName)}, registration ${esc(s.registration)}), ${esc(s.address)}.<br>
          WhatsApp ${esc(s.whatsapp)} · ${esc(s.email)} · ${esc(s.website)}<br>${esc(s.vatNote)}${opts.link ? `<br><a href="${esc(opts.link)}" style="color:#7a5c00;">Open or print this receipt online</a>` : ''}
        </div>
      </div>`;
  }

  // One line for the admin card: "Ordered 22 Nov 14:02 · Paid 14:03 · Collected 14:15 · Delivered 22 Nov 14:38 (23 min from pickup)"
  function timelineText(o) {
    const bits = [];
    if (o.createdAt) bits.push(`Ordered ${shortStamp(o.createdAt)}`);
    if (o.paidAt) bits.push(`Paid ${shortStamp(o.paidAt)}`);
    if (o.readyAt) bits.push(`Ready ${shortStamp(o.readyAt)}`);
    if (o.assignedAt) bits.push(`Assigned ${shortStamp(o.assignedAt)}`);
    if (o.pickedUpAt) bits.push(`Collected ${shortStamp(o.pickedUpAt)}`);
    if (o.deliveredAt) bits.push(`Delivered ${shortStamp(o.deliveredAt)}${o.pickedUpAt ? ` (${duration(o.pickedUpAt, o.deliveredAt)} from pickup)` : ''}`);
    return bits.join(' · ');
  }

  const api = { SELLER, buildReceipt, renderReceiptHtml, timelineText, timelineRows, stamp, shortStamp, duration, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EkoyiniReceipt = api;
})(typeof window !== 'undefined' ? window : globalThis);

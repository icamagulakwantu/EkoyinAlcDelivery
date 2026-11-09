// lib/reports.js — business reports and CSV export (pure, unit-tested).

const SA_OFFSET_MS = 2 * 3600 * 1000; // South Africa, UTC+2, no daylight saving
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// Area = last part of the address ("12 Vilakazi St, Motherwell NU10" →
// "Motherwell NU10"), without a leading house number. Same rule as the
// dispatch job post, so reports never carry a street address.
function areaOf(address) {
  const parts = String(address || '').split(',').map((s) => s.trim()).filter(Boolean);
  const last = (parts.length > 1 ? parts[parts.length - 1] : '').replace(/^\d+[a-z]?\s+/i, '').trim();
  return last || 'Unknown';
}

function topN(map, n, valueKey = 'count') {
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, n);
}

// orders: rows with createdAt, status, total, paymentMethod, address, userId, items[{name, quantity, price}]
// Cancelled orders and unpaid EFT orders don't count as sales.
function buildReport(orders, { days = 30, now = new Date() } = {}) {
  const since = now.getTime() - days * 86400000;
  const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= since);
  const sales = inRange.filter((o) => o.status !== 'CANCELLED' && o.status !== 'PAYMENT_PENDING');

  const revenue = round2(sales.reduce((s, o) => s + (Number(o.total) || 0), 0));
  const products = new Map();
  const areas = new Map();
  const byDay = DAYS.map((d) => ({ name: d, count: 0, revenue: 0 }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ name: `${String(h).padStart(2, '0')}:00`, count: 0 }));
  const payments = new Map();
  const perCustomer = new Map();

  for (const o of sales) {
    const t = new Date(new Date(o.createdAt).getTime() + SA_OFFSET_MS);
    byDay[t.getUTCDay()].count += 1;
    byDay[t.getUTCDay()].revenue = round2(byDay[t.getUTCDay()].revenue + (Number(o.total) || 0));
    byHour[t.getUTCHours()].count += 1;
    const pay = o.paymentMethod || 'cod';
    payments.set(pay, { count: (payments.get(pay)?.count || 0) + 1 });
    const area = areaOf(o.address);
    const a = areas.get(area) || { count: 0, revenue: 0 };
    areas.set(area, { count: a.count + 1, revenue: round2(a.revenue + (Number(o.total) || 0)) });
    if (o.userId) perCustomer.set(o.userId, (perCustomer.get(o.userId) || 0) + 1);
    for (const i of o.items || []) {
      const p = products.get(i.name) || { count: 0, revenue: 0 };
      products.set(i.name, { count: p.count + (Number(i.quantity) || 0), revenue: round2(p.revenue + (Number(i.price) || 0) * (Number(i.quantity) || 0)) });
    }
  }

  const customers = perCustomer.size;
  const repeat = [...perCustomer.values()].filter((n) => n > 1).length;
  return {
    days,
    from: new Date(since).toISOString(),
    to: now.toISOString(),
    orders: sales.length,
    cancelled: inRange.filter((o) => o.status === 'CANCELLED').length,
    awaitingPayment: inRange.filter((o) => o.status === 'PAYMENT_PENDING').length,
    revenue,
    averageOrder: sales.length ? round2(revenue / sales.length) : 0,
    customers,
    repeatCustomers: repeat,
    repeatRate: customers ? Math.round((repeat / customers) * 100) : 0,
    topProducts: topN(products, 10, 'revenue'),
    topAreas: topN(areas, 10),
    byDay,
    busiestHours: [...byHour].sort((a, b) => b.count - a.count).filter((h) => h.count > 0).slice(0, 5),
    payments: topN(payments, 5),
  };
}

// CSV with spreadsheet-formula protection: a cell starting with = + - @
// (or tab/CR) is prefixed with ' so Excel/Sheets never runs it as a formula
// (customer-typed names and addresses end up in these files).
function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { buildReport, toCsv, csvCell, areaOf };

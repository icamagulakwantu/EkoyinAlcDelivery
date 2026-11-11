// Daily payouts (founder, 11 Nov 2026).
//
// Ekoyini is the ordering platform; the partner taverns sell the alcohol.
// Every item price on the app is the tavern's shelf price plus Ekoyini's
// markup (7% beer, cider, RTD and wine; 5% spirits, liqueurs, mixers, water
// and ice). So for each delivered order:
//
//   tavern  = item total / (1 + markup)  + bottles & crates charge
//   driver  = delivery fee (distance + load) + surge + priority  (100%)
//   Ekoyini = everything else: the markup, Care & Handling and the Safety
//             Seal, less the Cooler Box and promo discounts (Ekoyini carries
//             those, never the tavern) and, on card orders, the Yoco fee.
//
// Cash on delivery: the driver collected the whole order total at the door,
// so what we owe the driver is reduced by that cash. A negative amount means
// the driver owes Ekoyini (they hold more cash than they earned).
//
// Pure functions, unit-tested in test/payouts.test.js.

const YOCO_PCT = 0.0325;
const YOCO_FIXED = 2.5;
const SA_OFFSET_MS = 2 * 3600 * 1000; // South Africa has no daylight saving

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// "2026-11-10" for a moment, in South African time.
function saDay(date) {
  return new Date(new Date(date).getTime() + SA_OFFSET_MS).toISOString().slice(0, 10);
}

// The UTC moments where an SA calendar day starts and ends (end exclusive).
function saDayRange(fromDay, toDay = fromDay) {
  const start = new Date(Date.parse(`${fromDay}T00:00:00Z`) - SA_OFFSET_MS);
  const end = new Date(Date.parse(`${toDay}T00:00:00Z`) - SA_OFFSET_MS + 86400000);
  return { start, end };
}

function isDay(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

// Normalise a phone number so one driver is one payee (072..., +2772..., 2772...).
function driverKey(phone, name) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 9) return digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  return `name:${String(name || "unknown").trim().toLowerCase()}`;
}

// orders: delivered orders with { code, total, paymentMethod, deliveryFee,
// surgeFee, priorityFee, bottleDepositFee, driverName, driverPhone,
// tavern: { id, name, phone }, items: [{ name, price, quantity, category }] }.
// markupFor(category) -> 0.05 | 0.07.
function buildPayouts(orders, markupFor) {
  const drivers = new Map();
  const taverns = new Map();
  const totals = { orders: 0, sales: 0, toTaverns: 0, toDrivers: 0, yocoFees: 0, ekoyini: 0, cashCollected: 0 };
  const unassigned = [];

  for (const o of orders) {
    const total = Number(o.total) || 0;
    const driverEarned = round2((Number(o.deliveryFee) || 0) + (Number(o.surgeFee) || 0) + (Number(o.priorityFee) || 0));
    let goods = 0;
    for (const it of o.items || []) {
      const line = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      goods += line / (1 + markupFor(it.category));
    }
    const tavernOwed = round2(goods + (Number(o.bottleDepositFee) || 0));
    const isCash = o.paymentMethod === "cod";
    const isCard = o.paymentMethod === "card";
    const yoco = isCard ? round2(total * YOCO_PCT + YOCO_FIXED) : 0;

    totals.orders += 1;
    totals.sales = round2(totals.sales + total);
    totals.toTaverns = round2(totals.toTaverns + tavernOwed);
    totals.toDrivers = round2(totals.toDrivers + driverEarned);
    totals.yocoFees = round2(totals.yocoFees + yoco);
    totals.ekoyini = round2(totals.ekoyini + (total - tavernOwed - driverEarned - yoco));
    if (isCash) totals.cashCollected = round2(totals.cashCollected + total);

    if (o.tavern) {
      const t = taverns.get(o.tavern.id) || { key: o.tavern.id, name: o.tavern.name, phone: o.tavern.phone || "", orders: [], owed: 0 };
      t.orders.push({ code: o.code, amount: tavernOwed });
      t.owed = round2(t.owed + tavernOwed);
      taverns.set(o.tavern.id, t);
    } else {
      unassigned.push(o.code);
    }

    if (o.driverName || o.driverPhone) {
      const key = driverKey(o.driverPhone, o.driverName);
      const d = drivers.get(key) || { key, name: o.driverName || "Driver", phone: o.driverPhone || "", orders: [], earned: 0, cashCollected: 0, owed: 0 };
      d.orders.push({ code: o.code, earned: driverEarned, cash: isCash ? total : 0 });
      d.earned = round2(d.earned + driverEarned);
      if (isCash) d.cashCollected = round2(d.cashCollected + total);
      d.owed = round2(d.earned - d.cashCollected);
      drivers.set(key, d);
    } else if (!unassigned.includes(o.code)) {
      unassigned.push(o.code);
    }
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    drivers: [...drivers.values()].sort(byName),
    taverns: [...taverns.values()].sort(byName),
    totals,
    unassigned,
  };
}

module.exports = { buildPayouts, driverKey, saDay, saDayRange, isDay, YOCO_PCT, YOCO_FIXED };

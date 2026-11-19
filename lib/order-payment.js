// Pay one existing order by card (Yoco), e.g. by scanning a QR code.
// The QR opens /pay/<order code>, which starts a Yoco checkout for that
// order's exact total. When Yoco confirms the payment the order is marked
// paid by card (see settleOrderPayment) — no second order is ever created.

const PAYABLE_STATUSES = ["PAYMENT_PENDING", "PENDING", "DISPATCHED"];
const PAYABLE_METHODS = ["eft", "cod"];
const ORDER_CODE_RE = /^EKO-[A-Z0-9]{8}$/;

// Why this order cannot be paid by card now, or null if it can.
function payableReason(order) {
  if (!order) return "We could not find that order.";
  if (order.paidAt || order.paymentMethod === "card") return "This order is already paid.";
  if (order.status === "CANCELLED") return "This order was cancelled.";
  if (order.status === "DELIVERED") return "This order has already been delivered.";
  if (!PAYABLE_STATUSES.includes(order.status) || !PAYABLE_METHODS.includes(order.paymentMethod)) {
    return "This order cannot be paid by card.";
  }
  if (!(Number(order.total) > 0)) return "This order has no amount to pay.";
  return null;
}

const isPayable = (order) => payableReason(order) === null;
const amountCentsFor = (order) => Math.round(Number(order.total) * 100);

// The marker stored in PendingCheckout.payload for this kind of payment.
function orderPaymentPayload(order) {
  return JSON.stringify({ kind: "order-payment", orderCode: order.code });
}
function parseOrderPayment(payloadJson) {
  try {
    const p = JSON.parse(payloadJson);
    return p && p.kind === "order-payment" && ORDER_CODE_RE.test(p.orderCode || "") ? p : null;
  } catch {
    return null;
  }
}

// Marks the order as paid by card once Yoco has confirmed the amount.
// Returns { ok: true, order, wasAwaitingPayment } or { ok: false, reason }
// where reason is meant for an admin (a human must refund or check).
async function settleOrderPayment({ prisma, pending, orderCode, now = new Date() }) {
  const order = await prisma.order.findUnique({ where: { code: orderCode } });
  if (!order) return { ok: false, reason: `Card payment of R${(pending.amountCents / 100).toFixed(2)} received for ${orderCode}, but that order does not exist. Refund it in Yoco.` };
  const why = payableReason(order);
  if (why) return { ok: false, reason: `Card payment of R${(pending.amountCents / 100).toFixed(2)} received for ${orderCode}, but: ${why} Refund it in Yoco if it is a duplicate.` };
  if (amountCentsFor(order) !== pending.amountCents) {
    return { ok: false, reason: `Card payment of R${(pending.amountCents / 100).toFixed(2)} received for ${orderCode}, but the order total is now R${Number(order.total).toFixed(2)}. Check it in Yoco.` };
  }
  const wasAwaitingPayment = order.status === "PAYMENT_PENDING";
  // One winner only: the update succeeds if the order is still unpaid.
  const claimed = await prisma.order.updateMany({
    where: { code: orderCode, paidAt: null, status: order.status, paymentMethod: order.paymentMethod },
    data: { paymentMethod: "card", paidAt: now, ...(wasAwaitingPayment ? { status: "PENDING" } : {}) },
  });
  if (claimed.count === 0) {
    return { ok: false, reason: `Card payment of R${(pending.amountCents / 100).toFixed(2)} received for ${orderCode}, but the order changed at the same moment. Check it in Yoco.` };
  }
  return { ok: true, wasAwaitingPayment, order: await prisma.order.findUnique({ where: { code: orderCode } }) };
}

module.exports = { payableReason, isPayable, amountCentsFor, orderPaymentPayload, parseOrderPayment, settleOrderPayment, ORDER_CODE_RE, PAYABLE_STATUSES };

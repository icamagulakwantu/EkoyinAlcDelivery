const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { payableReason, isPayable, orderPaymentPayload, parseOrderPayment, settleOrderPayment, amountCentsFor } = require("../lib/order-payment.js");

const order = (o = {}) => ({ code: "EKO-ABCD2345", status: "PAYMENT_PENDING", paymentMethod: "eft", total: 412.5, paidAt: null, customerEmail: "a@b.co", ...o });

test("payable: unpaid EFT and cash orders that are still open", () => {
  assert.equal(isPayable(order()), true);
  assert.equal(isPayable(order({ status: "PENDING", paymentMethod: "cod" })), true);
  assert.equal(isPayable(order({ status: "DISPATCHED", paymentMethod: "cod" })), true);
});

test("not payable: paid, card, cancelled, delivered, zero total, missing", () => {
  assert.match(payableReason(order({ paidAt: new Date() })), /already paid/);
  assert.match(payableReason(order({ paymentMethod: "card" })), /already paid/);
  assert.match(payableReason(order({ status: "CANCELLED" })), /cancelled/);
  assert.match(payableReason(order({ status: "DELIVERED" })), /delivered/);
  assert.match(payableReason(order({ total: 0 })), /no amount/);
  assert.match(payableReason(null), /could not find/);
});

test("amount is exact cents", () => {
  assert.equal(amountCentsFor(order({ total: 412.5 })), 41250);
  assert.equal(amountCentsFor(order({ total: 19.99 })), 1999);
});

test("payload marker round-trips and rejects other payloads", () => {
  assert.deepEqual(parseOrderPayment(orderPaymentPayload(order())), { kind: "order-payment", orderCode: "EKO-ABCD2345" });
  assert.equal(parseOrderPayment(JSON.stringify({ address: "x", items: [] })), null);
  assert.equal(parseOrderPayment("not json"), null);
  assert.equal(parseOrderPayment(JSON.stringify({ kind: "order-payment", orderCode: "bad" })), null);
});

function fakePrisma(initial) {
  const state = { order: initial };
  return {
    state,
    order: {
      findUnique: async () => (state.order ? { ...state.order } : null),
      updateMany: async ({ where, data }) => {
        const o = state.order;
        if (!o || o.code !== where.code || o.paidAt !== where.paidAt || o.status !== where.status || o.paymentMethod !== where.paymentMethod) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
    },
  };
}

test("settle: EFT order becomes paid by card and moves to PENDING", async () => {
  const prisma = fakePrisma(order());
  const r = await settleOrderPayment({ prisma, pending: { amountCents: 41250 }, orderCode: "EKO-ABCD2345" });
  assert.equal(r.ok, true);
  assert.equal(r.wasAwaitingPayment, true);
  assert.equal(r.order.paymentMethod, "card");
  assert.equal(r.order.status, "PENDING");
  assert.ok(r.order.paidAt);
});

test("settle: cash order keeps its status and becomes card", async () => {
  const prisma = fakePrisma(order({ status: "DISPATCHED", paymentMethod: "cod" }));
  const r = await settleOrderPayment({ prisma, pending: { amountCents: 41250 }, orderCode: "EKO-ABCD2345" });
  assert.equal(r.ok, true);
  assert.equal(r.order.status, "DISPATCHED");
  assert.equal(r.order.paymentMethod, "card");
});

test("settle: second payment for the same order is flagged, not applied twice", async () => {
  const prisma = fakePrisma(order());
  await settleOrderPayment({ prisma, pending: { amountCents: 41250 }, orderCode: "EKO-ABCD2345" });
  const again = await settleOrderPayment({ prisma, pending: { amountCents: 41250 }, orderCode: "EKO-ABCD2345" });
  assert.equal(again.ok, false);
  assert.match(again.reason, /already paid/);
});

test("settle: wrong amount and unknown order need a human", async () => {
  const wrong = await settleOrderPayment({ prisma: fakePrisma(order({ total: 500 })), pending: { amountCents: 41250 }, orderCode: "EKO-ABCD2345" });
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /order total is now R500\.00/);
  const missing = await settleOrderPayment({ prisma: fakePrisma(null), pending: { amountCents: 100 }, orderCode: "EKO-ABCD2345" });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /does not exist/);
});

test("pay routes: redirect to Yoco, refuse paid orders, serve a QR png", async () => {
  const created = [];
  const prisma = {
    order: { findUnique: async ({ where }) => (where.code === "EKO-ABCD2345" ? order() : where.code === "EKO-PAID2345" ? order({ code: "EKO-PAID2345", paidAt: new Date() }) : null) },
    pendingCheckout: {
      create: async ({ data }) => { const row = { id: "p1", ...data }; created.push(row); return row; },
      update: async () => ({}),
      delete: async () => ({}),
      findMany: async () => [],
    },
  };
  const app = express();
  const pass = (req, res, next) => next();
  let yocoArgs;
  require("../routes/pay-qr.js")(app, {
    prisma, writeLimiter: pass, trackLimiter: pass,
    completePaidCheckout: async () => "PENDING",
    appBaseUrl: () => "https://www.ekoyini.co.za",
    yoco: { isConfigured: () => true, createCheckout: async (a) => { yocoArgs = a; return { id: "ch_1", redirectUrl: "https://payments.yoco.com/checkout/ch_1" }; } },
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const ok = await fetch(`${base}/pay/EKO-ABCD2345`, { redirect: "manual" });
    assert.equal(ok.status, 302);
    assert.equal(ok.headers.get("location"), "https://payments.yoco.com/checkout/ch_1");
    assert.equal(yocoArgs.amountCents, 41250);
    assert.equal(yocoArgs.currency, "ZAR");
    assert.deepEqual(parseOrderPayment(created[0].payload), { kind: "order-payment", orderCode: "EKO-ABCD2345" });

    assert.equal((await fetch(`${base}/pay/EKO-PAID2345`, { redirect: "manual" })).status, 409);
    assert.equal((await fetch(`${base}/pay/EKO-NOPE2345`, { redirect: "manual" })).status, 404);
    assert.equal((await fetch(`${base}/pay/not-a-code`, { redirect: "manual" })).status, 404);
    assert.equal(created.length, 1);

    const qr = await fetch(`${base}/pay/EKO-ABCD2345/qr.png`);
    assert.equal(qr.headers.get("content-type"), "image/png");
    const buf = Buffer.from(await qr.arrayBuffer());
    assert.equal(buf.subarray(1, 4).toString(), "PNG");

    const check = await fetch(`${base}/api/order/EKO-ABCD2345/pay-check`, { method: "POST" });
    assert.deepEqual(await check.json(), { paid: false });
  } finally {
    server.close();
  }
});

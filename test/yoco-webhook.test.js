// test/yoco-webhook.test.js — run with `node --test`
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const Y = require("../payments.js");

// Sample event copied from Yoco's docs for payment.succeeded.
const SAMPLE = {
  id: "evt_1EAwK8Mjy2DT38WIWntiZWxm",
  type: "payment.succeeded",
  createdDate: "2024-06-15T15:51:55.260284Z",
  payload: {
    id: "p_bx4bY9JA6r4UwAKFyAjHY2bE", type: "payment", amount: 900, currency: "ZAR", status: "succeeded", mode: "live",
    metadata: { checkoutId: "ch_9LVKD8GnAj7f39DFbn4F16bE" },
  },
};

test("the checkout id comes from payload.metadata.checkoutId, never the payment id", () => {
  assert.equal(Y.extractCheckoutId(SAMPLE), "ch_9LVKD8GnAj7f39DFbn4F16bE");
  assert.equal(Y.extractCheckoutId({ payload: { id: "p_123" } }), null);
  assert.equal(Y.extractCheckoutId({}), null);
  assert.equal(Y.extractCheckoutId(null), null);
});

test("only payment.succeeded counts", () => {
  assert.equal(Y.isPaymentSucceededEvent(SAMPLE), true);
  for (const type of ["payment.failed", "refund.succeeded", "refund.failed", undefined]) {
    assert.equal(Y.isPaymentSucceededEvent({ ...SAMPLE, type }), false, String(type));
  }
});

test("key mode follows the secret key", () => {
  const old = process.env.YOCO_SECRET_KEY;
  process.env.YOCO_SECRET_KEY = "sk_live_abc"; assert.equal(Y.yocoKeyMode(), "live");
  process.env.YOCO_SECRET_KEY = "sk_test_abc"; assert.equal(Y.yocoKeyMode(), "test");
  process.env.YOCO_SECRET_KEY = ""; assert.equal(Y.yocoKeyMode(), null);
  if (old === undefined) delete process.env.YOCO_SECRET_KEY; else process.env.YOCO_SECRET_KEY = old;
});

function sign(secretB64, id, ts, body) {
  return "v1," + crypto.createHmac("sha256", Buffer.from(secretB64, "base64")).update(`${id}.${ts}.${body}`).digest("base64");
}

test("webhook signature: valid passes, tampered or missing fails", () => {
  const raw = crypto.randomBytes(24).toString("base64");
  process.env.YOCO_WEBHOOK_SECRET = "whsec_" + raw;
  const body = JSON.stringify(SAMPLE), id = "msg_1", ts = String(Math.floor(Date.now() / 1000));
  const headers = { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sign(raw, id, ts, body) };
  assert.equal(Y.verifyYocoWebhookSignature(headers, body), true);
  assert.equal(Y.verifyYocoWebhookSignature(headers, body.replace("900", "1")), false);
  assert.equal(Y.verifyYocoWebhookSignature({ ...headers, "webhook-signature": "v1,AAAA" }, body), false);
  assert.equal(Y.verifyYocoWebhookSignature({}, body), false);
  delete process.env.YOCO_WEBHOOK_SECRET;
  assert.equal(Y.verifyYocoWebhookSignature(headers, body), false);
});

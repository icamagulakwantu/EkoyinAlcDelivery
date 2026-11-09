// lib/marketing.js — signed one-click unsubscribe links (pure, unit-tested).
//
// The link carries the customer's id and an HMAC of it, so nobody can
// unsubscribe someone else by guessing ids. The secret comes from
// MARKETING_LINK_SECRET on Render; without it no links are generated.
const crypto = require('crypto');

function unsubscribeToken(userId, secret) {
  if (!secret || !userId) return null;
  return crypto.createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('base64url').slice(0, 32);
}

function verifyUnsubscribeToken(userId, token, secret) {
  const expected = unsubscribeToken(userId, secret);
  if (!expected || typeof token !== 'string' || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function unsubscribeUrl(baseUrl, userId, secret) {
  const t = unsubscribeToken(userId, secret);
  if (!t) return '';
  return `${String(baseUrl).replace(/\/$/, '')}/unsubscribe.html?u=${encodeURIComponent(userId)}&t=${t}`;
}

module.exports = { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl };

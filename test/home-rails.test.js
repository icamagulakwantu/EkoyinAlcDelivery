// The home page picks drinks by "name|pack" keys. When a pack is renamed (e.g. Breezer
// cans 500ml -> 440ml) a stale key silently drops the drink from the rail, so every key
// must exist in the catalogue.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../lib/catalogue-2026-11.js');

function liveKeys() {
  const csv = fs.readFileSync(path.join(__dirname, '../prisma/data/skus.csv'), 'utf8').split('\n').slice(1);
  const keys = new Set();
  for (const line of csv) {
    const cols = line.split(',');
    if (cols.length > 3 && cols[0]) keys.add(`${cols[0]}|${cols[2]}`);
  }
  for (const f of C.FORMAT_FIXES || []) { keys.delete(`${f.name}|${f.from}`); keys.add(`${f.name}|${f.to}`); }
  for (const n of C.NEW_PRODUCTS || []) keys.add(`${n.name}|${n.bottleFormat}`);
  return keys;
}

test('every drink the home page picks by name|pack exists in the catalogue', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const picked = [...html.matchAll(/'([^'|\n]+\|[^'\n]+)'/g)].map((m) => m[1]);
  assert.ok(picked.length > 20, 'expected to find the home page picks');
  const keys = liveKeys();
  const missing = [...new Set(picked)].filter((k) => !keys.has(k));
  assert.deepEqual(missing, [], 'stale home page picks: ' + missing.join(', '));
});

test('Order again is shared and never doubles the cart', () => {
  const script = fs.readFileSync(path.join(__dirname, '../public/script.js'), 'utf8');
  assert.ok(script.includes('const EkoyiniReorder'));
  assert.ok(script.includes('Math.max(Number(cart[p.id]) || 0, qty)'));
  for (const page of ['profile.html', 'track.html', 'index.html']) {
    assert.ok(fs.readFileSync(path.join(__dirname, '../public', page), 'utf8').includes('EkoyiniReorder.add'), page);
  }
});

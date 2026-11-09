// Stand-in for Yoco: creates checkouts, marks one paid on /pay/:id, reports status.
const http = require('http');
const store = {};
let n = 0;
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/api/checkouts') {
      const b = JSON.parse(body); const id = 'ch_' + Date.now().toString(36) + '_' + (++n);
      store[id] = { id, amount: b.amount, currency: b.currency, status: 'created', successUrl: b.successUrl };
      return res.end(JSON.stringify({ id, redirectUrl: 'http://localhost:4010/pay/' + id }));
    }
    let m = req.url.match(/^\/api\/checkouts\/(.+)$/);
    if (m && store[m[1]]) return res.end(JSON.stringify(store[m[1]]));
    m = req.url.match(/^\/tamper\/(.+)$/);
    if (m && store[m[1]]) { store[m[1]].amount -= 100; store[m[1]].status = 'completed'; return res.end('{}'); }
    m = req.url.match(/^\/pay\/(.+)$/);
    if (m && store[m[1]]) { store[m[1]].status = 'completed'; res.statusCode = 302; res.setHeader('Location', store[m[1]].successUrl); return res.end(); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(4010);

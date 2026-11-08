// Stand-in for Supabase /auth/v1/user. Tokens: "test-token" (default user) or
// "tok-<id>[-old]" for any user id; "-old" makes a 2-year-old account.
const http = require('http');
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const auth = req.headers.authorization || '';
  if (req.url.startsWith('/auth/v1/user')) {
    if (auth === 'Bearer test-token') return res.end(JSON.stringify({ id: 'user-test-1', email: 'thandeka@example.com', created_at: '2026-01-01T00:00:00Z' }));
    const m = auth.match(/^Bearer tok-([a-z0-9]+)(-old)?$/);
    if (m) return res.end(JSON.stringify({ id: 'user-' + m[1], email: m[1] + '@example.com', created_at: m[2] ? '2024-01-01T00:00:00Z' : '2026-11-01T00:00:00Z' }));
  }
  res.statusCode = 401; res.end('{}');
}).listen(54321);

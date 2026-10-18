import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { openDatabase } from './database.js';
import { handleApi } from './api.js';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
export function networkUrls(port) { return Object.values(networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && !x.internal).map(x => `http://${x.address}:${port}`); }
export function startServer({ port = Number(process.env.PORT || 3000), host = process.env.HOST || '0.0.0.0', database = process.env.DATABASE_PATH || resolve(ROOT, 'data/small-steps.sqlite') } = {}) {
  const db = openDatabase(database);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
      if (url.pathname.startsWith('/api/')) {
        let body;
        if (!['GET', 'HEAD'].includes(req.method)) {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 25000) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'This entry is too large.' })); return; }
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }
        const request = new Request(url, { method: req.method, headers: req.headers, body });
        const response = await handleApi(request, db, { network: networkUrls(server.address().port) });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const allowed = new Set(['/app.js', '/features.js', '/app.css', '/icon.svg', '/manifest.webmanifest']);
      const path = allowed.has(url.pathname) ? resolve(ROOT, 'public', url.pathname.slice(1)) : resolve(ROOT, 'public/index.html');
      const content = await readFile(path);
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { console.error(error.message); if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'The request could not be completed.' })); }
  });
  server.on('close', () => db.close());
  server.listen(port, host, () => {
    console.log(`\n  Small Steps is ready.\n\n  Computer: http://localhost:${server.address().port}`);
    for (const address of networkUrls(server.address().port)) console.log(`  Phone:    ${address}`);
    console.log('\n  Connect your phone to the same Wi-Fi and open a Phone address.\n  Press Ctrl+C to stop.\n');
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = startServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port is in use. Stop the other server or set PORT=3001.' : error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

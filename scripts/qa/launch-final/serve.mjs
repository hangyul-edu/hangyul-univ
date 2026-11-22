#!/usr/bin/env node
/**
 * Serve the four production builds (apps/*-web/dist) for the launch-final checks:
 *   marketing :4100 · student :4101 · agency (Operations/Admin) :4102 · university :4103
 * SPA fallback to index.html. `/api/*` is proxied to `--api <origin>` when given (e.g. the production
 * origin of the same app, to test against the connected API); otherwise it answers 503 JSON, which is what
 * a missing API looks like to the apps. Design Preview needs no API at all.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const args = process.argv.slice(2);
const apiIdx = args.indexOf('--api');
const API = apiIdx >= 0 ? args[apiIdx + 1].replace(/\/$/, '') : null;
const offIdx = args.indexOf('--port-offset');
const OFF = offIdx >= 0 ? Number(args[offIdx + 1]) : 0;
const APPS = { marketing: 4100 + OFF, student: 4101 + OFF, agency: 4102 + OFF, university: 4103 + OFF };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };

process.on('uncaughtException', (e) => console.log(`ignored: ${e.code ?? e.message}`));
for (const [app, port] of Object.entries(APPS)) {
  const dist = path.join(ROOT, 'apps', `${app}-web`, 'dist');
  http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      if (!API) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"detail":"No API behind this static server."}'); return; }
      try {
        const chunks = []; for await (const c of req) chunks.push(c);
        const headers = { ...req.headers, 'ngrok-skip-browser-warning': '1' }; delete headers.host; delete headers.connection; delete headers['content-length'];
        const r = await fetch(API + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks), redirect: 'manual' });
        const out = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) out[k] = v; });
        res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()));
      } catch { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"detail":"Upstream unreachable"}'); }
      return;
    }
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (/^\/(assets|data)\//.test(url.pathname)) { res.writeHead(404); res.end(); return; }
      file = path.join(dist, 'index.html');
    }
    if (!fs.existsSync(file)) { res.writeHead(503); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    // A rebuild empties dist/ for a moment; a vanished file is a 503 for that request, never a crashed server.
    fs.createReadStream(file).on('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); }).pipe(res);
  }).on('error', (e) => console.log(`${app}: ${e.code === 'EADDRINUSE' ? 'already served' : e.message}`))
    .listen(port, '127.0.0.1', () => console.log(`${app} → http://127.0.0.1:${port}`));
}

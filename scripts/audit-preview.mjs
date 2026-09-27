// Local-only static SPA preview. Never exposes secrets or permits production writes.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const publicData = process.env.AUDIT_PUBLIC_DATA === '1';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname).replace(/^\/AniNexus(?=\/|$)/, '') || '/';
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Read-only preview'); return; }
    if (pathname.startsWith('/api/') || pathname.startsWith('/media/profile/')) {
      if (!publicData) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"error":"ISOLATED_PREVIEW"}'); return; }
      const upstream = await fetch(`https://aninexus.com.br${pathname}${url.search}`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      res.end(Buffer.from(await upstream.arrayBuffer())); return;
    }
    if (pathname === '/runtime-config.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'audit-preview',siteOrigin:'http://127.0.0.1:4173',apiOrigin:${JSON.stringify(publicData ? 'http://127.0.0.1:4173' : '')},authEnabled:false});`); return;
    }
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) { res.writeHead(403); res.end(); return; }
    // Preview only browser assets. Source/config files and private evidence are not served.
    if (/^\/(?:\.git|\.env|node_modules|test-results|audit-artifacts|tests|lib|sql|ops|scripts)(?:[/.]|$)/.test(pathname)) { res.writeHead(404); res.end(); return; }
    const found = await stat(file).catch(() => null);
    if (found?.isFile()) {
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      let body = await readFile(file);
      if (pathname === '/index.html') body = body.toString().replace('<base href="/AniNexus/">', '<base href="/">');
      res.end(body); return;
    }
    if (/\.[a-z0-9]+$/i.test(pathname)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end((await readFile(path.join(root, 'index.html'), 'utf8')).replace('<base href="/AniNexus/">', '<base href="/">'));
  } catch (error) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'PREVIEW_UPSTREAM', message: error.message })); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Audit preview ready on http://127.0.0.1:4173 (read-only)'));

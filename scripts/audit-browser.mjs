import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { routes, widths as allWidths } from './audit-manifest.mjs';
const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const run = options.run || 'baseline';
const out = path.resolve('audit-artifacts', run);
const mode = options.mode || 'live';
const role = options.role || 'guest';
const widths = options.widths ? options.widths.split(',').map(Number) : allWidths;
const themes = (options.themes || 'dark,light').split(',');
const selected = options.routes ? routes.filter(item => options.routes.split(',').includes(item.id) || options.routes.split(',').includes(item.family)) : routes;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', serviceWorkers: 'block',
  ...(role === 'admin' ? { storageState: path.resolve('audit-artifacts/auth-state.json') } : {}) });
await context.addInitScript(() => {
  localStorage.setItem('aninexus:privacy:v1', JSON.stringify({ analytics: false, at: Date.now() }));
  localStorage.setItem('aninexus:theme', 'dark');
});
const blockedWrites = [];
const runtimeConfig = mode === 'preview' ? await (await fetch('https://aninexus.com.br/runtime-config.js')).text() : '';
await context.route('https://aninexus.com.br/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (!['GET', 'HEAD'].includes(request.method())) {
    if (/^\/api\/(?:auth\/clerk|auth\/session)/.test(url.pathname)) return route.continue();
    blockedWrites.push({ path: url.pathname, method: request.method() });
    return route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"AUDIT_READ_ONLY"}' });
  }
  if (mode !== 'preview' || /^\/(?:api|media)\//.test(url.pathname)) return route.continue();
  if (url.pathname === '/runtime-config.js') return route.fulfill({ contentType: 'application/javascript', body: runtimeConfig });
  const response = await route.fetch({ url: `http://127.0.0.1:4173${url.pathname}${url.search}` });
  return route.fulfill({ response });
});
const page = await context.newPage();
let errors = [], failedRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) { const u = new URL(response.url()); failedRequests.push({ path: u.pathname, status: response.status() }); } });
const records = [];
try {
  for (const item of selected) {
    errors = []; failedRequests = [];
    const start = Date.now();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`https://aninexus.com.br${item.route}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForFunction(() => {
      const app = document.querySelector('#app');
      return app?.innerText.trim().length > 40 && getComputedStyle(app).visibility !== 'hidden' && !document.querySelector('.nx22-loading');
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1800);
    const initialMs = Date.now() - start;
    for (const theme of themes) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        const toggle = page.locator('#topbar [data-action="theme"]');
        if (await toggle.isVisible()) await toggle.click();
        else await page.evaluate(value => { localStorage.setItem('aninexus:theme', value); document.documentElement.dataset.theme = value; }, theme);
      }
      for (const width of widths) {
        const height = width < 768 ? 844 : width < 1024 ? 1024 : 900;
        await page.setViewportSize({ width, height });
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(160);
        // Trigger real lazy image/layout paths before recording the top and full page.
        if (width === widths[0] || [320,390,768,1440,1920].includes(width)) {
          await page.evaluate(async () => { for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 16000); y += innerHeight) { scrollTo({top:y,behavior:'instant'}); await new Promise(r => setTimeout(r, 130)); } scrollTo({top:0,behavior:'instant'}); });
          await page.waitForTimeout(400);
        }
        const metrics = await page.evaluate(() => {
          const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          const app = document.querySelector('#app');
          const overflow = [...document.querySelectorAll('#app *')].filter(el => visible(el) && el.getBoundingClientRect().right > innerWidth + 2 && !el.closest('[data-nx44-rail],.nx35-rail,.nx44-rail,[role="tablist"],.nx22-tabs,.nx18-day-nav')).slice(0, 12).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 100), right: Math.round(el.getBoundingClientRect().right) }));
          return { path: location.pathname + location.search + location.hash, title: document.title, h1: [...(app?.querySelectorAll('h1') || [])].map(el => el.innerText), textLength: app?.innerText.length || 0, textStart: app?.innerText.slice(0, 300), width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, theme: document.documentElement.dataset.theme, mainCount: document.querySelectorAll('main').length, overflow,
            brokenImages: [...document.querySelectorAll('#app img')].filter(img => visible(img) && img.complete && !img.naturalWidth).map(img => ({ alt: img.alt, src: img.getAttribute('src')?.split('?')[0] })).slice(0, 10),
            unnamed: [...document.querySelectorAll('#app button,#app a')].filter(el => visible(el) && !el.innerText.trim() && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.querySelector('img[alt],svg title')).slice(0, 12).map(el => el.outerHTML.slice(0, 180)),
          };
        });
        const name = `${item.id}--${role}--${theme}--${width}`;
        const fullPage = [320, 390, 768, 1440, 1920].includes(width);
        await page.screenshot({ path: path.join(out, `${name}.png`), fullPage, animations: 'disabled', timeout: 25000 });
        const record = { route: item.route, family: item.family, role, mode, width, height, theme, initialMs, checkedAt: new Date().toISOString(), screenshot: `${run}/${name}.png`, fullPage, metrics, errors: [...new Set(errors)], failedRequests: [...failedRequests] };
        records.push(record);
        await fs.appendFile(path.join(out, 'results.jsonl'), `${JSON.stringify(record)}\n`);
      }
    }
    console.log(JSON.stringify({ route: item.route, captures: widths.length * themes.length, errors: [...new Set(errors)], initialMs }));
  }
} finally {
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify({ run, mode, role, count: records.length, blockedWrites, records }, null, 2));
  await context.close(); await browser.close();
}

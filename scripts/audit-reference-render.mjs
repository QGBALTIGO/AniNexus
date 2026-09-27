import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const dir = 'audit-artifacts/reference';
const entries = JSON.parse(await fs.readFile(`${dir}/index.json`, 'utf8'));
const styles = JSON.parse(await fs.readFile(`${dir}/styles.json`, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.route('**/*', async route => {
  const request = route.request();
  if (request.resourceType() === 'script' || !['GET','HEAD'].includes(request.method())) return route.abort();
  const entry = entries.find(item => item.url === request.url());
  if (entry) return route.fulfill({ contentType: 'text/html', body: await fs.readFile(`${dir}/${entry.page}.html`) });
  if (styles[request.url()]) return route.fulfill({ contentType: 'text/css', body: await fs.readFile(`${dir}/${styles[request.url()]}`) });
  // The public CDN works directly while the site's Next image optimizer returns
  // its browser challenge. Render the same public image, without the optimizer.
  const target = new URL(request.url());
  if (target.pathname === '/_next/image') {
    const source = target.searchParams.get('url');
    if (source && new URL(source, target).hostname === 'assets.aniquim.com.br') {
      const response = await route.fetch({ url: source });
      return route.fulfill({ response });
    }
  }
  return route.continue();
});
for (const item of entries) {
  await page.goto(item.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `${dir}/${item.page}-${width}-static.png`, fullPage: true, animations: 'disabled' });
  }
  console.log(JSON.stringify({ page: item.page, rendered: 'HTTP HTML + original CSS, scripts disabled', brokenImages: await page.locator('img').evaluateAll(items => items.filter(img => img.complete && !img.naturalWidth).length) }));
}
await browser.close();

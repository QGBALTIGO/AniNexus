import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const seo=fs.readFileSync(new URL('../preview-v38/seo-v38.js',import.meta.url),'utf8');
async function fixture(page,path,body){
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="description"><link rel="canonical"></head><body><div id="app">'+body+'</div></body></html>'}):r.abort());
  await page.goto('https://fixture.test'+path);await page.addScriptTag({content:seo});
}
for(const type of ['anime','manga'])test(`actual shared ${type} selectors update metadata after navigation`,async({page})=>{
  await fixture(page,`/${type}/obra-101`,'<h1>Obra de teste</h1><div class="nx22-cover"><img src="https://fixture.test/cover.jpg"></div><p class="nx22-synopsis">Sinopse específica desta obra.</p>');
  await expect(page).toHaveTitle('Obra de teste | AniNexus');await expect(page.locator('meta[name="description"]')).toHaveAttribute('content','Sinopse específica desta obra.');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content','https://fixture.test/cover.jpg');
  await page.evaluate(()=>{history.pushState({},'', '/admin');document.querySelector('#app').innerHTML='<h1>Administração</h1>';dispatchEvent(new Event('aninexus:route-changed'))});
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow,noarchive');
});
test('news structured data uses available facts and is removed on leaving the article',async({page})=>{
  const metadata=JSON.stringify({summary:'Resumo confirmado.',publishedAt:'2026-10-01T12:00:00Z',sourceAuthor:'Autora da fonte'}).replace(/"/g,'&quot;');
  await fixture(page,'/noticias/noticia-fixture',`<article data-nx-news-metadata="${metadata}"><header class="nx35-article-head"><h1>Notícia de teste</h1></header></article>`);
  await expect(page.locator('#aninexus-route-structured-data')).toHaveCount(1);
  const schema=await page.locator('#aninexus-route-structured-data').evaluate(n=>JSON.parse(n.textContent));
  expect(schema['@type']).toBe('NewsArticle');expect(schema.author.name).toBe('Autora da fonte');expect(schema.datePublished).toBe('2026-10-01T12:00:00.000Z');expect(schema).not.toHaveProperty('dateModified');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content','Resumo confirmado.');
  await page.evaluate(()=>{history.pushState({},'', '/comunidade');document.querySelector('#app').innerHTML='<h1>Comunidade</h1>';dispatchEvent(new Event('aninexus:route-changed'))});
  await expect(page.locator('#aninexus-route-structured-data')).toHaveCount(0);await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content','website');
});

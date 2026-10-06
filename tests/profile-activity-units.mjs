import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {load} from 'cheerio';

const file='preview-v38/profile-v38.js';
const source=process.env.EX08_BASELINE_REF?execFileSync('git',['show',`${process.env.EX08_BASELINE_REF}:${file}`],{encoding:'utf8',timeout:15000}):readFileSync(new URL('../'+file,import.meta.url),'utf8');
// Execute the actual private row renderer and its real shared formatters. The
// only instrumentation exports the function; there is no network or account.
function render(items,{pages=false}={}){
  const prefix=source.slice(0,source.indexOf('  let activeRender='));
  const rows=source.slice(source.indexOf('  function activityRows('),source.indexOf('  function impressionRows('));
  assert.ok(prefix&&rows,'The private renderer must exist');
  const window={},document={querySelector:()=>({})},location={hostname:pages?'fixture.github.io':'aninexus.test'};
  runInNewContext(prefix+rows+'\nwindow.fixtureRows=activityRows;})();',{window,document,location,URL,URLSearchParams,Date,Intl,Number,String,Array,Math},{filename:file});
  return load(window.fixtureRows(items));
}
const row=(media_type,values={})=>({media_type,media_id:101,title:'Obra de fixture',status:'CURRENT',progress:4,created_at:'2026-01-01T12:00:00Z',...values});

test('mixed overview activity uses anime and manga labels, units and typed links',()=>{
  const $=render([row('ANIME'),row('MANGA',{media_id:102,volume_progress:2})]);const items=$('.nx38p-activity');
  assert.match(items.eq(0).text(),/Assistindo: Obra de fixture.*Episódio 4/);assert.match(items.eq(0).attr('href'),/^\/anime\//);
  assert.match(items.eq(1).text(),/Lendo: Obra de fixture.*Capítulo 4 · Volume 2/);assert.match(items.eq(1).attr('href'),/^\/manga\//);assert.doesNotMatch(items.eq(1).text(),/Episódio|Assistindo/);
});
test('planning manga and nested media type preserve their reading meaning in Pages links',()=>{
  const $=render([{media_id:102,media:{id:102,mediaType:'MANGA',title:'Leitura fixture'},status:'PLANNING',progress:0}],{pages:true});const item=$('.nx38p-activity');
  assert.match(item.text(),/Quero ler: Leitura fixture/);assert.doesNotMatch(item.text(),/Episódio|Capítulo 0|Quero ver/);assert.equal(new URL(item.attr('href'),'https://fixture.github.io').searchParams.get('p'),'/manga/leitura-fixture-102');
});
test('zero or invalid progress stays absent and manga volume progress remains independent',()=>{
  const $=render([row('MANGA',{progress:0,volume_progress:1}),row('ANIME',{progress:'invalid',volume_progress:9}),row('MANGA',{progress:-1,volume_progress:0})]);const items=$('.nx38p-activity');
  assert.match(items.eq(0).text(),/Volume 1/);assert.doesNotMatch(items.eq(0).text(),/Capítulo 0/);assert.doesNotMatch(items.eq(1).text(),/NaN|Episódio|Volume/);assert.doesNotMatch(items.eq(2).text(),/Capítulo|Volume/);
});
test('typed fallback artwork and title remain truthful while user titles stay escaped',()=>{
  const $=render([row('MANGA',{title:''}),row('ANIME',{title:''}),row('MANGA',{title:'<img src=x onerror=alert(1)>',score:8.5})]);const items=$('.nx38p-activity');
  assert.equal(items.eq(0).find('i').text(),'MG');assert.match(items.eq(0).find('strong').text(),/Lendo: Mangá/);assert.match(items.eq(0).attr('href'),/^\/manga\/manga-/);assert.equal(items.eq(1).find('i').text(),'AN');assert.match(items.eq(1).find('strong').text(),/Assistindo: Anime/);assert.equal(items.eq(2).find('img').length,0);assert.match(items.eq(2).find('strong').text(),/<img/);assert.equal(items.eq(2).find('b').text(),'★ 8.5');
});

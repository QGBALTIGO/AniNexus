import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeAnimeScheduleItem} from '../lib/anime-schedule.mjs';
const source=fs.readFileSync(new URL('../preview-v18/schedule.js',import.meta.url),'utf8');
const start=source.indexOf('  function localDate('),end=source.indexOf('  function todayNoon()',start);
assert.ok(start>0&&end>start);
for(const [zone,expected] of [['America/Sao_Paulo','2026-10-06T03:00:00.000Z'],['America/Cuiaba','2026-10-06T04:00:00.000Z'],['America/Manaus','2026-10-06T04:00:00.000Z'],['America/Rio_Branco','2026-10-06T05:00:00.000Z'],['Pacific/Auckland','2026-10-05T11:00:00.000Z']])test(`calendar midnight follows ${zone}`,()=>{
  const h=vm.runInNewContext('(()=>{'+source.slice(start,end)+';return {localDate,advanceDate}})()',{TZ:zone,Intl,Date});assert.equal(h.localDate('2026-10-06').toISOString(),expected);assert.equal(h.advanceDate('2026-12-29',7),'2027-01-05');
});
test('seven-day calendar range follows daylight-saving boundaries',()=>{
  const h=vm.runInNewContext('(()=>{'+source.slice(start,end)+';return {localDate,advanceDate}})()',{TZ:'America/New_York',Intl,Date});
  const first=h.localDate('2026-10-30'),last=h.localDate(h.advanceDate('2026-10-30',7));assert.equal((last-first)/3600000,169);
});
test('schedule metadata preserves known adult classification and keeps unavailable classification unknown',()=>{
  const row={title:'Fixture',episodeDate:'2026-10-06T12:00:00Z'};
  assert.equal(normalizeAnimeScheduleItem(row).isAdult,null);
  assert.equal(normalizeAnimeScheduleItem({...row,isAdult:false}).isAdult,false);
  assert.equal(normalizeAnimeScheduleItem({...row,isAdult:true}).isAdult,true);
  assert.equal(normalizeAnimeScheduleItem({...row,genres:[{name:'Hentai'}]}).isAdult,true);
});

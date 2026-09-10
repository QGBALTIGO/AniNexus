import assert from 'node:assert/strict';
import { normalizeJikanAuthors, normalizeJikanStaff, normalizeKitsuRoster } from '../lib/provider.mjs';

const jikanStaff=normalizeJikanStaff([{positions:['Director','Storyboard'],person:{mal_id:7,name:'Aya Teste',images:{jpg:{image_url:'https://cdn.example.test/aya.jpg'}}}}]);
assert.deepEqual(jikanStaff,[{role:'Director, Storyboard',id:7,name:'Aya Teste',native:'',image:'https://cdn.example.test/aya.jpg'}]);
assert.deepEqual(normalizeJikanStaff([{name:'Editora indevida',role:'Produção'}]),[],'organizações não podem virar pessoas da equipe');

assert.deepEqual(normalizeJikanAuthors([{mal_id:9,type:'Story & Art',name:'Hana Autora'}]),[
  {role:'Story & Art',id:9,name:'Hana Autora',native:'',image:''}
]);

const characterPayload={
  data:[{attributes:{role:'main'},relationships:{character:{data:{type:'characters',id:'15'}}}}],
  included:[{type:'characters',id:'15',attributes:{canonicalName:'Akira',names:{ja_jp:'アキラ'},image:{large:'https://cdn.example.test/akira.jpg'}}}]
};
assert.deepEqual(normalizeKitsuRoster(characterPayload,'characters'),[
  {role:'MAIN',id:15,name:'Akira',native:'アキラ',image:'https://cdn.example.test/akira.jpg',voiceActor:null}
]);

const staffPayload={
  data:[{attributes:{role:'Character Design'},relationships:{person:{data:{type:'people',id:'22'}}}}],
  included:[{type:'people',id:'22',attributes:{name:'Mika Artista',image:{original:'https://cdn.example.test/mika.jpg'}}}]
};
assert.deepEqual(normalizeKitsuRoster(staffPayload,'staff'),[
  {role:'Character Design',id:22,name:'Mika Artista',native:'',image:'https://cdn.example.test/mika.jpg'}
]);
assert.deepEqual(normalizeKitsuRoster({data:staffPayload.data,included:[]},'staff'),[],'relações sem pessoa incluída não geram placeholders falsos');

console.log('Provider roster: 5 tests passed');

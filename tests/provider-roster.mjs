import assert from 'node:assert/strict';
import { normalizeJikanAuthors, normalizeJikanStaff, normalizeKitsuRoster, normalizeMalRoster } from '../lib/provider.mjs';

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

const malHtml=`
  <table class="js-anime-character-table"><tbody><tr>
    <td><a href="https://myanimelist.net/character/31/Jirou_Azuma"><img alt="Azuma, Jirou" data-src="https://cdn.myanimelist.net/r/42x62/images/characters/1/31.jpg?x=1"></a></td>
    <td><div class="spaceit_pad"><a><h3 class="h3_character_name">Azuma, Jirou</h3></a></div><div class="spaceit_pad"><small>Main</small></div></td>
    <td><table><tr><td><a href="https://myanimelist.net/people/41/Ryouta_Suzuki"><img alt="Suzuki, Ryouta" data-src="https://cdn.myanimelist.net/r/42x62/images/voiceactors/1/41.jpg"></a></td><td>Japanese</td></tr></table></td>
  </tr></tbody></table>
  <div><h2>Staff</h2></div>
  <table><tr><td><a href="https://myanimelist.net/people/51/Takeshi_Takadera"><img alt="Takadera, Takeshi" data-src="https://cdn.myanimelist.net/r/42x62/images/voiceactors/1/51.jpg"></a></td><td><div class="spaceit_pad"><small>Sound Director</small></div></td></tr></table>`;
const malRoster=normalizeMalRoster(malHtml,'ANIME');
assert.equal(malRoster.characters[0].name,'Jirou Azuma');
assert.equal(malRoster.characters[0].image,'https://cdn.myanimelist.net/images/characters/1/31.jpg');
assert.equal(malRoster.characters[0].voiceActor.person.name,'Ryouta Suzuki');
assert.deepEqual(malRoster.staff,[{role:'Sound Director',id:51,name:'Takeshi Takadera',native:'',image:'https://cdn.myanimelist.net/images/voiceactors/1/51.jpg'}]);

console.log('Provider roster: 9 tests passed');

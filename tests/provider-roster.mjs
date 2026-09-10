import assert from 'node:assert/strict';
import { mergeRoster, normalizeJikanAuthors, normalizeJikanStaff, normalizeKitsuRoster, normalizeMalPersonImage, normalizeMalRelations, normalizeMalRoster } from '../lib/provider.mjs';

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

const relations=normalizeMalRelations(`
  <div class="related-entries"><div class="entry borderClass"><div class="image"><a href="https://myanimelist.net/anime/1735/Naruto__Shippuuden"><img alt="Naruto: Shippuuden" data-src="https://cdn.myanimelist.net/r/50x70/images/anime/1/1735.jpg?x=1"></a></div><div class="content"><div class="relation">Sequel (TV)</div><div class="title"><a>Naruto: Shippuuden</a></div></div></div>
  <div class="entry"><div class="image"><a href="https://evil.example/anime/999/Injected"><img alt="Injected"></a></div><div class="relation">Other</div></div>
  <table class="entries-table"><tr><td>Side Story:</td><td><ul class="entries"><li><a href="https://myanimelist.net/manga/11/Naruto">Naruto</a> (Manga)</li></ul></td></tr></table></div>`);
assert.deepEqual(relations,[
  {relationType:'SEQUEL',entry:{type:'anime',mal_id:1735,url:'https://myanimelist.net/anime/1735/Naruto__Shippuuden',name:'Naruto: Shippuuden',cover:'https://cdn.myanimelist.net/images/anime/1/1735.jpg',format:'TV'}},
  {relationType:'SIDE_STORY',entry:{type:'manga',mal_id:11,url:'https://myanimelist.net/manga/11/Naruto',name:'Naruto',cover:'',format:'Manga'}}
]);
assert.equal(normalizeMalPersonImage('<meta property="og:image" content="https://cdn.myanimelist.net/images/voiceactors/2/74096.jpg">'),'https://cdn.myanimelist.net/images/voiceactors/2/74096.jpg');
assert.equal(normalizeMalPersonImage('<meta property="og:image" content="https://cdn.myanimelist.net/img/sp/icon/apple-touch-icon-256.png">'),'', 'the MAL application icon is not a staff portrait');
assert.deepEqual(mergeRoster(
  [{id:1,name:'Pessoa',image:'https://cdn.myanimelist.net/img/sp/icon/apple-touch-icon-256.png'}],
  [{id:1,name:'Pessoa',image:'https://cdn.myanimelist.net/images/voiceactors/3/8743.jpg'}]
),[{id:1,name:'Pessoa',image:'https://cdn.myanimelist.net/images/voiceactors/3/8743.jpg'}],'invalid provider artwork is removed before a valid secondary portrait is merged');

const mangaRoster=normalizeMalRoster('<table class="js-manga-character-table"><tbody><tr><td><a href="https://myanimelist.net/character/1/Test"><img alt="Teste" data-src="https://cdn.myanimelist.net/images/characters/1/1.jpg"></a></td><td><h3 class="h3_character_name">Teste</h3><div class="spaceit_pad"><small>Main</small></div></td></tr></tbody></table><p><span class="dark_text">Authors:</span> <a href="https://myanimelist.net/people/1881/Eiichiro_Oda">Oda, Eiichiro</a> (Story & Art)</p>','MANGA');
assert.equal(mangaRoster.characters[0].role,'MAIN');
assert.deepEqual(mangaRoster.staff,[{role:'Story & Art',id:1881,name:'Eiichiro Oda',native:'',image:''}]);

assert.deepEqual(mergeRoster(
  [{role:'Story & Art',id:1881,name:'Eiichiro Oda',native:'',image:''}],
  [{role:'Story & Art',id:1881,name:'Eiichiro Oda',native:'',image:'https://cdn.myanimelist.net/images/voiceactors/2/74096.jpg'}]
),[{role:'Story & Art',id:1881,name:'Eiichiro Oda',native:'',image:'https://cdn.myanimelist.net/images/voiceactors/2/74096.jpg'}]);

console.log('Provider roster: 16 tests passed');

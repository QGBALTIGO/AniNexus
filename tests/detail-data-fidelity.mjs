import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../preview-v22/detail-v22.js',import.meta.url),'utf8');
function declaration(name){const match=new RegExp('^  (?:async )?function '+name+'\\(', 'm').exec(source);assert.ok(match,name);const rest=source.slice(match.index),next=rest.slice(1).search(/\n  (?:async )?function /);return next<0?rest:rest.slice(0,next+1);}
function harness(){
  const context=vm.createContext({URL,DETAIL_FIELDS:'fixture',gql:async()=>({Media:{id:101,type:'ANIME',averageScore:92,popularity:999,stats:{scoreDistribution:[{amount:10}],statusDistribution:[{amount:20}]}}})});
  for(const name of ['ratingValue','score','scoreFixed','ratingContext']){const line=source.match(new RegExp('^  const '+name+'=.*;$','m'))?.[0];assert.ok(line,name);vm.runInContext(line,context);}
  for(const name of ['youtubeTrailerId','trailerId','loadAni'])vm.runInContext(declaration(name),context);
  return vm.runInContext('({youtubeTrailerId,trailerId,loadAni,ratingValue,score,scoreFixed,ratingContext})',context);
}
test('trailer normalizes only strict YouTube identifiers and supported HTTPS URLs',()=>{
  const h=harness(),id='AbC_123-xyz';
  for(const value of [id,`https://www.youtube.com/watch?v=${id}&t=10`,`https://youtu.be/${id}`,`https://www.youtube-nocookie.com/embed/${id}`,`https://youtube.com/shorts/${id}`])assert.equal(h.youtubeTrailerId(value),id);
  for(const value of ['',id+'\tbad','invalid',`http://youtu.be/${id}`,`https://evil.invalid/${id}`,`https://youtube.com.evil.invalid/watch?v=${id}`,`https://user@youtube.com/watch?v=${id}`,`https://youtube.com:444/watch?v=${id}`,`https://youtu.be/${id}/extra`,`https://youtube.com/watch?v=${id}%09`,`javascript:${id}`])assert.equal(h.youtubeTrailerId(value),'',value);
  assert.equal(h.trailerId({trailer:{site:'youtube',id:'bad'},jikan:{trailer:{youtube_id:id}}}),id);
  assert.equal(h.trailerId({trailer:{site:'dailymotion',id}}),'');
});
test('upstream AniList distributions retain their actual source',async()=>{
  const h=harness(),media=await h.loadAni(101,'ANIME');assert.equal(media.metricsSource,'anilist');assert.equal(media.ratingCount,10);assert.equal(media.listCount,20);assert.equal(h.scoreFixed(media),'—');assert.equal(h.ratingContext(media),'');
});
test('community ratings preserve zero and retain a concise positive sample count',()=>{
  const h=harness();for(const [count,average,expected] of [[1,0,'0.00'],[4,95,'9.50'],[5,82,'8.20']]){
    const media={metricsSource:'aninexus',ratingCount:count,averageScore:average};assert.equal(h.scoreFixed(media),expected);assert.equal(h.ratingContext(media),`${count} ${count===1?'avaliação':'avaliações'} no AniNexus${count<5?' · amostra pequena':''}`);
  }
  for(const averageScore of [-1,101,NaN,null,undefined])assert.equal(h.scoreFixed({metricsSource:'aninexus',ratingCount:1,averageScore}),'—');
  assert.equal(h.scoreFixed({metricsSource:'aninexus',ratingCount:0,averageScore:90}),'—');
});
test('missing or foreign ratings do not create an empty assessment notice',()=>{
  const h=harness();for(const media of [{metricsSource:'aninexus',ratingCount:0,averageScore:90},{metricsSource:'aninexus',ratingCount:null},{metricsSource:'aninexus'},{metricsSource:'anilist',ratingCount:80,averageScore:90},null])assert.equal(h.ratingContext(media),'');
});

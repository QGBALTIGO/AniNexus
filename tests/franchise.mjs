import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {collectFranchise,registerFranchise} from '../lib/franchise.mjs';
const node=(id,extra={})=>({id,mediaType:'ANIME',title:`Anime ${id}`,relations:[],...extra});
const relation=(type,media)=>({relationType:type,media});
test('franchise follows multiple generations, deduplicates mirrors and preserves media types',async()=>{
  const third=node(3,{seasonYear:2020}),second=node(2,{seasonYear:2010,relations:[relation('SEQUEL',third)]});
  const first=node(1,{seasonYear:2000,relations:[relation('SEQUEL',{id:2,title:'Anime 2'}),relation('ADAPTATION',node(1,{mediaType:'MANGA'}))]});
  const data=await collectFranchise(first,async()=>[second]);
  assert.deepEqual(data.order.sequence,['ANIME:1','ANIME:2','ANIME:3']);assert.equal(data.nodes.length,4);assert.equal(data.partial,false);assert.equal(data.chronological,null);
});
test('prequels order before root; cycle falls back visibly instead of claiming an order',async()=>{
  const pre=node(1),root=node(2,{relations:[relation('PREQUEL',pre)]});let data=await collectFranchise(root,async()=>[]);assert.deepEqual(data.order.sequence,['ANIME:1','ANIME:2']);
  pre.relations=[relation('PREQUEL',root)];data=await collectFranchise(root,async()=>[]);assert.equal(data.order.cycle,true);
});
test('missing catalog data, limits and excluded adult/character edges are explicit',async()=>{
  const root=node(1,{relations:[relation('SEQUEL',{id:2,title:'Unknown'}),relation('CHARACTER',node(3)),relation('SIDE_STORY',node(4,{isAdult:true}))]});
  const data=await collectFranchise(root,async()=>[]);assert.equal(data.partial,true);assert.equal(data.nodes.length,2);
  assert.equal((await collectFranchise(root,async()=>[],{maxNodes:1})).partial,true);
});
test('franchise progress is private bounded and strictly validated',async()=>{
  const app=Fastify(),calls=[];registerFranchise(app,{q:async(sql,params)=>{calls.push(params);return{rows:[]}},getAnime:async()=>node(1),getManga:async()=>node(1),cacheRemember:async(k,t,fn)=>fn(),requireUser:async(req,reply)=>req.headers.authorization?{id:'owner'}:(reply.code(401).send({error:'AUTH_REQUIRED'}),null),privateReadRate:{},publicRate:{}});
  assert.equal((await app.inject('/api/me/franchise-progress?anime=1')).statusCode,401);
  assert.equal((await app.inject({url:'/api/me/franchise-progress?anime=1%20OR%201',headers:{authorization:'fixture'}})).statusCode,400);
  assert.equal((await app.inject({url:'/api/me/franchise-progress?anime=1,1,2&manga=1',headers:{authorization:'fixture'}})).statusCode,200);assert.deepEqual(calls[0],['owner',[1,2],[1]]);
  const result=await app.inject('/api/anime/1/franchise');assert.equal(result.statusCode,200);assert.equal(result.json().root,'ANIME:1');await app.close();
});

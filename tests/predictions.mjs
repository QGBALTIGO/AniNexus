import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {generatePredictionCandidate,validatePredictionCandidate,evaluatePrediction,evidenceHash,wilsonLowerBound,predictionConsensus,publicPrediction,registerPredictions,votePrediction} from '../lib/predictions.mjs';

const now=new Date('2026-10-01T12:00:00Z');
const base=()=>generatePredictionCandidate({mediaId:101,mediaType:'ANIME',title:'Obra de teste',averageScore:80,status:'RELEASING',popularity:12000},{now}).candidate;
const observed=(candidate,score=83,date=candidate.resolutionDeadline)=>({source:'AniList',mediaId:101,mediaType:'ANIME',observedAt:date,data:{averageScore:score}});
const iso=value=>new Date(value).toISOString();

test('generator produces explicit catalog criteria, UTC cutoff and seven-day uncertainty',()=>{
  const candidate=base();assert.equal(candidate.rule.threshold,82);assert.equal(candidate.resolutionDeadline,'2026-10-08T12:00:00.000Z');assert.equal(candidate.closesAt,'2026-10-07T12:00:00.000Z');
  assert.match(candidate.question,/AniList/);assert.match(candidate.criteria,/primeira leitura válida/);assert.match(candidate.criteria,/sem efeito na reputação/);assert.equal(validatePredictionCandidate(candidate,now).ok,true);
});
test('publication rejects malformed, mismatched or unsafe candidates',()=>{
  for(const [patch,error] of [[{closesAt:'2026-10-08T11:59:00Z'},'INVALID_WINDOW'],[{opensAt:'2026-10-02T00:00:00Z'},'INVALID_WINDOW'],[{closesAt:now.toISOString()},'INVALID_WINDOW'],[{sourceUrl:'https://example.test/101'},'SOURCE_MISMATCH'],[{mediaType:'MANGA'},'SOURCE_MISMATCH'],[{rule:{threshold:80,windowSeconds:3600}},'INSUFFICIENT_UNCERTAINTY']])assert.equal(validatePredictionCandidate({...base(),...patch},now).error,error);
  assert.equal(validatePredictionCandidate({...base(),cover:'javascript:alert(1)'},now).error,'INVALID_CANDIDATE');
  assert.equal(validatePredictionCandidate({...base(),rule:{threshold:82,windowSeconds:0}},now).error,'INVALID_CANDIDATE');
  assert.equal(validatePredictionCandidate({...base(),extra:'ignored?'},now).error,'INVALID_CANDIDATE');
});
test('stale and future baseline data never creates an open prediction',()=>{
  const c=base();for(const observedAt of ['2026-10-01T10:59:59Z','2026-10-01T12:00:01Z'])assert.equal(validatePredictionCandidate({...c,baseline:{...c.baseline,observedAt}},now).error,'STALE_BASELINE');
});
test('score threshold resolves only within the exact evidence window, inclusive boundaries',()=>{
  const c=base(),deadline=Date.parse(c.resolutionDeadline);
  for(const offset of [0,1,3599999,3600000])for(const [score,result] of [[82,'YES'],[83,'YES'],[81,'NO'],[0,'NO']]){
    const at=iso(deadline+offset),answer=evaluatePrediction(c,observed(c,score,at),new Date(at));assert.equal(answer.status,'RESOLVED');assert.equal(answer.result,result);
  }
  assert.equal(evaluatePrediction(c,observed(c,83,iso(deadline-1)),new Date(deadline)).status,'PENDING');
  assert.equal(evaluatePrediction(c,observed(c,83,iso(deadline+3600001)),new Date(deadline+3600001)).status,'VOID');
});
test('null, missing, malformed, source errors and unrelated observations never mean NO',()=>{
  const c=base(),at=new Date(c.resolutionDeadline),good=observed(c);
  for(const bad of [null,undefined,{error:'timeout'},{...good,data:{averageScore:null}},{...good,data:{}},{...good,data:{averageScore:101}},{...good,mediaId:102},{...good,mediaType:'MANGA'},{...good,source:'Jikan'},{...good,observedAt:'invalid'},{...good,observedAt:iso(+at+1)}]){
    const answer=evaluatePrediction(c,bad,at);assert.equal(answer.status,'PENDING');assert.equal(answer.result,null);
  }
});
test('missing evidence after grace voids, but captured in-window evidence can be processed late',()=>{
  const c=base(),after=new Date(Date.parse(c.resolutionDeadline)+3600001);
  assert.equal(evaluatePrediction(c,null,after).status,'VOID');assert.equal(evaluatePrediction(c,null,after).result,null);
  assert.equal(evaluatePrediction(c,observed(c),after).result,'YES');
});
test('catalog-date candidates reject an already known full date but not an incomplete date',()=>{
  const media={mediaId:101,title:'Teste de data',startDate:{year:2027,month:1,day:null}};
  const generated=generatePredictionCandidate(media,{now,type:'CATALOG_DATE_OBSERVED'});assert.equal(generated.ok,true);
  assert.match(generated.candidate.criteria,/não comprova a data de um anúncio oficial/);
  assert.equal(generatePredictionCandidate({...media,startDate:{year:2027,month:1,day:8}},{now,type:'CATALOG_DATE_OBSERVED'}).error,'ALREADY_KNOWN');
});
test('date resolution is an observed catalog fact; absent/impossible/late date is never NO',()=>{
  const c=generatePredictionCandidate({mediaId:101,title:'Teste de data',startDate:{year:2027}},{now,type:'CATALOG_DATE_OBSERVED'}).candidate;
  const evidence={source:'AniList',mediaId:101,mediaType:'ANIME',observedAt:'2026-10-02T12:00:00Z',data:{startDate:{year:2027,month:1,day:8}}};
  assert.equal(evaluatePrediction(c,evidence,new Date(evidence.observedAt)).result,'YES');
  for(const startDate of [{year:2027},{year:2027,month:2,day:30},{year:2027,month:null,day:2}])assert.equal(evaluatePrediction(c,{...evidence,data:{startDate}},new Date(evidence.observedAt)).status,'PENDING');
  const late=iso(Date.parse(c.resolutionDeadline)+1);assert.equal(evaluatePrediction(c,{...evidence,observedAt:late},new Date(late)).result,null);
});
test('evidence hash is deterministic, covers nested values, independent of key order',()=>{
  assert.equal(evidenceHash({z:1,a:{c:2,b:3}}),evidenceHash({a:{b:3,c:2},z:1}));assert.notEqual(evidenceHash({data:{score:80}}),evidenceHash({data:{score:81}}));
});
test('small sample never displays deceptive percentages',()=>{
  assert.deepEqual(predictionConsensus(1,0),{ready:false,minVotes:20,yesPercent:null,noPercent:null});assert.equal(predictionConsensus(19,0).ready,false);
  assert.deepEqual(predictionConsensus(13,7),{ready:true,minVotes:20,yesPercent:65,noPercent:35});
});
test('confidence ranking penalizes a one-off perfect guess compared with extensive evidence',()=>{
  assert.ok(wilsonLowerBound(742,837)>wilsonLowerBound(1,1));assert.equal(wilsonLowerBound(0,0),0);assert.equal(wilsonLowerBound(3,2),0);assert.ok(wilsonLowerBound(20,20)>wilsonLowerBound(19,20));
});
test('public shape exposes aggregate statistics but no raw baseline, dedupe or user IDs',()=>{
  const c=base();const item=publicPrediction({id:'x',media_id:'101',media_type:'ANIME',media_title:'Teste',source:'AniList',source_url:c.sourceUrl,status:'OPEN',opens_at:c.opensAt,closes_at:c.closesAt,resolution_deadline:c.resolutionDeadline,yes_count:'1',no_count:0,dedupe_key:'private',baseline:c.baseline,user_id:'private'});
  assert.equal(item.mediaId,101);assert.equal(item.consensus.yesPercent,null);assert.equal('baseline' in item,false);assert.equal('dedupe_key' in item,false);assert.equal('user_id' in item,false);
});
test('public trend identifies partial history without inventing past votes',()=>{
  const c=base(),row={id:'x',media_id:'101',media_type:'ANIME',media_title:'Teste',status:'OPEN',opens_at:c.opensAt,closes_at:c.closesAt,resolution_deadline:c.resolutionDeadline,yes_count:1,no_count:0,trend_since:'2026-10-01T11:00:00Z',trend_yes:1,trend_no:0,trend_complete:false};
  assert.deepEqual(publicPrediction(row,now).trend24h,{yesDelta:0,noDelta:0,since:'2026-10-01T11:00:00.000Z',completeWindow:false});
  assert.equal(publicPrediction({...row,trend_since:null},now).trend24h,null);
});
test('feature disabled makes every endpoint 404 without database or authentication calls',async()=>{
  const authRate={preValidation:()=>{throw Error('auth rate called')}};
  const app=Fastify();registerPredictions(app,{privateReadRate:authRate,writeRate:authRate,pool:{connect:()=>{throw Error('database called')}},q:()=>{throw Error('database called')},requireUser:()=>{throw Error('auth called')}});
  try{for(const url of ['/api/predictions','/api/predictions/ranking','/api/predictions/2fd13c11-1641-4e40-bae3-292528e6a9c8','/api/me/predictions']){const response=await app.inject({url});assert.equal(response.statusCode,404);assert.equal(response.json().error,'FEATURE_DISABLED');assert.equal(response.headers['cache-control'],'no-store')}
    const response=await app.inject({url:'/api/me/predictions/2fd13c11-1641-4e40-bae3-292528e6a9c8/vote',method:'PUT',payload:{choice:'YES'}});assert.equal(response.statusCode,404);
  }finally{await app.close()}
});
test('enabled endpoints validate IDs, filter input and private authorization',async()=>{
  const app=Fastify();registerPredictions(app,{enabled:true,pool:{},q:()=>{throw Error('database called')},requireUser:async(req,reply)=>{reply.code(401).send({error:'UNAUTHORIZED'});return null}});
  try{for(const url of ['/api/predictions?filter=malicious','/api/predictions?mediaId=-2','/api/predictions?offset=999999','/api/predictions/nope'])assert.equal((await app.inject({url})).statusCode,400);
    for(const request of [{url:'/api/me/predictions'},{url:'/api/me/predictions/2fd13c11-1641-4e40-bae3-292528e6a9c8/vote',method:'PUT',payload:{choice:'YES'}}]){const response=await app.inject(request);assert.equal(response.statusCode,401);assert.equal(response.headers['cache-control'],'no-store')}
  }finally{await app.close()}
});
test('vote checks wall clock after row lock (never transaction start time)',async()=>{
  const calls=[],c=base(),client={release(){},async query(sql){calls.push(sql);if(sql.startsWith('SELECT * FROM'))return{rows:[{...c,opens_at:c.opensAt,closes_at:c.closesAt,status:'OPEN'}]};if(sql.includes('clock_timestamp() AS prediction_now'))return{rows:[{prediction_now:c.closesAt}]};return{rows:[]}}};
  const result=await votePrediction({connect:async()=>client},'question','user','YES');assert.equal(result.error,'PREDICTION_CLOSED');assert.ok(calls.findIndex(s=>s.includes('FOR UPDATE'))<calls.findIndex(s=>s.includes('clock_timestamp() AS prediction_now')));assert.equal(calls.some(s=>s.startsWith('INSERT INTO prediction_votes')),false);
});
test('vote retains its validated database acceptance time if INSERT crosses the deadline',async()=>{
  const c=base(),acceptedAt=new Date(Date.parse(c.closesAt)-1),afterDeadline=new Date(Date.parse(c.closesAt)+1);
  const question={...c,id:'question',status:'OPEN',media_id:101,media_type:'ANIME',opens_at:c.opensAt,closes_at:c.closesAt,resolution_deadline:c.resolutionDeadline};
  let simulatedClock=acceptedAt,savedTimestamp=null,insertSql='';
  const client={release(){},async query(sql,params=[]){
    if(sql.startsWith('SELECT * FROM'))return{rows:[question]};
    if(sql.includes('clock_timestamp() AS prediction_now'))return{rows:[{prediction_now:simulatedClock}]};
    if(sql.startsWith('INSERT INTO prediction_votes')){
      // Simulate I/O latency after the locked validation. Calling the clock here
      // would invalidate or overwrite a previously valid choice at resolution.
      simulatedClock=afterDeadline;insertSql=sql;savedTimestamp=params[4];
      return{rows:[{choice:params[2],eligible:true,updated_at:savedTimestamp}]};
    }
    if(sql.startsWith('SELECT p.*'))return{rows:[{...question,yes_count:1,no_count:0}]};
    return{rows:[]};
  }};
  const result=await votePrediction({connect:async()=>client},'question','user','YES');
  assert.ok(+simulatedClock>Date.parse(c.closesAt));assert.equal(+savedTimestamp,+acceptedAt);
  assert.equal(result.userVote.updatedAt,acceptedAt.toISOString());assert.equal(result.userVote.eligible,true);
  assert.match(insertSql,/confidence_pct,created_at,updated_at\) VALUES\(\$1,\$2,\$3,\$4,\$5,\$5\)/);
  assert.match(insertSql,/updated_at=EXCLUDED.updated_at/);assert.doesNotMatch(insertSql,/clock_timestamp|now\(\)/);
});

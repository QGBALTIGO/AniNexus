import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import pg from 'pg';
import Fastify from 'fastify';
import {generatePredictionCandidate,publishPrediction,votePrediction,resolvePrediction,lockPredictions,registerPredictions,predictionStatsSql} from '../lib/predictions.mjs';
import * as predictionCore from '../lib/predictions.mjs';
import {createPredictionsWorker,nextPredictionDeadline,predictionWeek} from '../lib/predictions-worker.mjs';

const connectionString=process.env.MEDIA_TEST_DATABASE_URL;
if(!connectionString)throw new Error('MEDIA_TEST_DATABASE_URL is required; only use an isolated test database');
const schema='predictions_test_'+randomBytes(8).toString('hex');
const bootstrap=new pg.Client({connectionString});await bootstrap.connect();
const pool=new pg.Pool({connectionString,options:`-c search_path=${schema},public`,max:8});
const query=pool.query.bind(pool),user=randomUUID(),other=randomUUID(),observer=randomUUID(),app=Fastify();
let checks=0;
const check=()=>checks++;
try{
  await bootstrap.query(`CREATE SCHEMA ${schema}`);
  // Validate against the actual deployed account/notification definitions, not a
  // permissive stub that could conceal a column, enum or length mismatch.
  for(const file of ['schema.sql','002_notifications_and_accounts.sql','009_clerk_identity_and_preferences.sql','011_administration_and_moderation.sql','012_public_profiles.sql','028_profile_settings_and_list_transfers.sql'])await query(await fs.readFile(new URL(`../sql/${file}`,import.meta.url),'utf8'));
  const migration=await fs.readFile(new URL('../sql/035_predictions.sql',import.meta.url),'utf8');await query(migration);await query(migration);check();
  const detailMigration=await fs.readFile(new URL('../sql/037_prediction_detail.sql',import.meta.url),'utf8');await query(detailMigration);await query(detailMigration);check();
  await query("INSERT INTO users(id,username,email) VALUES($1,'alice','alice@example.test'),($2,'bob','bob@example.test'),($3,'observer','observer@example.test')",[user,other,observer]);
  const now=new Date((await query('SELECT clock_timestamp() now')).rows[0].now);
  const c=generatePredictionCandidate({mediaId:101,mediaType:'ANIME',title:'Teste SQL',averageScore:80},{now}).candidate;
  const publications=await Promise.all(Array.from({length:5},()=>publishPrediction(pool,c)));
  assert.equal(publications.filter(item=>item.created).length,1);assert.equal(new Set(publications.map(item=>item.item.id)).size,1);check();
  const id=publications[0].item.id;
  assert.equal((await query('SELECT yes_count,no_count FROM prediction_snapshots WHERE question_id=$1',[id])).rows.length,1);
  const votes=await Promise.all(Array.from({length:10},(_,i)=>votePrediction(pool,id,user,i%2?'YES':'NO')));
  assert.equal(votes.every(result=>!result.error),true);assert.equal((await query('SELECT count(*) FROM prediction_votes WHERE question_id=$1',[id])).rows[0].count,'1');
  assert.equal((await query('SELECT count(*) FROM prediction_snapshots WHERE question_id=$1',[id])).rows[0].count,'11');check();
  assert.equal((await votePrediction(pool,id,user,'YES')).userVote.choice,'YES');assert.equal((await votePrediction(pool,id,other,'NO')).item.voteCount,2);check();
  assert.equal((await votePrediction(pool,id,user,'YES',75)).userVote.confidence,75);
  assert.equal((await query('SELECT confidence_pct FROM prediction_votes WHERE question_id=$1 AND user_id=$2',[id,user])).rows[0].confidence_pct,75);check();
  const trendItem=(await votePrediction(pool,id,user,'YES')).item;assert.equal(trendItem.trend24h.yesDelta,1);assert.equal(trendItem.trend24h.noDelta,1);assert.equal(trendItem.trend24h.completeWindow,false);check();
  await assert.rejects(query("UPDATE prediction_questions SET question='Critério alterado indevidamente' WHERE id=$1",[id]),/PREDICTION_CRITERIA_IMMUTABLE/);check();

  // Fixtures deliberately insert past timelines into this disposable schema;
  // application publication cannot create a question after its closing time.
  async function fixture({deadlineOffset=-1000,closeOffset=-86401000,status='LOCKED',type='SCORE_AT_DEADLINE',mediaId=101}={}){
    const result=await query(`INSERT INTO prediction_questions(dedupe_key,media_id,media_type,media_title,cover,type,question,criteria,source,source_url,rule,baseline,status,opens_at,closes_at,resolution_deadline)
      SELECT $2,$7::bigint,media_type,media_title,cover,$6,question,criteria,source,'https://anilist.co/anime/'||$7::text,rule,baseline,$5,clock_timestamp()-interval '8 days',clock_timestamp()+($3::text||' milliseconds')::interval,clock_timestamp()+($4::text||' milliseconds')::interval FROM prediction_questions WHERE id=$1 RETURNING *`,[id,randomUUID(),closeOffset,deadlineOffset,status,type,mediaId]);return result.rows[0];
  }
  async function addVote(questionId,choice='YES',uid=user,offset=-172800000){await query(`INSERT INTO prediction_votes(question_id,user_id,choice,created_at,updated_at) VALUES($1,$2,$3,clock_timestamp()+($4::text||' milliseconds')::interval,clock_timestamp()+($4::text||' milliseconds')::interval)`,[questionId,uid,choice,offset]);}
  const ready=await fixture();await addVote(ready.id);await addVote(ready.id,'NO',other);
  const trendMigration=await fs.readFile(new URL('../sql/036_prediction_trend_baseline.sql',import.meta.url),'utf8');
  await query(trendMigration);await query(trendMigration);
  assert.deepEqual((await query('SELECT yes_count,no_count FROM prediction_snapshots WHERE question_id=$1',[ready.id])).rows,[{yes_count:1,no_count:1}]);check();
  const evidence={source:'AniList',mediaId:101,mediaType:'ANIME',observedAt:new Date((await query('SELECT clock_timestamp() now')).rows[0].now).toISOString(),data:{averageScore:83}};
  const resolutions=await Promise.all(Array.from({length:5},()=>resolvePrediction(pool,ready.id,evidence)));
  assert.equal(resolutions.filter(r=>!r.idempotent).length,1);assert.equal(resolutions.every(r=>r.result==='YES'),true);
  assert.equal((await query('SELECT count(*) FROM prediction_resolutions WHERE question_id=$1',[ready.id])).rows[0].count,'1');
  assert.equal((await query('SELECT count(*) FROM notifications WHERE dedupe_key=$1',[`prediction:${ready.id}`])).rows[0].count,'2');check();
  assert.equal((await resolvePrediction(pool,ready.id,{...evidence,data:{averageScore:0}})).result,'YES');check();
  await assert.rejects(query("UPDATE prediction_resolutions SET outcome='NO' WHERE question_id=$1",[ready.id]),/PREDICTION_EVIDENCE_IMMUTABLE/);
  await assert.rejects(query('DELETE FROM prediction_resolutions WHERE question_id=$1',[ready.id]),/PREDICTION_EVIDENCE_IMMUTABLE/);
  await assert.rejects(query("UPDATE prediction_questions SET result='NO' WHERE id=$1",[ready.id]),/PREDICTION_FINAL/);check();
  assert.equal((await votePrediction(pool,ready.id,user,'NO')).error,'PREDICTION_CLOSED');check();
  const missing=await fixture();assert.equal((await resolvePrediction(pool,missing.id,null)).status,'PENDING');check();
  const expired=await fixture({deadlineOffset:-3601000,closeOffset:-90001000});await addVote(expired.id);const voided=await resolvePrediction(pool,expired.id,null);assert.equal(voided.status,'VOID');assert.equal(voided.result,null);check();
  const userStats=(await query(predictionStatsSql,[user])).rows[0];assert.equal(userStats.resolved,1);assert.equal(userStats.correct,1);assert.equal(userStats.voided,1);assert.equal(userStats.reputation_points,50);check();
  const wrong=await fixture();assert.equal((await resolvePrediction(pool,wrong.id,{...evidence,mediaId:102})).status,'PENDING');check();
  const due=await fixture({status:'OPEN'});const locked=await lockPredictions(pool);assert.ok(locked.locked>=1);assert.equal((await query('SELECT status FROM prediction_questions WHERE id=$1',[due.id])).rows[0].status,'LOCKED');check();
  // Retry retains the original even though this modified retry payload is expired.
  const retry=await publishPrediction(pool,{...c,closesAt:'2000-01-01T00:00:00Z'});assert.equal(retry.created,false);assert.equal(retry.item.id,id);check();

  // A vote waiting on the question lock must use current time after the wait.
  const closing=await fixture({deadlineOffset:86401000,closeOffset:200,status:'OPEN'}),holder=await pool.connect();
  try{await holder.query('BEGIN');await holder.query('SELECT id FROM prediction_questions WHERE id=$1 FOR UPDATE',[closing.id]);
    const waiting=votePrediction(pool,closing.id,user,'YES');await new Promise(resolve=>setTimeout(resolve,350));await holder.query('COMMIT');assert.equal((await waiting).error,'PREDICTION_CLOSED');check();
  }finally{await holder.query('ROLLBACK');holder.release()}
  // Date observations arriving late invalidate choices made after observation,
  // rather than awarding reputation to a user who already knew the outcome.
  const dated=await fixture({type:'CATALOG_DATE_OBSERVED',status:'OPEN',closeOffset:86400000,deadlineOffset:172800000});
  await addVote(dated.id,'YES',user,-1000);await addVote(dated.id,'NO',other,-20000);
  const dateEvidence={...evidence,observedAt:new Date(Date.now()-10000).toISOString(),data:{startDate:{year:2027,month:1,day:8}}};
  assert.equal((await resolvePrediction(pool,dated.id,dateEvidence)).result,'YES');const eligibility=(await query('SELECT user_id,eligible FROM prediction_votes WHERE question_id=$1',[dated.id])).rows;
  assert.equal(eligibility.find(v=>v.user_id===user).eligible,false);assert.equal(eligibility.find(v=>v.user_id===other).eligible,true);check();

  registerPredictions(app,{enabled:true,pool,q:query,requireUser:async(req,reply)=>{if(req.headers['x-test-user'])return{id:req.headers['x-test-user']};reply.code(401).send({error:'UNAUTHORIZED'});return null}});
  for(const filter of ['hot','new','closing','divided','resolved']){const response=await app.inject({url:`/api/predictions?filter=${filter}`});assert.equal(response.statusCode,200,response.body);assert.ok(Array.isArray(response.json().items));}check();
  let response=await app.inject({url:`/api/me/predictions?ids=${ready.id}`,headers:{'x-test-user':user}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().items.length,1);assert.equal(response.json().items[0].userVote.choice,'YES');assert.equal(response.headers['cache-control'],'no-store');check();
  await votePrediction(pool,id,user,'YES',75);
  response=await app.inject({url:`/api/predictions/${id}/detail`});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().collective.votes,2);assert.equal(response.json().collective.weightedYesPercent,60);assert.ok(response.json().history.length>=3);check();
  response=await app.inject({url:`/api/me/predictions/${id}/vote`,method:'PUT',headers:{'x-test-user':user},payload:{choice:'YES',confidence:17}});assert.equal(response.statusCode,422);check();
  response=await app.inject({url:`/api/me/predictions/${id}/follow`,method:'PUT',headers:{'x-test-user':observer},payload:{following:true}});assert.equal(response.statusCode,200);assert.equal(response.json().following,true);
  response=await app.inject({url:`/api/me/predictions/${id}/detail`,headers:{'x-test-user':observer}});assert.equal(response.json().following,true);assert.equal(response.json().userVote,null);check();
  response=await app.inject({url:`/api/me/predictions/${id}/argument`,method:'PUT',headers:{'x-test-user':observer},payload:{text:'Preciso votar antes de publicar.'}});assert.equal(response.statusCode,403);check();
  response=await app.inject({url:`/api/me/predictions/${id}/argument`,method:'PUT',headers:{'x-test-user':user},payload:{text:'A nota da fonte parece estável nesta semana.'}});assert.equal(response.statusCode,200,response.body);
  response=await app.inject({url:`/api/predictions/${id}/detail`});assert.equal(response.json().arguments.length,1);assert.equal(response.json().arguments[0].author.username,'alice');check();
  response=await app.inject({url:`/api/me/predictions/${id}/follow`,method:'PUT',headers:{'x-test-user':observer},payload:{following:false}});assert.equal(response.json().following,false);check();
  response=await app.inject({url:`/api/me/predictions?ids=${ready.id}&offset=1`,headers:{'x-test-user':user}});assert.equal(response.statusCode,400);check();
  response=await app.inject({url:'/api/predictions/ranking'});assert.equal(response.statusCode,200,response.body);assert.deepEqual(response.json().items,[]);assert.equal(response.json().minimumResolved,20);check();
  response=await app.inject({url:'/api/me/predictions'});assert.equal(response.statusCode,401);check();
  response=await app.inject({url:`/api/me/predictions/${id}/vote`,method:'PUT',headers:{'x-test-user':user},payload:{choice:'NO',userId:other}});assert.equal(response.statusCode,422);check();
  // Exercise nonempty Wilson ranking and public-profile privacy filtering.
  for(let i=0;i<20;i++){const ranked=await fixture();await addVote(ranked.id);await resolvePrediction(pool,ranked.id,{...evidence,observedAt:new Date((await query('SELECT clock_timestamp() now')).rows[0].now).toISOString()});}
  response=await app.inject({url:'/api/predictions/ranking'});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().items[0].username,'alice');assert.ok(response.json().items[0].confidence>0);check();
  await query("UPDATE users SET privacy='private' WHERE id=$1",[user]);response=await app.inject({url:'/api/predictions/ranking'});assert.deepEqual(response.json().items,[]);
  response=await app.inject({url:`/api/predictions/${id}/detail`});assert.deepEqual(response.json().arguments,[]);check();

  // Real worker integration: only HTTP is mocked; all locking, state, publication,
  // resolution and notification writes use the real PostgreSQL transaction code.
  const dbNow=async()=>new Date((await query('SELECT clock_timestamp() now')).rows[0].now);
  const httpResponse=media=>new Response(JSON.stringify({data:{Page:{media}}}),{status:200});
  const feed=Array.from({length:20},(_,index)=>({id:900000+index,type:'ANIME',status:'RELEASING',popularity:12000,averageScore:80,title:{romaji:`Worker Test ${index}`},coverImage:{large:'https://example.test/cover.jpg'}}));
  let fetchCalls=0;
  const sourceFetch=async(_url,options)=>{fetchCalls++;const request=JSON.parse(options.body);return httpResponse(request.variables?.ids?request.variables.ids.map(mediaId=>({id:mediaId,type:'ANIME',averageScore:83})):feed)};
  const workerOptions={pool,enabled:true,authorized:true,logger:{},fetchImpl:sourceFetch};
  const week=predictionWeek(nextPredictionDeadline(await dbNow()));
  const existingInWeek=Number((await query('SELECT count(*) FROM prediction_questions WHERE resolution_deadline >= $1 AND resolution_deadline < $2',[week.start,week.end])).rows[0].count);
  assert.ok(existingInWeek<10,'Fixture volume must leave space to exercise automatic publication');
  const published=await createPredictionsWorker(workerOptions).cycle();assert.equal(published.status,'OK',JSON.stringify(published));assert.equal(published.published,10-existingInWeek);
  assert.equal(Number((await query('SELECT count(*) FROM prediction_questions WHERE resolution_deadline >= $1 AND resolution_deadline < $2',[week.start,week.end])).rows[0].count),10);check();
  const firstFetchCalls=fetchCalls;const restarted=await createPredictionsWorker(workerOptions).cycle();assert.equal(restarted.status,'OK');assert.equal(restarted.published,0);assert.equal(fetchCalls,firstFetchCalls,'Restart must preserve discovery cooldown');check();
  await query("UPDATE prediction_job_state SET next_run_at=clock_timestamp()-interval '1 second' WHERE name='discovery'");
  const capped=await createPredictionsWorker(workerOptions).cycle();assert.equal(capped.published,0);assert.equal(fetchCalls,firstFetchCalls,'Weekly capacity is enforced before source fetch');check();
  const uniqueAuto=(await query("SELECT count(*)::int total,count(DISTINCT dedupe_key)::int unique_keys,count(DISTINCT media_id)::int media FROM prediction_questions WHERE dedupe_key LIKE 'auto-score:%'")).rows[0];
  assert.equal(uniqueAuto.total,10-existingInWeek);assert.equal(uniqueAuto.total,uniqueAuto.unique_keys);assert.equal(uniqueAuto.total,uniqueAuto.media);check();

  const resolvedByWorker=await fixture({mediaId:800001});await addVote(resolvedByWorker.id);
  const workerResolution=await createPredictionsWorker(workerOptions).cycle();assert.equal(workerResolution.status,'OK');assert.equal(workerResolution.resolved,1);
  const saved=(await query('SELECT details FROM prediction_job_state WHERE name=$1',[`observation:${resolvedByWorker.id}`])).rows[0].details.observation;
  const persisted=(await query('SELECT evidence FROM prediction_resolutions WHERE question_id=$1',[resolvedByWorker.id])).rows[0].evidence;
  assert.deepEqual(persisted.observation,saved);assert.equal(persisted.observation.data.averageScore,83);check();
  const beforeFinal=fetchCalls;await createPredictionsWorker(workerOptions).cycle();assert.equal(fetchCalls,beforeFinal,'Final rows must not be re-observed');assert.equal((await query('SELECT count(*) FROM notifications WHERE dedupe_key=$1',[`prediction:${resolvedByWorker.id}`])).rows[0].count,'1');check();

  const crashQuestion=await fixture({mediaId:800002});await addVote(crashQuestion.id);
  const batchQuestion=await fixture({mediaId:800007});await addVote(batchQuestion.id);
  const crashingCore={...predictionCore,async resolvePrediction(...args){if(args[1]===crashQuestion.id)throw new Error('SIMULATED_CRASH_AFTER_DURABLE_OBSERVATION');return predictionCore.resolvePrediction(...args)}};
  const interrupted=await createPredictionsWorker({...workerOptions,core:crashingCore}).cycle();assert.equal(interrupted.status,'ERROR');
  const durable=(await query('SELECT details FROM prediction_job_state WHERE name=$1',[`observation:${crashQuestion.id}`])).rows[0].details.observation;
  assert.equal(durable.data.averageScore,83);assert.equal((await query('SELECT status FROM prediction_questions WHERE id=$1',[crashQuestion.id])).rows[0].status,'LOCKED');check();
  // Every observation in the same HTTP response must be durable BEFORE resolving
  // its first question. A failure on A cannot erase the first valid reading of B.
  const durableBatchRow=(await query('SELECT details FROM prediction_job_state WHERE name=$1',[`observation:${batchQuestion.id}`])).rows[0];
  assert.ok(durableBatchRow,'Snapshot B must exist even though resolver A failed');
  const durableBatch=durableBatchRow.details.observation;
  assert.equal(durableBatch.data.averageScore,83);assert.equal(durableBatch.observedAt,durable.observedAt);
  assert.equal((await query('SELECT status FROM prediction_questions WHERE id=$1',[batchQuestion.id])).rows[0].status,'LOCKED');check();
  let recoveryFetchCalls=0;
  const recovered=await createPredictionsWorker({...workerOptions,fetchImpl:async()=>{recoveryFetchCalls++;throw new Error('A later source score could differ; both original snapshots must be recovered without another HTTP call')}}).cycle();assert.equal(recovered.status,'OK');assert.equal(recovered.resolved,2);assert.equal(recoveryFetchCalls,0);
  assert.deepEqual((await query('SELECT evidence FROM prediction_resolutions WHERE question_id=$1',[crashQuestion.id])).rows[0].evidence.observation,durable);
  assert.deepEqual((await query('SELECT evidence FROM prediction_resolutions WHERE question_id=$1',[batchQuestion.id])).rows[0].evidence.observation,durableBatch);
  assert.equal((await query('SELECT result FROM prediction_questions WHERE id=$1',[batchQuestion.id])).rows[0].result,'YES');
  assert.equal((await query('SELECT count(*) FROM notifications WHERE dedupe_key=$1',[`prediction:${batchQuestion.id}`])).rows[0].count,'1');check();
  const lateRecovery=await fixture({mediaId:800003,deadlineOffset:-7200000,closeOffset:-93600000});await addVote(lateRecovery.id);
  const historical={source:'AniList',mediaId:800003,mediaType:'ANIME',observedAt:new Date(+new Date(lateRecovery.resolution_deadline)+1000).toISOString(),data:{averageScore:79}};
  await query('INSERT INTO prediction_job_state(name,next_run_at,details) VALUES($1,clock_timestamp(),$2::jsonb)',[`observation:${lateRecovery.id}`,JSON.stringify({observation:historical})]);
  const lateResult=await createPredictionsWorker({...workerOptions,fetchImpl:async()=>{throw Error('No refetch allowed after deadline')}}).cycle();assert.equal(lateResult.resolved,1);assert.equal((await query('SELECT result FROM prediction_questions WHERE id=$1',[lateRecovery.id])).rows[0].result,'NO');check();
  const noScore=await fixture({mediaId:800004});await addVote(noScore.id);
  const unavailable=await createPredictionsWorker({...workerOptions,fetchImpl:async()=>httpResponse([{id:800004,type:'ANIME',averageScore:null}])}).cycle();assert.equal(unavailable.status,'OK');assert.equal(unavailable.pending,1);assert.equal((await query('SELECT result FROM prediction_questions WHERE id=$1',[noScore.id])).rows[0].result,null);check();
  await createPredictionsWorker(workerOptions).cycle();
  const exhausted=await fixture({mediaId:800005,deadlineOffset:-3601000,closeOffset:-90001000});await addVote(exhausted.id);
  const expiredResult=await createPredictionsWorker({...workerOptions,fetchImpl:async()=>{throw Error('Expired window needs no request')}}).cycle();assert.equal(expiredResult.voided,1);assert.equal((await query('SELECT status,result FROM prediction_questions WHERE id=$1',[exhausted.id])).rows[0].status,'VOID');check();

  // A separate Node process holds the real session-level advisory lock while its
  // HTTP request is paused. Another worker must exit before touching the source.
  const concurrent=await fixture({mediaId:800006});await addVote(concurrent.id);
  const workerUrl=new URL('../lib/predictions-worker.mjs',import.meta.url).href;
  const childScript=`import pg from 'pg';import {createPredictionsWorker} from ${JSON.stringify(workerUrl)};
    const pool=new pg.Pool({connectionString:process.env.MEDIA_TEST_DATABASE_URL,options:'-c search_path='+process.env.PREDICTION_TEST_SCHEMA+',public',max:3});
    let held=false;try{const worker=createPredictionsWorker({pool,enabled:true,authorized:true,logger:{},timeoutMs:30000,fetchImpl:async(_url,options)=>{
      if(!held){held=true;process.send({type:'FETCH_LOCKED'});await new Promise(resolve=>process.once('message',resolve));}
      const ids=JSON.parse(options.body).variables.ids||[];return new Response(JSON.stringify({data:{Page:{media:ids.map(id=>({id,type:'ANIME',averageScore:83}))}}}),{status:200});}});
      const result=await worker.cycle();process.send({type:'DONE',result});}catch(error){process.send({type:'FAILED',code:error.code||'TEST_FAILURE'});process.exitCode=1}finally{await pool.end();process.disconnect()}`;
  const child=spawn(process.execPath,['--input-type=module','-e',childScript],{cwd:new URL('..',import.meta.url),env:{...process.env,PREDICTION_TEST_SCHEMA:schema},stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});
  const messages=[],waiters=new Set();let childError='';
  child.stderr.on('data',chunk=>{childError=(childError+chunk.toString()).slice(-2000)});
  child.on('message',message=>{messages.push(message);for(const wake of waiters)wake()});
  const waitMessage=type=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>finish(new Error(`Child ${type} timed out: ${childError}`)),15000);
    const inspect=()=>{const error=messages.find(message=>message.type==='FAILED');if(error)return finish(new Error(error.code));const found=messages.find(message=>message.type===type);if(found)return finish(null,found);if(child.exitCode!==null)return finish(new Error(`Child exited ${child.exitCode}: ${childError}`))};
    const finish=(error,value)=>{clearTimeout(timeout);waiters.delete(inspect);child.off('exit',inspect);error?reject(error):resolve(value)};waiters.add(inspect);child.on('exit',inspect);inspect()});
  try{
    await waitMessage('FETCH_LOCKED');
    const excluded=await createPredictionsWorker({...workerOptions,fetchImpl:async()=>{throw Error('Competing worker must not fetch')}}).cycle();assert.equal(excluded.status,'LOCKED_BY_OTHER_WORKER');check();
    child.send({release:true});const completed=await waitMessage('DONE');assert.equal(completed.result.status,'OK');assert.equal(completed.result.resolved,1);
    assert.equal((await query('SELECT count(*) FROM prediction_resolutions WHERE question_id=$1',[concurrent.id])).rows[0].count,'1');assert.equal((await query('SELECT count(*) FROM notifications WHERE dedupe_key=$1',[`prediction:${concurrent.id}`])).rows[0].count,'1');check();
  }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve)})}}
  const reacquired=await createPredictionsWorker(workerOptions).cycle();assert.equal(reacquired.status,'OK');check();
  console.log(`Predictions database: ${checks} checks passed (real account migrations, transactions, worker restart, snapshots, multiprocess locks, privacy, ranking, API).`);
}finally{
  await app.close();await pool.end();
  // This name is generated above, never comes from user input or env variables.
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await bootstrap.end();
}

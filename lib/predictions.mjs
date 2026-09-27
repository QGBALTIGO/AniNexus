import {createHash} from 'node:crypto';
import {z} from 'zod';

export const MIN_CONSENSUS_VOTES=20;
export const MIN_RANKED_PREDICTIONS=20;
const hour=3600000;
const iso=z.string().datetime({offset:true});
const mediaId=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const choice=z.enum(['YES','NO']);
const source='AniList';
const observationSchema=z.object({
  source:z.literal(source),mediaId,mediaType:z.enum(['ANIME','MANGA']),observedAt:iso,
  data:z.object({averageScore:z.number().int().min(0).max(100).nullable().optional(),
    startDate:z.object({year:z.number().int().min(1900).max(2200).nullable().optional(),month:z.number().int().min(1).max(12).nullable().optional(),day:z.number().int().min(1).max(31).nullable().optional()}).optional(),
    status:z.string().max(50).optional(),popularity:z.number().int().nonnegative().optional()}).strict(),
}).strict();
const candidateSchema=z.object({
  dedupeKey:z.string().min(1).max(200),mediaId,mediaType:z.enum(['ANIME','MANGA']),mediaTitle:z.string().trim().min(1).max(300),
  cover:z.string().url().max(2000).refine(value=>value.startsWith('https://')).nullable().optional(),
  type:z.enum(['CATALOG_DATE_OBSERVED','SCORE_AT_DEADLINE']),question:z.string().trim().min(10).max(500),criteria:z.string().trim().min(20).max(3000),
  source:z.literal(source),sourceUrl:z.string().url(),opensAt:iso,closesAt:iso,resolutionDeadline:iso,
  rule:z.object({threshold:z.number().int().min(0).max(100).optional(),windowSeconds:z.literal(3600).default(3600)}).strict(),
  baseline:observationSchema,
}).strict();
const time=value=>new Date(value).getTime();
const asIso=value=>value?new Date(value).toISOString():null;
const isFullDate=value=>{if(!value?.year||!value.month||!value.day)return false;const date=new Date(Date.UTC(value.year,value.month-1,value.day));return date.getUTCFullYear()===value.year&&date.getUTCMonth()===value.month-1&&date.getUTCDate()===value.day};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const evidenceHash=evidence=>createHash('sha256').update(JSON.stringify(canonical(evidence))).digest('hex');

export function validatePredictionCandidate(input,now=new Date()) {
  const parsed=candidateSchema.safeParse(input);
  if(!parsed.success)return{ok:false,error:'INVALID_CANDIDATE'};
  const c=parsed.data,clock=time(now),opened=time(c.opensAt),closed=time(c.closesAt),deadline=time(c.resolutionDeadline),observed=time(c.baseline.observedAt);
  if(!Number.isFinite(clock)||opened>clock||closed<=clock||closed<=opened||deadline-closed<24*hour||deadline-clock>90*24*hour)return{ok:false,error:'INVALID_WINDOW'};
  if(c.baseline.source!==c.source||c.baseline.mediaId!==c.mediaId||c.baseline.mediaType!==c.mediaType||c.sourceUrl!==`https://anilist.co/${c.mediaType.toLowerCase()}/${c.mediaId}`)return{ok:false,error:'SOURCE_MISMATCH'};
  if(observed>clock||clock-observed>hour)return{ok:false,error:'STALE_BASELINE'};
  if(c.type==='CATALOG_DATE_OBSERVED'&&isFullDate(c.baseline.data.startDate))return{ok:false,error:'ALREADY_KNOWN'};
  if(c.type==='SCORE_AT_DEADLINE'&&(!Number.isFinite(c.rule.threshold)||!Number.isFinite(c.baseline.data.averageScore)||Math.abs(c.rule.threshold-c.baseline.data.averageScore)<1))return{ok:false,error:'INSUFFICIENT_UNCERTAINTY'};
  return{ok:true,candidate:c};
}

// These templates explicitly describe observed catalog values. They do not assert
// an official announcement date, confirmed broadcast, or real-world event.
export function generatePredictionCandidate(media,{now=new Date(),deadline,dedupeKey,type='SCORE_AT_DEADLINE',threshold}={}) {
  const end=new Date(deadline||time(now)+7*24*hour),start=new Date(now),close=new Date(time(end)-24*hour),mediaType=media.mediaType||'ANIME';
  const target=threshold??Math.min(100,Number(media.averageScore)+2),formatted=end.toISOString().replace('T',' ').replace('.000Z',' UTC');
  const baseline={source,mediaId:media.mediaId,mediaType,observedAt:media.observedAt||start.toISOString(),data:{}};
  for(const key of ['averageScore','startDate','status','popularity'])if(media[key]!==undefined)baseline.data[key]=media[key];
  const score=type==='SCORE_AT_DEADLINE';
  const candidate={dedupeKey:dedupeKey||`${type}:${mediaType}:${media.mediaId}:${end.toISOString().slice(0,10)}`,mediaId:media.mediaId,mediaType,mediaTitle:media.title,cover:media.cover||null,type,
    question:score?`${media.title} terá nota média de pelo menos ${target}/100 no AniList na leitura de ${formatted}?`:`O catálogo AniList terá uma data completa de estreia registrada para ${media.title} até ${formatted}?`,
    criteria:score?`SIM se a primeira leitura válida da nota média no AniList, entre ${formatted} e uma hora depois, for maior ou igual a ${target}/100. NÃO se essa nota for menor. Sem uma leitura válida nessa janela, a previsão será anulada, sem efeito na reputação. O valor é uma observação do catálogo, não uma avaliação do AniNexus.`:`SIM se uma data completa e válida (ano, mês e dia) for observada no catálogo AniList até ${formatted}. A observação não comprova a data de um anúncio oficial. Ausência de dados ou falha da fonte não significa NÃO; sem evidência suficiente a previsão será anulada.`,
    source,sourceUrl:`https://anilist.co/${mediaType.toLowerCase()}/${media.mediaId}`,opensAt:start.toISOString(),closesAt:close.toISOString(),resolutionDeadline:end.toISOString(),rule:score?{threshold:target,windowSeconds:3600}:{windowSeconds:3600},baseline};
  return validatePredictionCandidate(candidate,start);
}

function shape(question){return question.resolutionDeadline?question:{...question,mediaId:Number(question.media_id),mediaType:question.media_type,resolutionDeadline:question.resolution_deadline,opensAt:question.opens_at,closesAt:question.closes_at}}
export function evaluatePrediction(question,rawEvidence,now=new Date()) {
  const c=shape(question),clock=time(now),deadline=time(c.resolutionDeadline),end=deadline+3600*1000;
  const pending=reason=>({status:clock>end?'VOID':'PENDING',result:null,reason:clock>end?'NO_VALID_OBSERVATION':reason,evidence:null});
  if(!Number.isFinite(deadline)||!Number.isFinite(clock))return{status:'PENDING',result:null,reason:'INVALID_CLOCK',evidence:null};
  const parsed=observationSchema.safeParse(rawEvidence);
  if(!parsed.success)return pending('MISSING_OR_INVALID_EVIDENCE');
  const evidence=parsed.data,observed=time(evidence.observedAt);
  if(evidence.source!==c.source||evidence.mediaId!==Number(c.mediaId)||evidence.mediaType!==c.mediaType)return pending('SOURCE_MISMATCH');
  if(observed>clock||observed<time(c.opensAt))return pending('INVALID_OBSERVATION_TIME');
  if(c.type==='SCORE_AT_DEADLINE'){
    if(observed<deadline||observed>end)return pending('OUTSIDE_RESOLUTION_WINDOW');
    if(!Number.isFinite(evidence.data.averageScore)||!Number.isFinite(c.rule?.threshold))return pending('SCORE_UNAVAILABLE');
    return{status:'RESOLVED',result:evidence.data.averageScore>=c.rule.threshold?'YES':'NO',reason:'FIRST_VALID_SCORE_OBSERVATION',evidence};
  }
  if(c.type==='CATALOG_DATE_OBSERVED'){
    if(observed>deadline)return pending('AFTER_EVENT_DEADLINE');
    if(!isFullDate(evidence.data.startDate))return pending('DATE_NOT_CONFIRMED');
    return{status:'RESOLVED',result:'YES',reason:'CATALOG_DATE_OBSERVED',evidence};
  }
  return{status:'PENDING',result:null,reason:'UNSUPPORTED_TYPE',evidence:null};
}

export function wilsonLowerBound(correct,total,zScore=1.96){if(!Number.isFinite(correct)||!Number.isFinite(total)||total<=0||correct<0||correct>total)return 0;const p=correct/total,z2=zScore*zScore;return(p+z2/(2*total)-zScore*Math.sqrt((p*(1-p)+z2/(4*total))/total))/(1+z2/total)}
export function predictionConsensus(yes,no){const total=yes+no,ready=total>=MIN_CONSENSUS_VOTES;return{ready,minVotes:MIN_CONSENSUS_VOTES,yesPercent:ready?Math.round(100*yes/total):null,noPercent:ready?100-Math.round(100*yes/total):null}}
export function publicPrediction(row,now=new Date()){
  const yes=Number(row.yes_count||0),no=Number(row.no_count||0);
  const status=row.status==='OPEN'&&time(row.closes_at)<=time(now)?'LOCKED':row.status;
  return{id:row.id,mediaId:Number(row.media_id),mediaType:row.media_type,mediaTitle:row.media_title,cover:row.cover,type:row.type,question:row.question,criteria:row.criteria,source:row.source,sourceUrl:row.source_url,rule:row.rule,status,
    opensAt:asIso(row.opens_at),closesAt:asIso(row.closes_at),resolutionDeadline:asIso(row.resolution_deadline),resolvedAt:asIso(row.resolved_at),createdAt:asIso(row.created_at),result:row.result||null,
    yesCount:yes,noCount:no,voteCount:yes+no,consensus:predictionConsensus(yes,no),
    trend24h:row.trend_since?{yesDelta:yes-Number(row.trend_yes||0),noDelta:no-Number(row.trend_no||0),since:asIso(row.trend_since),completeWindow:!!row.trend_complete}:null,
    evidence:row.evidence||null,evidenceHash:row.evidence_hash||null,resolutionReason:row.resolution_reason||null,
    ...(row.user_choice?{userVote:{choice:row.user_choice,confidence:Number(row.user_confidence||50),eligible:row.user_eligible!==false,updatedAt:asIso(row.vote_updated_at)}}:{})};
}
const counts=`LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE choice='YES')::int yes_count,count(*) FILTER(WHERE choice='NO')::int no_count FROM prediction_votes v WHERE v.question_id=p.id AND v.eligible) c ON true`;
const snapshots=`LEFT JOIN LATERAL (SELECT bucket_at,yes_count,no_count FROM prediction_snapshots s WHERE s.question_id=p.id AND s.bucket_at<=clock_timestamp()-interval '24 hours' ORDER BY bucket_at DESC LIMIT 1) old_snapshot ON true
 LEFT JOIN LATERAL (SELECT bucket_at,yes_count,no_count FROM prediction_snapshots s WHERE s.question_id=p.id ORDER BY bucket_at ASC LIMIT 1) first_snapshot ON true`;
const fields='p.*,c.yes_count,c.no_count,COALESCE(old_snapshot.bucket_at,first_snapshot.bucket_at) trend_since,COALESCE(old_snapshot.yes_count,first_snapshot.yes_count) trend_yes,COALESCE(old_snapshot.no_count,first_snapshot.no_count) trend_no,(old_snapshot.bucket_at IS NOT NULL) trend_complete,r.evidence,r.evidence_hash,r.reason resolution_reason';
const resolutions='LEFT JOIN prediction_resolutions r ON r.question_id=p.id';
async function transaction(pool,fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");const value=await fn(client);await client.query('COMMIT');return value}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release()}}
async function dbClock(client){return new Date((await client.query('SELECT clock_timestamp() AS prediction_now')).rows[0].prediction_now)}
async function getOne(query,id){return(await query(`SELECT ${fields} FROM prediction_questions p ${counts} ${snapshots} ${resolutions} WHERE p.id=$1`,[id])).rows[0]}

export async function publishPrediction(pool,input){return transaction(pool,async client=>{
  if(typeof input?.dedupeKey!=='string'||!input.dedupeKey.length||input.dedupeKey.length>200)throw Object.assign(new Error('INVALID_CANDIDATE'),{code:'INVALID_CANDIDATE'});
  // Serialize discovery retries before checking the publication window. A retry
  // after closing returns the original immutable question, never a second one.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[input.dedupeKey]);
  const existing=(await client.query(`SELECT ${fields} FROM prediction_questions p ${counts} ${snapshots} ${resolutions} WHERE dedupe_key=$1`,[input.dedupeKey])).rows[0];
  if(existing)return{item:publicPrediction(existing),created:false};
  const now=await dbClock(client),validated=validatePredictionCandidate(input,now);if(!validated.ok)throw Object.assign(new Error(validated.error),{code:validated.error});const c=validated.candidate;
  const values=[c.dedupeKey,c.mediaId,c.mediaType,c.mediaTitle,c.cover||null,c.type,c.question,c.criteria,c.source,c.sourceUrl,JSON.stringify(c.rule),JSON.stringify(c.baseline),c.opensAt,c.closesAt,c.resolutionDeadline];
  const created=(await client.query(`INSERT INTO prediction_questions(dedupe_key,media_id,media_type,media_title,cover,type,question,criteria,source,source_url,rule,baseline,opens_at,closes_at,resolution_deadline,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,'OPEN') ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`,values)).rows[0];
  if(created)await client.query('INSERT INTO prediction_snapshots(question_id,bucket_at,yes_count,no_count) VALUES($1,$2,0,0) ON CONFLICT DO NOTHING',[created.id,now]);
  const row=created?await getOne(client.query.bind(client),created.id):(await client.query(`SELECT ${fields} FROM prediction_questions p ${counts} ${snapshots} ${resolutions} WHERE dedupe_key=$1`,[c.dedupeKey])).rows[0];
  return{item:publicPrediction(row),created:!!created};
})}

export async function lockPredictions(pool){return transaction(pool,async client=>{
  const result=await client.query(`WITH due AS (SELECT id FROM prediction_questions WHERE status='OPEN' AND closes_at<=clock_timestamp() ORDER BY closes_at,id FOR UPDATE SKIP LOCKED LIMIT 500)
    UPDATE prediction_questions p SET status='LOCKED',updated_at=clock_timestamp() FROM due WHERE p.id=due.id RETURNING p.id`);return{locked:result.rows.length};
})}

export async function resolvePrediction(pool,id,evidence=null){return transaction(pool,async client=>{
  const row=(await client.query('SELECT * FROM prediction_questions WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!row)return{status:'NOT_FOUND',result:null,reason:'NOT_FOUND'};
  if(['RESOLVED','VOID'].includes(row.status))return{status:row.status,result:row.result,reason:'ALREADY_FINAL',idempotent:true};
  if(row.status==='DRAFT')return{status:'PENDING',result:null,reason:'NOT_PUBLISHED'};
  const now=await dbClock(client),decision=evaluatePrediction(row,evidence,now);
  if(decision.status==='PENDING'){
    if(row.status==='OPEN'&&time(row.closes_at)<=time(now))await client.query("UPDATE prediction_questions SET status='LOCKED',updated_at=clock_timestamp() WHERE id=$1",[id]);
    return decision;
  }
  const audit={source:row.source,sourceUrl:row.source_url,mediaId:Number(row.media_id),mediaType:row.media_type,resolutionDeadline:asIso(row.resolution_deadline),evaluatedAt:now.toISOString(),observation:decision.evidence,reason:decision.reason};
  const hash=evidenceHash(audit),cutoff=decision.evidence?new Date(Math.min(time(row.closes_at),time(decision.evidence.observedAt))):row.closes_at;
  await client.query('UPDATE prediction_votes SET eligible=false WHERE question_id=$1 AND updated_at >= $2',[id,cutoff]);
  await client.query('INSERT INTO prediction_resolutions(question_id,outcome,reason,evidence,evidence_hash) VALUES($1,$2,$3,$4::jsonb,$5)',[id,decision.result,decision.reason,JSON.stringify(audit),hash]);
  await client.query('UPDATE prediction_questions SET status=$2,result=$3,resolved_at=$4,voting_cutoff=$5,updated_at=$4 WHERE id=$1',[id,decision.status,decision.result,now,cutoff]);
  await client.query(`INSERT INTO notifications(user_id,kind,title,body,media_id,url,dedupe_key)
    SELECT interested.user_id,'SYSTEM',$2,$3,$4,$5,'prediction:'||$1::text FROM (
      SELECT user_id FROM prediction_votes WHERE question_id=$1::uuid
      UNION SELECT user_id FROM prediction_follows WHERE question_id=$1::uuid
    ) interested JOIN users u ON u.id=interested.user_id WHERE u.deleted_at IS NULL
    ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,[id,decision.status==='VOID'?'Previsão anulada':'Resultado da sua previsão',`${row.media_title}: ${decision.status==='VOID'?'não houve evidência suficiente; sua reputação não foi alterada.':`resultado ${decision.result==='YES'?'SIM':'NÃO'}. Confira os critérios e a evidência.`}`,row.media_id,`/previsoes?previsao=${id}`]);
  return{status:decision.status,result:decision.result,reason:decision.reason,evidenceHash:hash};
})}

export async function votePrediction(pool,id,userId,vote,confidence=50){return transaction(pool,async client=>{
  const row=(await client.query('SELECT * FROM prediction_questions WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row||row.status==='DRAFT')return{error:'NOT_FOUND',code:404};
  // Read the clock AFTER waiting for the same row lock used by resolution.
  const now=await dbClock(client);
  if(row.status!=='OPEN'||time(row.opens_at)>time(now)||time(row.closes_at)<=time(now)||(row.voting_cutoff&&time(row.voting_cutoff)<=time(now)))return{error:'PREDICTION_CLOSED',code:409};
  if(!choice.safeParse(vote).success||![10,25,50,75,100].includes(confidence))return{error:'INVALID_VOTE',code:422};
  // Acceptance time is the database instant already validated under the question
  // lock, not a second clock reading that could cross the deadline during I/O.
  const result=(await client.query(`INSERT INTO prediction_votes(question_id,user_id,choice,confidence_pct,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5)
    ON CONFLICT(question_id,user_id) DO UPDATE SET choice=EXCLUDED.choice,confidence_pct=EXCLUDED.confidence_pct,updated_at=EXCLUDED.updated_at RETURNING choice,confidence_pct,eligible,updated_at`,[id,userId,vote,confidence,now])).rows[0];
  await client.query(`INSERT INTO prediction_snapshots(question_id,bucket_at,yes_count,no_count)
    SELECT $1,$2,count(*) FILTER(WHERE choice='YES')::int,count(*) FILTER(WHERE choice='NO')::int
    FROM prediction_votes WHERE question_id=$1 AND eligible
    ON CONFLICT(question_id,bucket_at) DO UPDATE SET yes_count=EXCLUDED.yes_count,no_count=EXCLUDED.no_count`,[id,now]);
  return{item:publicPrediction(await getOne(client.query.bind(client),id)),userVote:{choice:result.choice,confidence:Number(result.confidence_pct||confidence),eligible:result.eligible,updatedAt:asIso(result.updated_at)}};
})}

export const predictionStatsSql=`SELECT count(*) FILTER(WHERE p.status='RESOLVED' AND v.eligible)::int resolved,
 count(*) FILTER(WHERE p.status='RESOLVED' AND v.eligible AND v.choice=p.result)::int correct,
 count(*) FILTER(WHERE p.status='VOID')::int voided,count(*) FILTER(WHERE p.status IN ('OPEN','LOCKED'))::int pending,
 (count(*) FILTER(WHERE p.status='RESOLVED' AND v.eligible AND v.choice=p.result)*50
 - count(*) FILTER(WHERE p.status='RESOLVED' AND v.eligible AND v.choice<>p.result)*25)::int reputation_points
 FROM prediction_votes v JOIN prediction_questions p ON p.id=v.question_id WHERE v.user_id=$1`;
const uuid=z.string().uuid();
const listQuery=z.object({filter:z.enum(['hot','new','closing','divided','resolved']).default('hot'),mediaId:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),mediaType:z.enum(['ANIME','MANGA']).optional(),offset:z.coerce.number().int().min(0).max(3000).default(0)}).strict();
export function registerPredictions(app,{pool,q,requireUser,publicRate={},privateReadRate={},writeRate={},enabled=false}){
  const gate=reply=>{reply.header('Cache-Control','no-store');if(!enabled){reply.code(404).send({error:'FEATURE_DISABLED'});return false}return true};
  app.get('/api/predictions',publicRate,async(req,reply)=>{
    if(!gate(reply))return;const parsed=listQuery.safeParse(req.query);if(!parsed.success)return reply.code(400).send({error:'INVALID_FILTER'});const v=parsed.data;
    const order={hot:'(c.yes_count+c.no_count) DESC,p.created_at DESC',new:'p.created_at DESC',closing:'p.closes_at ASC',divided:'abs(c.yes_count-c.no_count)::numeric/NULLIF(c.yes_count+c.no_count,0) ASC NULLS LAST,(c.yes_count+c.no_count) DESC',resolved:'p.resolved_at DESC'}[v.filter];
    const {rows}=await q(`SELECT ${fields} FROM prediction_questions p ${counts} ${snapshots} ${resolutions}
      WHERE p.status ${v.filter==='resolved'?"IN ('RESOLVED','VOID')":"IN ('OPEN','LOCKED')"} AND ($1::bigint IS NULL OR p.media_id=$1) AND ($2::text IS NULL OR p.media_type=$2)
      ${v.filter==='closing'?"AND p.status='OPEN' AND p.closes_at>clock_timestamp()":''} ${v.filter==='divided'?`AND c.yes_count+c.no_count>=${MIN_CONSENSUS_VOTES}`:''}
      ORDER BY ${order},p.id LIMIT 31 OFFSET $3`,[v.mediaId||null,v.mediaType||null,v.offset]);
    return{items:rows.slice(0,30).map(row=>publicPrediction(row)),nextOffset:rows.length>30?v.offset+30:null};
  });
  app.get('/api/predictions/ranking',publicRate,async(req,reply)=>{
    if(!gate(reply))return;
    const {rows}=await q(`WITH stats AS (SELECT v.user_id,count(*)::int total,count(*) FILTER(WHERE v.choice=p.result)::int correct FROM prediction_votes v JOIN prediction_questions p ON p.id=v.question_id WHERE p.status='RESOLVED' AND v.eligible GROUP BY v.user_id HAVING count(*)>=${MIN_RANKED_PREDICTIONS}),
      scored AS (SELECT *,((correct::numeric/total+3.8416/(2*total)-1.96*sqrt(((correct::numeric/total)*(1-correct::numeric/total)+3.8416/(4*total))/total))/(1+3.8416/total)) confidence FROM stats)
      SELECT u.username,u.display_name,u.avatar_url,s.total,s.correct,s.confidence FROM scored s JOIN users u ON u.id=s.user_id
      WHERE u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' AND u.show_stats=true ORDER BY s.confidence DESC,s.total DESC,u.username LIMIT 50`);
    return{items:rows.map((r,index)=>({rank:index+1,username:r.username,displayName:r.display_name,avatar:r.avatar_url,total:r.total,correct:r.correct,accuracy:Math.round(100*r.correct/r.total),confidence:Number(r.confidence)})),minimumResolved:MIN_RANKED_PREDICTIONS,method:'Wilson 95%'};
  });
  app.get('/api/predictions/:id',publicRate,async(req,reply)=>{
    if(!gate(reply))return;if(!uuid.safeParse(req.params.id).success)return reply.code(400).send({error:'INVALID_ID'});
    const row=await getOne(q,req.params.id);if(!row||row.status==='DRAFT')return reply.code(404).send({error:'NOT_FOUND'});return{item:publicPrediction(row)};
  });
  app.get('/api/predictions/:id/detail',publicRate,async(req,reply)=>{
    if(!gate(reply))return;if(!uuid.safeParse(req.params.id).success)return reply.code(400).send({error:'INVALID_ID'});
    const row=await getOne(q,req.params.id);if(!row||row.status==='DRAFT')return reply.code(404).send({error:'NOT_FOUND'});
    const id=req.params.id;
    const [aggregate,history,argumentsResult,related]=await Promise.all([
      q(`SELECT count(*)::int votes,COALESCE(sum(confidence_pct) FILTER(WHERE choice='YES'),0)::int yes_weight,COALESCE(sum(confidence_pct) FILTER(WHERE choice='NO'),0)::int no_weight,COALESCE(round(avg(confidence_pct)),0)::int conviction FROM prediction_votes WHERE question_id=$1 AND eligible`,[id]),
      q(`SELECT bucket_at,yes_count,no_count FROM (SELECT bucket_at,yes_count,no_count FROM prediction_snapshots WHERE question_id=$1 ORDER BY bucket_at DESC LIMIT 500) recent ORDER BY bucket_at ASC`,[id]),
      q(`SELECT a.id,a.body,a.created_at,a.updated_at,v.choice,u.username,u.display_name,u.avatar_url FROM prediction_arguments a JOIN prediction_votes v ON v.question_id=a.question_id AND v.user_id=a.user_id JOIN users u ON u.id=a.user_id WHERE a.question_id=$1 AND a.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' ORDER BY a.created_at DESC,a.id DESC LIMIT 80`,[id]),
      q(`SELECT ${fields} FROM prediction_questions p ${counts} ${snapshots} ${resolutions} WHERE p.id<>$1 AND p.status='OPEN' AND p.closes_at>clock_timestamp() AND p.media_type=$2 ORDER BY (p.media_id=$3) DESC,p.created_at DESC LIMIT 4`,[id,row.media_type,row.media_id]),
    ]);
    const a=aggregate.rows[0],weight=Number(a.yes_weight)+Number(a.no_weight);
    return{item:publicPrediction(row),collective:{votes:Number(a.votes),estimatedYesPercent:a.votes?Math.round(100*(Number(a.yes_weight)/100+1)/(weight/100+2)):null,weightedYesPercent:weight?Math.round(100*Number(a.yes_weight)/weight):null,conviction:a.votes?Number(a.conviction):null},history:history.rows.map(s=>({at:asIso(s.bucket_at),yesCount:s.yes_count,noCount:s.no_count})),arguments:argumentsResult.rows.map(c=>({id:c.id,text:c.body,choice:c.choice,createdAt:asIso(c.created_at),updatedAt:asIso(c.updated_at),author:{username:c.username,displayName:c.display_name,avatar:c.avatar_url}})),related:related.rows.map(r=>publicPrediction(r))};
  });
  app.put('/api/me/predictions/:id/follow',enabled?writeRate:publicRate,async(req,reply)=>{
    if(!gate(reply))return;const user=await requireUser(req,reply);if(!user)return;
    if(!uuid.safeParse(req.params.id).success||typeof req.body?.following!=='boolean')return reply.code(422).send({error:'INVALID_INPUT'});
    const id=req.params.id,question=await getOne(q,id);if(!question||question.status==='DRAFT')return reply.code(404).send({error:'NOT_FOUND'});
    if(req.body.following)await q('INSERT INTO prediction_follows(question_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,user.id]);
    else await q('DELETE FROM prediction_follows WHERE question_id=$1 AND user_id=$2',[id,user.id]);
    return{following:req.body.following};
  });
  app.get('/api/me/predictions/:id/detail',enabled?privateReadRate:publicRate,async(req,reply)=>{
    if(!gate(reply))return;const user=await requireUser(req,reply);if(!user)return;
    if(!uuid.safeParse(req.params.id).success)return reply.code(400).send({error:'INVALID_ID'});
    const id=req.params.id,{rows}=await q(`SELECT v.choice,v.confidence_pct,v.eligible,a.id argument_id,a.body argument_body,EXISTS(SELECT 1 FROM prediction_follows f WHERE f.question_id=$1 AND f.user_id=$2) following FROM (SELECT $1::uuid id) seed LEFT JOIN prediction_votes v ON v.question_id=seed.id AND v.user_id=$2 LEFT JOIN prediction_arguments a ON a.question_id=seed.id AND a.user_id=$2 AND a.hidden=false`,[id,user.id]);
    const r=rows[0];return{userVote:r?.choice?{choice:r.choice,confidence:Number(r.confidence_pct),eligible:r.eligible}:null,following:!!r?.following,argument:r?.argument_id?{id:r.argument_id,text:r.argument_body}:null};
  });
  app.put('/api/me/predictions/:id/argument',enabled?writeRate:publicRate,async(req,reply)=>{
    if(!gate(reply))return;const user=await requireUser(req,reply);if(!user)return;
    const parsed=z.object({text:z.string().trim().min(10).max(1500)}).strict().safeParse(req.body);
    if(!uuid.safeParse(req.params.id).success||!parsed.success)return reply.code(422).send({error:'INVALID_ARGUMENT'});
    const body=parsed.data.text;if((body.match(/https?:\/\/\S+/gi)||[]).length>2)return reply.code(422).send({error:'TOO_MANY_LINKS'});
    const {rows}=await q(`INSERT INTO prediction_arguments(question_id,user_id,body) SELECT $1,$2,$3 FROM prediction_votes v JOIN prediction_questions p ON p.id=v.question_id WHERE v.question_id=$1 AND v.user_id=$2 AND v.eligible AND p.status<>'DRAFT' ON CONFLICT(question_id,user_id) DO UPDATE SET body=EXCLUDED.body,hidden=false,updated_at=clock_timestamp() RETURNING id,body`,[req.params.id,user.id,body]);
    if(!rows[0])return reply.code(403).send({error:'VOTE_REQUIRED'});return{argument:{id:rows[0].id,text:rows[0].body}};
  });
  app.get('/api/me/predictions',enabled?privateReadRate:publicRate,async(req,reply)=>{
    if(!gate(reply))return;const user=await requireUser(req,reply);if(!user)return;
    const parsed=z.object({offset:z.coerce.number().int().min(0).max(3000).default(0),ids:z.string().max(1109).transform(v=>v.split(',')).pipe(z.array(uuid).min(1).max(30)).optional()}).strict().safeParse(req.query);if(!parsed.success||(parsed.data.ids&&parsed.data.offset))return reply.code(400).send({error:'INVALID_FILTER'});
    const {rows}=await q(`SELECT ${fields},v.choice user_choice,v.confidence_pct user_confidence,v.eligible user_eligible,v.updated_at vote_updated_at FROM prediction_votes v JOIN prediction_questions p ON p.id=v.question_id ${counts} ${snapshots} ${resolutions} WHERE v.user_id=$1 AND p.status<>'DRAFT' AND ($3::uuid[] IS NULL OR p.id=ANY($3::uuid[])) ORDER BY v.updated_at DESC,p.id LIMIT 31 OFFSET $2`,[user.id,parsed.data.offset,parsed.data.ids||null]);
    const stats=(await q(predictionStatsSql,[user.id])).rows[0];return{items:rows.slice(0,30).map(row=>publicPrediction(row)),nextOffset:rows.length>30?parsed.data.offset+30:null,stats:{...stats,accuracy:stats.resolved?Math.round(100*stats.correct/stats.resolved):null,rankEligible:stats.resolved>=MIN_RANKED_PREDICTIONS,confidence:wilsonLowerBound(stats.correct,stats.resolved)}};
  });
  app.put('/api/me/predictions/:id/vote',enabled?writeRate:publicRate,async(req,reply)=>{
    if(!gate(reply))return;const user=await requireUser(req,reply);if(!user)return;
    const body=z.object({choice,confidence:z.number().int().refine(value=>[10,25,50,75,100].includes(value)).default(50)}).strict().safeParse(req.body);if(!uuid.safeParse(req.params.id).success||!body.success)return reply.code(422).send({error:'INVALID_VOTE'});
    const result=await votePrediction(pool,req.params.id,user.id,body.data.choice,body.data.confidence);if(result.error)return reply.code(result.code).send({error:result.error});return result;
  });
}

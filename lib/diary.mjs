import {z} from 'zod';
import {createHash} from 'node:crypto';
import {validTimeZone,localDateKey} from './personal-home.mjs';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value});
const score=z.number().min(0).max(10).multipleOf(.1).nullable();
const reactions=z.array(z.enum(['Amei','Chorei','Surpreendeu','Divertido','Tenso','Inspirador'])).max(3).transform(values=>[...new Set(values)]);
export const diaryEntrySchema=z.object({
  clientKey:z.string().uuid(),mediaId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),mediaType:z.enum(['ANIME','MANGA']),
  date:day,timeZone:z.string().max(80).refine(value=>!!validTimeZone(value)),kind:z.enum(['EPISODE','CHAPTER','WORK']),
  startUnit:z.number().int().min(1).max(100000).nullable().default(null),endUnit:z.number().int().min(1).max(100000).nullable().default(null),
  score:score.default(null),favorite:z.boolean().default(false),rewatch:z.boolean().default(false),completed:z.boolean().default(false),
  reactions:reactions.default([]),note:z.string().trim().max(2000).default(''),spoiler:z.boolean().default(false),minutes:z.number().int().min(0).max(100000).nullable().default(null),
}).strict().superRefine((v,ctx)=>{
  if(v.kind==='WORK'&&(v.startUnit!==null||v.endUnit!==null))ctx.addIssue({code:'custom',message:'WORK_HAS_NO_UNIT'});
  if(v.kind!=='WORK'&&(!v.startUnit||!v.endUnit||v.endUnit<v.startUnit||v.endUnit-v.startUnit>=1000))ctx.addIssue({code:'custom',message:'INVALID_UNIT_RANGE'});
  if((v.mediaType==='ANIME'&&v.kind==='CHAPTER')||(v.mediaType==='MANGA'&&v.kind==='EPISODE'))ctx.addIssue({code:'custom',message:'INVALID_MEDIA_UNIT'});
});
const patchSchema=z.object({date:day.optional(),score:score.optional(),favorite:z.boolean().optional(),rewatch:z.boolean().optional(),completed:z.boolean().optional(),reactions:reactions.optional(),note:z.string().trim().max(2000).optional(),spoiler:z.boolean().optional()}).strict().refine(v=>Object.keys(v).length>0);
const safeSnapshot=media=>({title:String(media.title||'').slice(0,300),cover:/^https:\/\//i.test(media.cover||'')?String(media.cover).slice(0,2000):null,format:String(media.format||'').slice(0,30),genres:(Array.isArray(media.genres)?media.genres:[]).filter(v=>typeof v==='string').slice(0,20),duration:Number.isFinite(Number(media.duration))&&Number(media.duration)>0&&Number(media.duration)<=500?Math.round(Number(media.duration)):null});
const fields='id,media_id,media_type,media_snapshot,entry_date::text,kind,start_unit,end_unit,score,favorite,rewatch,completed,reactions,note,spoiler,minutes,time_source,created_at,updated_at';
export function diaryPeriod(query,now=new Date()) {
  const timeZone=validTimeZone(query?.timeZone||'America/Sao_Paulo');if(!timeZone)return null;
  const today=localDateKey(now,timeZone),start=String(query?.start||today.slice(0,7)+'-01'),end=String(query?.end||today);
  if(!day.safeParse(start).success||!day.safeParse(end).success||start<'1900-01-01'||end>today||start>end||(Date.parse(end)-Date.parse(start))/86400000>365)return null;
  return{start,end,timeZone};
}
export const diaryRecapSql=`WITH entries AS (SELECT * FROM personal_diary WHERE user_id=$1 AND entry_date BETWEEN $2::date AND $3::date)
 SELECT count(*)::int entries,count(DISTINCT media_id) FILTER(WHERE media_type='ANIME')::int anime_works,
 count(DISTINCT media_id) FILTER(WHERE media_type='MANGA')::int manga_works,
 COALESCE(sum(end_unit-start_unit+1) FILTER(WHERE kind='EPISODE'),0)::int episodes,
 COALESCE(sum(end_unit-start_unit+1) FILTER(WHERE kind='CHAPTER'),0)::int chapters,
 COALESCE(sum(minutes),0)::int minutes,COALESCE(sum(minutes) FILTER(WHERE time_source='ESTIMATED'),0)::int estimated_minutes,
 count(*) FILTER(WHERE minutes IS NULL)::int without_duration,round(avg(score),1) average_score,count(score)::int scored_entries,
 count(*) FILTER(WHERE rewatch)::int rewatches,count(*) FILTER(WHERE completed)::int completions,
 (SELECT COALESCE(jsonb_agg(g),'[]'::jsonb) FROM (SELECT genre,count(*)::int entries FROM entries e CROSS JOIN LATERAL jsonb_array_elements_text(e.media_snapshot->'genres') AS genres(genre) GROUP BY genre ORDER BY count(*) DESC,genre LIMIT 10) g) genres
 FROM entries`;

export function registerDiary(app,{q,requireUser,privateReadRate,writeRate,clock=()=>new Date()}) {
  app.get('/api/me/diary/titles',privateReadRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;
    const search=String(req.query?.search||'').trim().slice(0,80).replace(/[\\%_]/g,'\\$&');
    const {rows}=await q(`WITH titles AS (SELECT media_id,'ANIME'::text media_type,updated_at FROM user_anime WHERE user_id=$1 UNION ALL SELECT media_id,'MANGA'::text,updated_at FROM user_manga WHERE user_id=$1)
      SELECT t.media_id,t.media_type,mc.payload->>'title' title FROM titles t JOIN media_cache mc ON mc.media_id=t.media_id AND mc.media_type=t.media_type
      WHERE mc.payload->>'title' ILIKE $2 AND COALESCE(mc.payload->>'isAdult','false')<>'true' ORDER BY t.updated_at DESC,t.media_id LIMIT 30`,[user.id,`%${search}%`]);return{items:rows};
  });
  app.get('/api/me/diary',privateReadRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;const period=diaryPeriod(req.query,clock());if(!period)return reply.code(400).send({error:'INVALID_PERIOD'});
    let cursor=null;if(req.query?.cursor){try{const raw=JSON.parse(Buffer.from(String(req.query.cursor),'base64url').toString());cursor=z.object({date:day,id:z.string().uuid()}).strict().parse(raw)}catch{return reply.code(400).send({error:'INVALID_CURSOR'})}}
    const {rows}=await q(`SELECT ${fields} FROM personal_diary WHERE user_id=$1 AND entry_date BETWEEN $2::date AND $3::date
      AND ($4::date IS NULL OR (entry_date,id)<($4::date,$5::uuid)) ORDER BY entry_date DESC,id DESC LIMIT 31`,[user.id,period.start,period.end,cursor?.date||null,cursor?.id||null]);
    const items=rows.slice(0,30),last=items.at(-1);return{items,period,nextCursor:rows.length>30?Buffer.from(JSON.stringify({date:last.entry_date,id:last.id})).toString('base64url'):null};
  });
  app.get('/api/me/diary/recap',privateReadRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;const period=diaryPeriod(req.query,clock());if(!period)return reply.code(400).send({error:'INVALID_PERIOD'});
    const {rows}=await q(diaryRecapSql,[user.id,period.start,period.end]);return{period,stats:rows[0],scope:'Registros do diário no período. Atividade antiga da biblioteca não recebe datas presumidas.'};
  });
  app.post('/api/me/diary',writeRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;const parsed=diaryEntrySchema.safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_DIARY_ENTRY'});
    const v=parsed.data;if(v.date<'1900-01-01'||v.date>localDateKey(clock(),v.timeZone))return reply.code(422).send({error:'INVALID_DATE'});
    const hash=createHash('sha256').update(JSON.stringify(v)).digest('hex');
    // Recover a retry before consulting mutable metadata; snapshots never change on a retry.
    const existing=(await q(`SELECT ${fields},request_hash FROM personal_diary WHERE user_id=$1 AND client_key=$2`,[user.id,v.clientKey])).rows[0];
    if(existing){if(existing.request_hash!==hash)return reply.code(409).send({error:'IDEMPOTENCY_CONFLICT'});const {request_hash,...item}=existing;return{item};}
    const media=(await q('SELECT payload FROM media_cache WHERE media_type=$1 AND media_id=$2',[v.mediaType,v.mediaId])).rows[0]?.payload;
    if(!media?.title||media.isAdult===true)return reply.code(422).send({error:'MEDIA_METADATA_UNAVAILABLE'});
    const snapshot=safeSnapshot(media),count=v.kind==='WORK'?0:v.endUnit-v.startUnit+1;
    const estimate=v.mediaType==='ANIME'&&snapshot.duration&&count?snapshot.duration*count:null;
    const minutes=v.minutes??(estimate!==null&&estimate<=100000?estimate:null),timeSource=v.minutes!==null?'EXPLICIT':minutes!==null?'ESTIMATED':null;
    const {rows}=await q(`INSERT INTO personal_diary(user_id,client_key,request_hash,media_id,media_type,media_snapshot,entry_date,time_zone,kind,start_unit,end_unit,score,favorite,rewatch,completed,reactions,note,spoiler,minutes,time_source)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT(user_id,client_key) DO UPDATE SET client_key=EXCLUDED.client_key WHERE personal_diary.request_hash=EXCLUDED.request_hash RETURNING ${fields}`,
    [user.id,v.clientKey,hash,v.mediaId,v.mediaType,JSON.stringify(snapshot),v.date,v.timeZone,v.kind,v.startUnit,v.endUnit,v.score,v.favorite,v.rewatch,v.completed,v.reactions,v.note,v.spoiler,minutes,timeSource]);
    if(!rows[0])return reply.code(409).send({error:'IDEMPOTENCY_CONFLICT'});return reply.code(201).send({item:rows[0]});
  });
  app.patch('/api/me/diary/:id',writeRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;const id=z.string().uuid().safeParse(req.params.id),body=patchSchema.safeParse(req.body);if(!id.success||!body.success)return reply.code(422).send({error:'INVALID_DIARY_ENTRY'});
    const existing=(await q('SELECT time_zone FROM personal_diary WHERE user_id=$1 AND id=$2',[user.id,id.data])).rows[0];if(!existing)return reply.code(404).send({error:'NOT_FOUND'});
    if(body.data.date&&(body.data.date<'1900-01-01'||body.data.date>localDateKey(clock(),validTimeZone(existing.time_zone)||'America/Sao_Paulo')))return reply.code(422).send({error:'INVALID_DATE'});
    const columns={date:'entry_date',score:'score',favorite:'favorite',rewatch:'rewatch',completed:'completed',reactions:'reactions',note:'note',spoiler:'spoiler'},values=[user.id,id.data],assignments=[];
    for(const [key,value] of Object.entries(body.data)){values.push(value);assignments.push(`${columns[key]}=$${values.length}`);}
    const {rows}=await q(`UPDATE personal_diary SET ${assignments.join(',')},updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING ${fields}`,values);
    if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});return{item:rows[0]};
  });
  app.delete('/api/me/diary/:id',writeRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});
    const {rows}=await q('DELETE FROM personal_diary WHERE user_id=$1 AND id=$2 RETURNING id',[user.id,id.data]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});return{removed:true};
  });
}

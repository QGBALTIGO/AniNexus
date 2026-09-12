import crypto from 'node:crypto';
import { z } from 'zod';
import { fetchAniListEntries } from './profile-settings.mjs';
import { fetchMalEntries, mapMalEntries } from './mal-import.mjs';

const input=z.object({service:z.enum(['ANILIST','MAL']),username:z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),types:z.array(z.enum(['ANIME','MANGA'])).min(1).max(2).transform(values=>[...new Set(values)]),strategy:z.enum(['KEEP','OVERWRITE'])}).strict();
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
export const importListRows=async(client,userId,entries,strategy)=>{
  let changed=0;
  for(const mediaType of ['ANIME','MANGA']){
    const rows=entries.filter(entry=>entry.mediaType===mediaType);if(!rows.length)continue;
    const table=mediaType==='MANGA'?'user_manga':'user_anime',overwrite=strategy==='OVERWRITE';
    const conflict=overwrite?`DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,progress=EXCLUDED.progress,volume_progress=EXCLUDED.volume_progress,updated_at=EXCLUDED.updated_at`:'DO NOTHING';
    const payload=JSON.stringify(rows.map(entry=>({media_id:entry.mediaId,status:entry.status,score:entry.score,progress:entry.progress,volume_progress:entry.volumeProgress,updated_at:entry.updatedAt})));
    const result=await client.query(`INSERT INTO ${table}(user_id,media_id,status,score,progress,volume_progress,updated_at) SELECT $1,x.media_id,x.status,x.score,x.progress,x.volume_progress,to_timestamp(x.updated_at) FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,status text,score numeric,progress integer,volume_progress integer,updated_at bigint) ON CONFLICT(user_id,media_id) ${conflict}`,[userId,payload]);
    changed+=result.rowCount;
  }
  return changed;
};
export function registerListImportRoutes(app,{requireUser,q,transaction,rateForUser,resolveMal,importRows,persistMedia,summary,refreshAchievements,fetchAniList=fetchAniListEntries,fetchMal=fetchMalEntries}){
  app.post('/api/me/list-imports/preview',rateForUser(6,'10 minutes','list-import-preview'),async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;
    const parsed=input.safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_IMPORT'});
    const {service,username,types,strategy}=parsed.data;
    // Fastify's short default socket timeout must not interrupt a bounded public-list review.
    const socket=req.raw.socket,previousTimeout=socket?.timeout;
    socket?.setTimeout?.(120000);
    try{
      let entries,account,unmatched=[];const deadlineAt=Date.now()+90000;
      if(service==='MAL'){
        const result=await fetchMal({username,types});account=result.account;
        ({entries,unmatched}=await mapMalEntries(result.entries,resolveMal,{deadlineAt}));
      }else{
        entries=await fetchAniList({username,types});account={username,url:`https://anilist.co/user/${encodeURIComponent(username)}`};
      }
      const counts={anime:entries.filter(row=>row.mediaType==='ANIME').length,manga:entries.filter(row=>row.mediaType==='MANGA').length};
      const token=crypto.randomBytes(32).toString('hex'),expiresAt=new Date(Date.now()+10*60*1000).toISOString();
      const payload={service,account,types,strategy,entries,unmatched,counts};
      await q('DELETE FROM list_import_previews WHERE expires_at<now() AND user_id=$1',[user.id]);
      await q('INSERT INTO list_import_previews(token_hash,user_id,service,payload,expires_at) VALUES($1,$2,$3,$4::jsonb,$5)',[hash(token),user.id,service,JSON.stringify(payload),expiresAt]);
      return{token,expiresAt,service,account,types,strategy,counts,itemCount:entries.length,unmatchedCount:unmatched.length,unmatched:unmatched.slice(0,20),sample:entries.slice(0,8).map(row=>({title:row.title,mediaType:row.mediaType,status:row.status,progress:row.progress}))};
    }catch(error){
      const allowed=['ANILIST_USER_NOT_FOUND','ANILIST_UNAVAILABLE','MAL_USER_NOT_FOUND','MAL_LIST_UNAVAILABLE','MAL_UNAVAILABLE','MAL_INVALID_RESPONSE','IMPORT_TOO_LARGE'];
      const code=allowed.includes(error?.code)?error.code:'IMPORT_PREVIEW_FAILED';
      return reply.code(code.endsWith('USER_NOT_FOUND')?404:code==='IMPORT_TOO_LARGE'?422:502).send({error:code});
    }finally{if(socket&&!socket.destroyed&&Number.isFinite(previousTimeout))socket.setTimeout?.(previousTimeout)}
  });
  app.post('/api/me/list-imports/confirm',rateForUser(12,'10 minutes','list-import-confirm'),async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;
    const parsed=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(req.body);
    if(!parsed.success)return reply.code(422).send({error:'INVALID_IMPORT_CONFIRMATION'});
    try{
      const row=await transaction(async client=>{
        const preview=(await client.query('SELECT * FROM list_import_previews WHERE token_hash=$1 AND user_id=$2 FOR UPDATE',[hash(parsed.data.token),user.id])).rows[0];
        if(!preview)throw Object.assign(new Error(),{code:'IMPORT_PREVIEW_EXPIRED'});
        if(preview.transfer_id)return(await client.query('SELECT * FROM list_transfers WHERE id=$1 AND user_id=$2',[preview.transfer_id,user.id])).rows[0];
        if(new Date(preview.expires_at).getTime()<=Date.now())throw Object.assign(new Error(),{code:'IMPORT_PREVIEW_EXPIRED'});
        const data=preview.payload;
        if(!data.entries.length)throw Object.assign(new Error(),{code:'IMPORT_EMPTY'});
        const changed=await importRows(client,user.id,data.entries,data.strategy),skipped=data.entries.length-changed;
        await persistMedia((sql,params)=>client.query(sql,params),data.entries);
        const result=(await client.query(`INSERT INTO list_transfers(user_id,direction,service,media_type,source_username,strategy,status,item_count,skipped_count,details,completed_at) VALUES($1,'IMPORT',$2,$3,$4,$5,'COMPLETED',$6,$7,$8::jsonb,now()) RETURNING *`,[user.id,data.service,data.types.length===2?'ALL':data.types[0],data.account.username,data.strategy,changed,skipped,JSON.stringify({found:data.entries.length,...data.counts,unmatched:data.unmatched.length,confirmed:true})])).rows[0];
        await client.query("UPDATE list_import_previews SET transfer_id=$2,payload='{}'::jsonb WHERE token_hash=$1",[preview.token_hash,result.id]);
        return result;
      });
      // A post-commit achievement refresh must not turn a successful import into a retryable failure.
      await refreshAchievements(user.id,'RETROACTIVE').catch(()=>{});
      return{ok:true,transfer:summary(row)};
    }catch(error){const code=['IMPORT_PREVIEW_EXPIRED','IMPORT_EMPTY'].includes(error?.code)?error.code:'IMPORT_FAILED';return reply.code(code==='IMPORT_FAILED'?502:409).send({error:code})}
  });
}

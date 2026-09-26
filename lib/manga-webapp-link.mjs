import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
const hash = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('hex');
const key = z.string().regex(/^[a-f0-9]{64}$/);
export const mangaEvent = z.object({
  externalId:z.string().min(1).max(180).regex(/^[A-Za-z0-9:._-]+$/),
  title:z.string().min(1).max(300), cover:z.string().max(2000).optional(),
  anilistId:z.number().int().positive().max(100000000).nullable().optional(),
  favorite:z.boolean().optional(),
  status:z.enum(['CURRENT','PLANNING','COMPLETED','PAUSED','DROPPED']).optional(),
  progress:z.number().int().min(0).max(100000).optional(),
}).strict().refine(v=>v.favorite!==undefined||v.status!==undefined||v.progress!==undefined);

export function registerMangaWebappLink(app,{q,transaction,requireUser}) {
  const limited = max => ({config:{rateLimit:{max,timeWindow:'1 minute'}}});
  const privateReply = reply => reply.header('Cache-Control','no-store');
  async function linked(req,reply) {
    privateReply(reply);
    const token = String(req.headers.authorization||'').replace(/^Bearer /,'');
    if (!key.safeParse(token).success) {reply.code(401).send({error:'LINK_REQUIRED'});return null;}
    const row=(await q(`SELECT l.token_hash,l.user_id,u.display_name FROM manga_device_links l
      JOIN users u ON u.id=l.user_id WHERE l.token_hash=$1 AND l.expires_at>now()
      AND u.deleted_at IS NULL AND u.status='active'`,[hash(token)])).rows[0];
    if(!row) reply.code(401).send({error:'LINK_EXPIRED'});
    return row;
  }
  app.post('/api/manga-link/start',limited(6),async(req,reply)=>{
    privateReply(reply);
    const code=secret(),verifier=secret();
    await q('DELETE FROM manga_device_grants WHERE expires_at<now()');
    await q(`INSERT INTO manga_device_grants(code_hash,verifier_hash,expires_at) VALUES($1,$2,now()+interval '10 minutes')`,[hash(code),hash(verifier)]);
    return {code,verifier,expiresIn:600};
  });
  app.post('/api/manga-link/approve',limited(10),async(req,reply)=>{
    privateReply(reply);
    const user=await requireUser(req,reply);if(!user)return;
    const parsed=z.object({code:key}).strict().safeParse(req.body);
    if(!parsed.success)return reply.code(400).send({error:'INVALID_CODE'});
    const result=await q(`UPDATE manga_device_grants SET user_id=$2 WHERE code_hash=$1 AND user_id IS NULL AND expires_at>now() RETURNING code_hash`,[hash(parsed.data.code),user.id]);
    if(!result.rowCount)return reply.code(410).send({error:'CODE_EXPIRED_OR_USED'});
    return {ok:true};
  });
  app.post('/api/manga-link/poll',limited(60),async(req,reply)=>{
    privateReply(reply);
    const parsed=z.object({code:key,verifier:key}).strict().safeParse(req.body);
    if(!parsed.success)return reply.code(400).send({error:'INVALID_CODE'});
    return transaction(async client=>{
      const row=(await client.query('SELECT * FROM manga_device_grants WHERE code_hash=$1 AND verifier_hash=$2 AND expires_at>now() FOR UPDATE',[hash(parsed.data.code),hash(parsed.data.verifier)])).rows[0];
      if(!row)return reply.code(410).send({error:'CODE_EXPIRED_OR_USED'});
      if(!row.user_id)return {status:'pending'};
      // A retry after a lost HTTP response returns the same grant, never a second link.
      const token=hash(`access:${parsed.data.verifier}:${parsed.data.code}`);
      if(row.consumed){
        const active=(await client.query('SELECT token_hash FROM manga_device_links WHERE token_hash=$1 AND expires_at>now()',[hash(token)])).rows[0];
        if(!active)return reply.code(410).send({error:'LINK_REVOKED'});
      }else{
        await client.query(`INSERT INTO manga_device_links(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '90 days') ON CONFLICT DO NOTHING`,[hash(token),row.user_id]);
        await client.query('UPDATE manga_device_grants SET consumed=true WHERE code_hash=$1',[row.code_hash]);
      }
      return {status:'connected',token};
    });
  });
  app.get('/api/manga-link/connection',limited(120),async(req,reply)=>{
    const row=await linked(req,reply);if(!row)return;
    return {connected:true,name:row.display_name};
  });
  app.delete('/api/manga-link/connection',limited(10),async(req,reply)=>{
    const row=await linked(req,reply);if(!row)return;
    await q('DELETE FROM manga_device_links WHERE token_hash=$1',[row.token_hash]);
    return {ok:true};
  });
  app.post('/api/manga-link/sync',limited(180),async(req,reply)=>{
    const link=await linked(req,reply);if(!link)return;
    const parsed=mangaEvent.safeParse(req.body);
    if(!parsed.success)return reply.code(422).send({error:'INVALID_EVENT'});
    const d=parsed.data;
    return transaction(async client=>{
      // Serialize identity creation across devices; source IDs are never matched by name.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`manga-webapp:${d.externalId}`]);
      const existing=(await client.query("SELECT media_id FROM manga_catalog_links WHERE provider='mangaball' AND external_id=$1",[d.externalId])).rows[0];
      const mediaId=existing?Number(existing.media_id):(d.anilistId||Number((await client.query("SELECT nextval('manga_catalog_media_id_seq') AS id")).rows[0].id));
      await client.query(`INSERT INTO manga_catalog_links(provider,external_id,media_id,anilist_id) VALUES('mangaball',$1,$2,$3) ON CONFLICT DO NOTHING`,[d.externalId,mediaId,d.anilistId||null]);
      // Do not overwrite a richer AniList catalog record.
      const media={id:mediaId,mediaType:'MANGA',title:d.title,cover:/^https:\/\//.test(d.cover||'')?d.cover:null,format:'MANGA',externalIds:{mangaball:d.externalId}};
      await client.query(`INSERT INTO media_cache(media_type,media_id,slug,payload,updated_at) VALUES('MANGA',$1,$2,$3::jsonb,now()) ON CONFLICT(media_type,media_id) DO UPDATE SET payload=EXCLUDED.payload || media_cache.payload`,[mediaId,`manga-${mediaId}`,JSON.stringify(media)]);
      if(d.favorite===true)await client.query("INSERT INTO user_favorites(user_id,media_id,media_type) VALUES($1,$2,'MANGA') ON CONFLICT DO NOTHING",[link.user_id,mediaId]);
      if(d.favorite===false)await client.query("DELETE FROM user_favorites WHERE user_id=$1 AND media_id=$2 AND media_type='MANGA'",[link.user_id,mediaId]);
      if(d.status!==undefined||d.progress!==undefined)await client.query(`INSERT INTO user_manga(user_id,media_id,status,progress,updated_at) VALUES($1,$2,$3,COALESCE($4,0),now())
        ON CONFLICT(user_id,media_id) DO UPDATE SET
        status=CASE WHEN $5::boolean THEN EXCLUDED.status ELSE user_manga.status END,
        progress=GREATEST(user_manga.progress,COALESCE($4,user_manga.progress)),updated_at=now()`,[link.user_id,mediaId,d.status||'CURRENT',d.progress??null,d.status!==undefined]);
      await client.query('UPDATE manga_device_links SET last_sync_at=now() WHERE token_hash=$1',[link.token_hash]);
      return {ok:true,mediaId};
    });
  });
}

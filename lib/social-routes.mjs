import { z } from 'zod';
import {
  LIKEABLE_TYPES,
  REPORT_REASONS,
  hasSpoilerMarkup,
  normalizeSocialBody,
  socialBodyPayload,
} from './social.mjs';

const uuidSchema = z.string().uuid();
const stageSchema = z.enum(['PRELIMINARY', 'FINAL']);
const socialTextSchema = max => z.string().trim().min(1).max(max);
const likeSchema = z.object({
  likeableType: z.enum(LIKEABLE_TYPES),
  likeableId: z.string().trim().min(1).max(100),
}).strict();
const reportSchema = z.object({
  reportType: z.enum(['IMPRESSION', 'IMPRESSION_REPLY', 'ANIME_COMMENT', 'THREAD', 'POST', 'NEWS_COMMENT']),
  targetId: z.string().trim().min(1).max(100),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(700).optional(),
}).strict();

const hideSpoilersFrom = query => !['0', 'false', 'no'].includes(String(query?.hideSpoilers ?? 'true').toLowerCase());
const socialSort = value => String(value || '').toLowerCase() === 'popular' ? 'popular' : 'recent';
const mediaType = value => String(value || '').toUpperCase() === 'MANGA' ? 'MANGA' : 'ANIME';

function actorPayload(row) {
  return {
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || null,
  };
}

function contentPayload(row, hideSpoilers) {
  const parsed = socialBodyPayload(row, { hideSpoilers });
  return {
    ...row,
    has_spoilers: parsed.hasSpoilers,
    hasSpoilers: parsed.hasSpoilers,
    hideSpoilers: parsed.hideSpoilers,
    segments: parsed.segments,
    likesCount: Number(row.likes_count) || 0,
    repliesCount: Number(row.replies_count) || 0,
    user: actorPayload(row),
  };
}

function publicRows(rows, hideSpoilers) {
  return rows.map(row => contentPayload(row, hideSpoilers));
}

async function targetExists(query, likeableType, likeableId) {
  const uuid = uuidSchema.safeParse(likeableId);
  if (!uuid.success) return false;
  const targets = {
    IMPRESSION: ['impressions', "hidden=false"],
    IMPRESSION_REPLY: ['impression_replies', 'hidden=false'],
    ANIME_COMMENT: ['media_comments', "hidden=false AND status='visible'"],
    POST: ['community_posts', 'hidden=false'],
    NEWS_COMMENT: ['news_comments', 'hidden=false'],
  };
  const target = targets[likeableType];
  if (!target) return false;
  const { rows } = await query(`SELECT 1 FROM ${target[0]} WHERE id=$1 AND ${target[1]}`, [uuid.data]);
  return Boolean(rows[0]);
}

async function notifyReply(query, ownerQuery, ownerParams, actor, title, url) {
  try {
    const owner = (await query(ownerQuery, ownerParams)).rows[0]?.user_id;
    if (!owner || owner === actor.id) return;
    await query(`INSERT INTO notifications(user_id,kind,title,body,url) VALUES($1,'COMMUNITY',$2,$3,$4)`, [
      owner,
      title,
      `${actor.display_name || actor.username} respondeu à sua publicação.`,
      url,
    ]);
  } catch {
    // A resposta não deve falhar caso uma notificação secundária fique indisponível.
  }
}

export function registerSocialRoutes(app, dependencies) {
  const {
    q,
    currentUser,
    requireUser,
    rateForUser,
    publicRate,
    safeInt,
    withActorAvatars,
    hydrateCommunityMedia,
    mediaProjection,
    recordContributionAchievement,
    getNativeArticle,
  } = dependencies;

  const impressionSelect = `SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.has_spoilers,i.status_snapshot,i.progress_snapshot,i.score_snapshot,i.impression_stage,i.created_at,i.edited_at,
    u.username,u.display_name,u.avatar_url,
    (SELECT count(*)::int FROM likes l WHERE l.likeable_type='IMPRESSION' AND l.likeable_id=i.id::text) likes_count,
    (SELECT count(*)::int FROM impression_replies r WHERE r.impression_id=i.id AND r.hidden=false) replies_count`;

  async function listMediaImpressions(request, reply, type) {
    const id = safeInt(request.params.id);
    if (!id) return reply.code(400).send({ error: 'INVALID_ID' });
    const limit = Math.max(1, Math.min(100, Number(request.query?.limit || 50)));
    const sort = socialSort(request.query?.sort);
    const hideSpoilers = hideSpoilersFrom(request.query);
    const order = sort === 'popular' ? 'likes_count DESC,i.created_at DESC' : 'i.created_at DESC';
    const { rows } = await q(`${impressionSelect}
      FROM impressions i JOIN users u ON u.id=i.user_id
      WHERE i.media_id=$1 AND i.media_type=$2 AND i.hidden=false
        AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'
      ORDER BY ${order} LIMIT $3`, [id, type, limit]);
    return { items: publicRows(withActorAvatars(rows), hideSpoilers), sort, hideSpoilers };
  }

  async function createImpression(request, reply, type) {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = safeInt(request.params.id);
    if (!id) return reply.code(400).send({ error: 'INVALID_ID' });
    const parsed = z.object({
      text: socialTextSchema(2000).optional(),
      body: socialTextSchema(2000).optional(),
      impressionStage: stageSchema.optional(),
      spoiler: z.boolean().optional(),
    }).refine(value => Boolean(value.text || value.body), { message: 'BODY_REQUIRED' }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const body = normalizeSocialBody(parsed.data.text || parsed.data.body, 2000);
    if (!body) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const table = type === 'MANGA' ? 'user_manga' : 'user_anime';
    const state = (await q(`SELECT status,progress,score FROM ${table} WHERE user_id=$1 AND media_id=$2`, [user.id, id])).rows[0] || null;
    const stage = parsed.data.impressionStage || (state?.status === 'COMPLETED' ? 'FINAL' : 'PRELIMINARY');
    const wholeBodySpoiler = Boolean(parsed.data.spoiler) && !hasSpoilerMarkup(body);
    const hasSpoilers = Boolean(parsed.data.spoiler) || hasSpoilerMarkup(body);
    const { rows } = await q(`INSERT INTO impressions(
        user_id,media_id,media_type,body,spoiler,has_spoilers,status_snapshot,progress_snapshot,score_snapshot,impression_stage
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id,created_at,status_snapshot,progress_snapshot,score_snapshot,impression_stage,has_spoilers`, [
      user.id, id, type, body, wholeBodySpoiler, hasSpoilers, state?.status || null,
      state?.progress ?? null, state?.score ?? null, stage,
    ]);
    await recordContributionAchievement(user.id, 'IMPRESSION', rows[0], body);
    return reply.code(201).send({ ok: true, ...rows[0], segments: socialBodyPayload({ body, spoiler: wholeBodySpoiler }).segments });
  }

  app.get('/api/anime/:id/impressions', publicRate, (request, reply) => listMediaImpressions(request, reply, 'ANIME'));
  app.post('/api/anime/:id/impressions', rateForUser(8, '1 minute', 'impressions-write'), (request, reply) => createImpression(request, reply, 'ANIME'));
  app.get('/api/manga/:id/impressions', publicRate, (request, reply) => listMediaImpressions(request, reply, 'MANGA'));
  app.post('/api/manga/:id/impressions', rateForUser(8, '1 minute', 'manga-impressions-write'), (request, reply) => createImpression(request, reply, 'MANGA'));

  app.patch('/api/impressions/:id', rateForUser(12, '5 minutes', 'impressions-edit'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = uuidSchema.safeParse(request.params.id);
    const parsed = z.object({ text: socialTextSchema(2000) }).strict().safeParse(request.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const body = normalizeSocialBody(parsed.data.text, 2000);
    const { rows } = await q(`UPDATE impressions
      SET body=$3,spoiler=false,has_spoilers=$4,updated_at=now(),edited_at=now()
      WHERE id=$1 AND user_id=$2 AND hidden=false
      RETURNING id,body,has_spoilers,edited_at,status_snapshot,progress_snapshot,score_snapshot,impression_stage`,
    [id.data, user.id, body, hasSpoilerMarkup(body)]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, ...rows[0], segments: socialBodyPayload(rows[0]).segments };
  });

  app.delete('/api/impressions/:id', rateForUser(12, '5 minutes', 'impressions-delete'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = uuidSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const { rows } = await q('UPDATE impressions SET hidden=true,updated_at=now() WHERE id=$1 AND user_id=$2 AND hidden=false RETURNING id', [id.data, user.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, id: rows[0].id };
  });

  app.get('/api/impressions/:id/replies', publicRate, async (request, reply) => {
    const id = uuidSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const hideSpoilers = hideSpoilersFrom(request.query);
    const { rows } = await q(`SELECT r.id,r.parent_id,r.root_id,r.depth,r.body,r.has_spoilers,r.created_at,r.edited_at,
      u.username,u.display_name,u.avatar_url,
      (SELECT count(*)::int FROM likes l WHERE l.likeable_type='IMPRESSION_REPLY' AND l.likeable_id=r.id::text) likes_count,
      0::int replies_count
      FROM impression_replies r
      JOIN impressions i ON i.id=r.impression_id AND i.hidden=false
      JOIN users u ON u.id=r.user_id
      WHERE r.impression_id=$1 AND r.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'
      ORDER BY COALESCE((SELECT root_reply.created_at FROM impression_replies root_reply WHERE root_reply.id=COALESCE(r.root_id,r.id)),r.created_at) DESC,
        CASE WHEN r.depth=0 THEN 0 ELSE 1 END,r.created_at`, [id.data]);
    return { items: publicRows(withActorAvatars(rows), hideSpoilers), hideSpoilers };
  });

  app.post('/api/impressions/:id/replies', rateForUser(10, '5 minutes', 'impression-replies-write'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const impressionId = uuidSchema.safeParse(request.params.id);
    const parsed = z.object({ text: socialTextSchema(3000), parentId: z.string().uuid().nullable().optional() }).strict().safeParse(request.body);
    if (!impressionId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const impression = (await q('SELECT id,media_id,media_type,user_id FROM impressions WHERE id=$1 AND hidden=false', [impressionId.data])).rows[0];
    if (!impression) return reply.code(404).send({ error: 'NOT_FOUND' });
    const body = normalizeSocialBody(parsed.data.text, 3000);
    const parentId = parsed.data.parentId || null;
    const { rows } = await q(`WITH new_id AS (SELECT gen_random_uuid() id), parent AS (
        SELECT id,root_id,depth FROM impression_replies WHERE id=$3::uuid AND impression_id=$1 AND hidden=false
      ) INSERT INTO impression_replies(id,impression_id,user_id,parent_id,root_id,depth,body,has_spoilers)
      SELECT new_id.id,$1,$2,$3::uuid,
        CASE WHEN $3::uuid IS NULL THEN new_id.id ELSE COALESCE(parent.root_id,parent.id) END,
        CASE WHEN $3::uuid IS NULL THEN 0 ELSE parent.depth+1 END,$4,$5
      FROM new_id LEFT JOIN parent ON true
      WHERE $3::uuid IS NULL OR parent.id IS NOT NULL
      RETURNING id,parent_id,root_id,depth,created_at`, [impressionId.data, user.id, parentId, body, hasSpoilerMarkup(body)]);
    if (!rows[0]) return reply.code(422).send({ error: 'INVALID_PARENT' });
    await recordContributionAchievement(user.id, 'POST', rows[0], body);
    const detailKind = impression.media_type === 'MANGA' ? 'manga' : 'anime';
    await notifyReply(q, 'SELECT user_id FROM impressions WHERE id=$1', [impressionId.data], user, 'Nova resposta à sua impressão', `/${detailKind}/${detailKind}-${impression.media_id}`);
    return reply.code(201).send({ ok: true, ...rows[0] });
  });

  app.patch('/api/impressions/:id/replies/:replyId', rateForUser(12, '5 minutes', 'impression-replies-edit'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const impressionId = uuidSchema.safeParse(request.params.id), replyId = uuidSchema.safeParse(request.params.replyId);
    const parsed = z.object({ text: socialTextSchema(3000) }).strict().safeParse(request.body);
    if (!impressionId.success || !replyId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const body = normalizeSocialBody(parsed.data.text, 3000);
    const { rows } = await q(`UPDATE impression_replies
      SET body=$4,has_spoilers=$5,updated_at=now(),edited_at=now()
      WHERE id=$1 AND impression_id=$2 AND user_id=$3 AND hidden=false
      RETURNING id,body,has_spoilers,edited_at`, [replyId.data, impressionId.data, user.id, body, hasSpoilerMarkup(body)]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, ...rows[0], segments: socialBodyPayload(rows[0]).segments };
  });

  app.delete('/api/impressions/:id/replies/:replyId', rateForUser(12, '5 minutes', 'impression-replies-delete'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const impressionId = uuidSchema.safeParse(request.params.id), replyId = uuidSchema.safeParse(request.params.replyId);
    if (!impressionId.success || !replyId.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const { rows } = await q(`UPDATE impression_replies SET hidden=true,updated_at=now()
      WHERE id=$1 AND impression_id=$2 AND user_id=$3 AND hidden=false RETURNING id`, [replyId.data, impressionId.data, user.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, id: rows[0].id };
  });

  app.get('/api/news/:slug/comments', publicRate, async (request, reply) => {
    const slug = String(request.params.slug || '').trim().slice(0, 180);
    if (!slug) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const limit = Math.max(1, Math.min(200, Number(request.query?.limit || 120)));
    const sort = socialSort(request.query?.sort), hideSpoilers = hideSpoilersFrom(request.query);
    const rootId = 'COALESCE(c.root_id,c.id)';
    const rootLikes = `(SELECT count(*)::int FROM likes ranked_like WHERE ranked_like.likeable_type='NEWS_COMMENT' AND ranked_like.likeable_id=${rootId}::text)`;
    const order = sort === 'popular'
      ? `${rootLikes} DESC,root.created_at DESC,CASE WHEN c.depth=0 THEN 0 ELSE 1 END,c.created_at`
      : `root.created_at DESC,CASE WHEN c.depth=0 THEN 0 ELSE 1 END,c.created_at`;
    const { rows } = await q(`SELECT c.id,c.parent_id,c.root_id,c.depth,c.body,c.spoiler,c.has_spoilers,c.created_at,c.edited_at,
      u.username,u.display_name,u.avatar_url,
      (SELECT count(*)::int FROM likes l WHERE l.likeable_type='NEWS_COMMENT' AND l.likeable_id=c.id::text) likes_count,
      (SELECT count(*)::int FROM news_comments child WHERE COALESCE(child.root_id,child.id)=${rootId} AND child.id<>c.id AND child.hidden=false) replies_count
      FROM news_comments c
      JOIN news_comments root ON root.id=${rootId} AND root.article_slug=c.article_slug AND root.hidden=false
      JOIN users u ON u.id=c.user_id
      WHERE c.article_slug=$1 AND c.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'
      ORDER BY ${order} LIMIT $2`, [slug, limit]);
    return { items: publicRows(withActorAvatars(rows), hideSpoilers), sort, hideSpoilers };
  });

  app.post('/api/news/:slug/comments', rateForUser(10, '5 minutes', 'news-comments-write'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const slug = String(request.params.slug || '').trim().slice(0, 180);
    const parsed = z.object({
      text: socialTextSchema(1800).optional(),
      body: socialTextSchema(1800).optional(),
      spoiler: z.boolean().optional(),
      parentId: z.string().uuid().nullable().optional(),
    }).strict().refine(value => Boolean(value.text || value.body), { message: 'TEXT_REQUIRED' }).safeParse(request.body);
    if (!slug || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    if (typeof getNativeArticle === 'function' && !await getNativeArticle(slug)) return reply.code(404).send({ error: 'NOT_FOUND' });
    const body = normalizeSocialBody(parsed.data.text || parsed.data.body, 1800), parentId = parsed.data.parentId || null;
    if (!body) return reply.code(400).send({ error: 'INVALID_INPUT' });
    if ((body.match(/https?:\/\/\S+/gi) || []).length > 2) return reply.code(422).send({ error: 'TOO_MANY_LINKS' });
    const legacyWholeBody = Boolean(parsed.data.spoiler) && !hasSpoilerMarkup(body), hasSpoilers = legacyWholeBody || hasSpoilerMarkup(body);
    const { rows } = await q(`WITH new_id AS (SELECT gen_random_uuid() id), parent AS (
        SELECT id,root_id,depth FROM news_comments WHERE id=$5::uuid AND article_slug=$1 AND hidden=false
      ) INSERT INTO news_comments(id,article_slug,user_id,parent_id,root_id,depth,body,spoiler,has_spoilers)
      SELECT new_id.id,$1,$2,$5::uuid,
        CASE WHEN $5::uuid IS NULL THEN new_id.id ELSE COALESCE(parent.root_id,parent.id) END,
        CASE WHEN $5::uuid IS NULL THEN 0 ELSE parent.depth+1 END,$3,$4,$6
      FROM new_id LEFT JOIN parent ON true
      WHERE $5::uuid IS NULL OR parent.id IS NOT NULL
      RETURNING id,parent_id,root_id,depth,created_at`, [slug, user.id, body, legacyWholeBody, parentId, hasSpoilers]);
    if (!rows[0]) return reply.code(422).send({ error: 'INVALID_PARENT' });
    await recordContributionAchievement(user.id, 'NEWS_COMMENT', rows[0], body);
    if (parentId) await notifyReply(q, 'SELECT user_id FROM news_comments WHERE id=$1', [parentId], user, 'Nova resposta em uma notícia', `/noticias/${encodeURIComponent(slug)}`);
    return reply.code(201).send({ ok: true, ...rows[0] });
  });

  app.patch('/api/news/:slug/comments/:commentId', rateForUser(12, '5 minutes', 'news-comments-edit'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const slug = String(request.params.slug || '').trim().slice(0, 180), commentId = uuidSchema.safeParse(request.params.commentId);
    const parsed = z.object({ text: socialTextSchema(1800) }).strict().safeParse(request.body);
    if (!slug || !commentId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const body = normalizeSocialBody(parsed.data.text, 1800);
    const { rows } = await q(`UPDATE news_comments SET body=$4,spoiler=false,has_spoilers=$5,updated_at=now(),edited_at=now()
      WHERE id=$1 AND article_slug=$2 AND user_id=$3 AND hidden=false
      RETURNING id,body,has_spoilers,edited_at`, [commentId.data, slug, user.id, body, hasSpoilerMarkup(body)]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, ...rows[0], segments: socialBodyPayload(rows[0]).segments };
  });

  app.delete('/api/news/:slug/comments/:commentId', rateForUser(12, '5 minutes', 'news-comments-delete'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const slug = String(request.params.slug || '').trim().slice(0, 180), commentId = uuidSchema.safeParse(request.params.commentId);
    if (!slug || !commentId.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const { rows } = await q(`UPDATE news_comments SET hidden=true,updated_at=now()
      WHERE id=$1 AND article_slug=$2 AND user_id=$3 AND hidden=false RETURNING id`, [commentId.data, slug, user.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, id: rows[0].id };
  });

  app.get('/api/anime/:id/episodes/:episode/comments', publicRate, async (request, reply) => {
    const id = safeInt(request.params.id), episode = safeInt(request.params.episode, 1, 100000);
    if (!id || !episode) return reply.code(400).send({ error: 'INVALID_EPISODE' });
    const limit = Math.max(1, Math.min(300, Number(request.query?.limit || 120)));
    const sort = socialSort(request.query?.sort), hideSpoilers = hideSpoilersFrom(request.query);
    const rootId = 'COALESCE(c.root_id,c.id)';
    const rootCreated = `COALESCE((SELECT root_comment.created_at FROM media_comments root_comment WHERE root_comment.id=${rootId}),c.created_at)`;
    const rootLikes = `(SELECT count(*)::int FROM likes ranked_like WHERE ranked_like.likeable_type='ANIME_COMMENT' AND ranked_like.likeable_id=${rootId}::text)`;
    const order = sort === 'popular'
      ? `${rootLikes} DESC,${rootCreated} DESC,CASE WHEN c.depth=0 THEN 0 ELSE 1 END,c.created_at`
      : `${rootCreated} DESC,CASE WHEN c.depth=0 THEN 0 ELSE 1 END,c.created_at`;
    const { rows } = await q(`SELECT c.id,c.parent_id,c.root_id,c.depth,c.body,c.has_spoilers,c.created_at,c.edited_at,
      u.username,u.display_name,u.avatar_url,
      (SELECT count(*)::int FROM likes l WHERE l.likeable_type='ANIME_COMMENT' AND l.likeable_id=c.id::text) likes_count,
      (SELECT count(*)::int FROM media_comments child WHERE child.parent_id=c.id AND child.hidden=false AND child.status='visible') replies_count
      FROM media_comments c JOIN users u ON u.id=c.user_id
      WHERE c.media_type='ANIME' AND c.media_id=$1 AND c.subject_number=$2
        AND c.hidden=false AND c.status='visible' AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'
      ORDER BY ${order} LIMIT $3`, [id, episode, limit]);
    return { animeId: id, episode, items: publicRows(withActorAvatars(rows), hideSpoilers), sort, hideSpoilers };
  });

  app.post('/api/anime/:id/episodes/:episode/comments', rateForUser(10, '5 minutes', 'episode-comments-write'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = safeInt(request.params.id), episode = safeInt(request.params.episode, 1, 100000);
    const parsed = z.object({ text: socialTextSchema(3000), parentId: z.string().uuid().nullable().optional() }).strict().safeParse(request.body);
    if (!id || !episode || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const body = normalizeSocialBody(parsed.data.text, 3000), parentId = parsed.data.parentId || null;
    const { rows } = await q(`WITH new_id AS (SELECT gen_random_uuid() id), parent AS (
        SELECT id,root_id,depth FROM media_comments
        WHERE id=$5::uuid AND media_type='ANIME' AND media_id=$1 AND subject_number=$2 AND hidden=false AND status='visible'
      ) INSERT INTO media_comments(id,media_id,media_type,subject_number,user_id,parent_id,root_id,depth,body,has_spoilers)
      SELECT new_id.id,$1,'ANIME',$2,$3,$5::uuid,
        CASE WHEN $5::uuid IS NULL THEN new_id.id ELSE COALESCE(parent.root_id,parent.id) END,
        CASE WHEN $5::uuid IS NULL THEN 0 ELSE parent.depth+1 END,$4,$6
      FROM new_id LEFT JOIN parent ON true
      WHERE $5::uuid IS NULL OR parent.id IS NOT NULL
      RETURNING id,parent_id,root_id,depth,created_at`, [id, episode, user.id, body, parentId, hasSpoilerMarkup(body)]);
    if (!rows[0]) return reply.code(422).send({ error: 'INVALID_PARENT' });
    await recordContributionAchievement(user.id, 'POST', rows[0], body);
    if (parentId) await notifyReply(q, 'SELECT user_id FROM media_comments WHERE id=$1', [parentId], user, `Nova resposta no episódio ${episode}`, `/anime/anime-${id}`);
    return reply.code(201).send({ ok: true, ...rows[0] });
  });

  app.patch('/api/anime/:id/episodes/:episode/comments/:commentId', rateForUser(12, '5 minutes', 'episode-comments-edit'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = safeInt(request.params.id), episode = safeInt(request.params.episode, 1, 100000);
    const commentId = uuidSchema.safeParse(request.params.commentId);
    const parsed = z.object({ text: socialTextSchema(3000) }).strict().safeParse(request.body);
    if (!id || !episode || !commentId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const body = normalizeSocialBody(parsed.data.text, 3000);
    const { rows } = await q(`UPDATE media_comments
      SET body=$5,has_spoilers=$6,updated_at=now(),edited_at=now()
      WHERE id=$1 AND media_type='ANIME' AND media_id=$2 AND subject_number=$3 AND user_id=$4
        AND hidden=false AND status='visible'
      RETURNING id,body,has_spoilers,edited_at`, [commentId.data, id, episode, user.id, body, hasSpoilerMarkup(body)]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, ...rows[0], segments: socialBodyPayload(rows[0]).segments };
  });

  app.delete('/api/anime/:id/episodes/:episode/comments/:commentId', rateForUser(12, '5 minutes', 'episode-comments-delete'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = safeInt(request.params.id), episode = safeInt(request.params.episode, 1, 100000);
    const commentId = uuidSchema.safeParse(request.params.commentId);
    if (!id || !episode || !commentId.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const { rows } = await q(`UPDATE media_comments SET hidden=true,status='removed',updated_at=now()
      WHERE id=$1 AND media_type='ANIME' AND media_id=$2 AND subject_number=$3 AND user_id=$4
        AND hidden=false AND status='visible' RETURNING id`, [commentId.data, id, episode, user.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true, id: rows[0].id };
  });

  app.get('/api/anime/:id/episodes/:episode/comments/spoiler-check', publicRate, async (request, reply) => {
    const id = safeInt(request.params.id), episode = safeInt(request.params.episode, 1, 100000);
    if (!id || !episode) return reply.code(400).send({ error: 'INVALID_EPISODE' });
    const user = await currentUser(request).catch(() => null);
    if (!user) return { allowed: true, userProgress: null, episodesAhead: null, status: null };
    const progress = (await q('SELECT status,progress FROM user_anime WHERE user_id=$1 AND media_id=$2', [user.id, id])).rows[0] || null;
    if (!progress) return { allowed: true, userProgress: null, episodesAhead: null, status: null };
    const userProgress = Math.max(0, Number(progress.progress) || 0);
    const unrestricted = ['COMPLETED', 'PAUSED', 'DROPPED'].includes(progress.status);
    const episodesAhead = Math.max(0, episode - userProgress);
    return { allowed: unrestricted || episodesAhead === 0, userProgress, episodesAhead, status: progress.status };
  });

  app.get('/api/me/likes', rateForUser(120, '1 minute', 'social-likes-read'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const targets = String(request.query?.targets || '').split(',').slice(0, 100).map(value => {
      const separator = value.indexOf(':');
      return separator > 0 ? { type: value.slice(0, separator), id: value.slice(separator + 1) } : null;
    }).filter(target => target && LIKEABLE_TYPES.includes(target.type) && uuidSchema.safeParse(target.id).success);
    if (!targets.length) return { items: [] };
    const pairs = targets.map(target => `${target.type}:${target.id}`);
    const { rows } = await q(`SELECT likeable_type || ':' || likeable_id AS target FROM likes
      WHERE user_id=$1 AND (likeable_type || ':' || likeable_id)=ANY($2::text[])`, [user.id, pairs]);
    return { items: rows.map(row => row.target) };
  });

  app.post('/api/likes', rateForUser(40, '1 minute', 'social-likes-write'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const parsed = likeSchema.safeParse(request.body);
    if (!parsed.success || !await targetExists(q, parsed.data.likeableType, parsed.data.likeableId)) return reply.code(404).send({ error: 'NOT_FOUND' });
    await q('INSERT INTO likes(user_id,likeable_type,likeable_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [user.id, parsed.data.likeableType, parsed.data.likeableId]);
    const count = (await q('SELECT count(*)::int count FROM likes WHERE likeable_type=$1 AND likeable_id=$2', [parsed.data.likeableType, parsed.data.likeableId])).rows[0]?.count;
    return reply.code(201).send({ liked: true, likesCount: Number(count) || 0 });
  });

  app.delete('/api/likes', rateForUser(40, '1 minute', 'social-likes-delete'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const parsed = likeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    await q('DELETE FROM likes WHERE user_id=$1 AND likeable_type=$2 AND likeable_id=$3', [user.id, parsed.data.likeableType, parsed.data.likeableId]);
    const count = (await q('SELECT count(*)::int count FROM likes WHERE likeable_type=$1 AND likeable_id=$2', [parsed.data.likeableType, parsed.data.likeableId])).rows[0]?.count;
    return { liked: false, likesCount: Number(count) || 0 };
  });

  app.post('/api/reports', rateForUser(8, '10 minutes', 'social-reports-write'), async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: 'INVALID_INPUT' });
    const likeType = parsed.data.reportType === 'THREAD' ? null : parsed.data.reportType;
    let exists = false;
    if (likeType && LIKEABLE_TYPES.includes(likeType)) exists = await targetExists(q, likeType, parsed.data.targetId);
    if (parsed.data.reportType === 'THREAD') {
      const uuid = uuidSchema.safeParse(parsed.data.targetId);
      exists = uuid.success && Boolean((await q('SELECT 1 FROM community_threads WHERE id=$1 AND hidden=false', [uuid.data])).rows[0]);
    }
    if (!exists) return reply.code(404).send({ error: 'NOT_FOUND' });
    const reason = `${parsed.data.reason}${parsed.data.details ? `: ${parsed.data.details}` : ''}`.slice(0, 1000);
    await q('INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,$2,$3,$4)', [user.id, parsed.data.reportType, parsed.data.targetId, reason]);
    return reply.code(201).send({ ok: true });
  });

  async function impressionFeed(request) {
    const limit = Math.max(1, Math.min(50, Number(request.query?.limit || 20)));
    const filter = ['anime', 'manga'].includes(String(request.query?.filter || '').toLowerCase()) ? String(request.query.filter).toUpperCase() : null;
    const sort = socialSort(request.query?.sort), hideSpoilers = hideSpoilersFrom(request.query);
    const cursorDate = request.query?.cursor && Number.isFinite(Date.parse(String(request.query.cursor))) ? new Date(String(request.query.cursor)).toISOString() : null;
    const order = sort === 'popular' ? 'likes_count DESC,i.created_at DESC' : 'i.created_at DESC';
    const { rows } = await q(`${impressionSelect},${mediaProjection} AS media
      FROM impressions i JOIN users u ON u.id=i.user_id
      LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type=i.media_type
      WHERE i.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'
        AND ($1::text IS NULL OR i.media_type=$1) AND ($2::timestamptz IS NULL OR i.created_at<$2)
      ORDER BY ${order} LIMIT $3`, [filter, cursorDate, limit + 1]);
    const hasMore = rows.length > limit, selected = rows.slice(0, limit);
    const hydrated = await hydrateCommunityMedia(selected);
    const items = publicRows(hydrated, hideSpoilers).map(row => ({
      ...row,
      mediaId: Number(row.media_id), mediaType: row.media_type,
      mediaTitle: row.media?.title || null, mediaCoverUrl: row.media?.cover || null,
      statusSnapshot: row.status_snapshot, progressSnapshot: row.progress_snapshot == null ? null : Number(row.progress_snapshot),
      scoreSnapshot: row.score_snapshot == null ? null : Number(row.score_snapshot), impressionStage: row.impression_stage,
      status: row.status_snapshot, progress: row.progress_snapshot == null ? null : Number(row.progress_snapshot),
      score: row.score_snapshot == null ? null : Number(row.score_snapshot),
      createdAt: row.created_at,
    }));
    return { items, hasMore, nextCursor: hasMore ? items.at(-1)?.created_at || null : null, filter: filter?.toLowerCase() || 'all', sort, hideSpoilers };
  }

  app.get('/api/feed/impressions', publicRate, impressionFeed);
  app.get('/api/community/impressions', publicRate, impressionFeed);

  app.get('/api/feed/community', publicRate, async request => {
    const limit = Math.max(1, Math.min(50, Number(request.query?.limit || 20)));
    const category = String(request.query?.category || '').trim().toUpperCase().slice(0, 40) || null;
    const sort = String(request.query?.sort || '').toLowerCase() === 'hot' ? 'hot' : 'recent';
    const cursorDate = request.query?.cursor && Number.isFinite(Date.parse(String(request.query.cursor))) ? new Date(String(request.query.cursor)).toISOString() : null;
    const { rows } = await q(`SELECT t.id,t.category,t.media_id,t.media_type,t.title,t.created_at,
      u.username,u.display_name,u.avatar_url,
      count(p.id)::int replies_count,
      max(p.created_at) last_reply_at,
      (array_agg(pu.username ORDER BY p.created_at DESC) FILTER (WHERE p.id IS NOT NULL))[1] last_reply_username
      FROM community_threads t LEFT JOIN users u ON u.id=t.user_id
      LEFT JOIN community_posts p ON p.thread_id=t.id AND p.hidden=false
      LEFT JOIN users pu ON pu.id=p.user_id AND pu.deleted_at IS NULL AND pu.status='active' AND pu.privacy='public'
      WHERE t.hidden=false AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'))
        AND ($1::text IS NULL OR t.category=$1)
      GROUP BY t.id,u.id
      HAVING ($2::timestamptz IS NULL OR COALESCE(max(p.created_at),t.created_at)<$2)
      ORDER BY ${sort === 'hot' ? 'count(p.id) DESC,' : ''}COALESCE(max(p.created_at),t.created_at) DESC LIMIT $3`, [category, cursorDate, limit + 1]);
    const hasMore = rows.length > limit, selected = rows.slice(0, limit);
    return {
      items: selected.map(row => ({
        id: row.id, category: row.category, title: row.title,
        authorUser: actorPayload(row), repliesCount: Number(row.replies_count) || 0,
        lastReplyUser: row.last_reply_username || null,
        lastReplyAt: row.last_reply_at || row.created_at,
      })),
      hasMore,
      nextCursor: hasMore ? selected.at(-1)?.last_reply_at || selected.at(-1)?.created_at || null : null,
      sort,
    };
  });
}

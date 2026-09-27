// This read model never contacts a catalog provider. Missing metadata stays missing.
const positive = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const safeImage = value => /^https:\/\//i.test(String(value || '')) ? String(value).slice(0, 2000) : null;
export function validTimeZone(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  try { return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone; } catch { return null; }
}
export function localDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = type => parts.find(p => p.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function exactDate(value) {
  const y = positive(value?.year), m = positive(value?.month), d = positive(value?.day);
  if (!y || y < 1900 || y > 2200 || !m || m > 12 || !d || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
}
export function personalHome(rows, { now = new Date(), timeZone = 'America/Sao_Paulo', truncated = false } = {}) {
  timeZone = validTimeZone(timeZone) || 'America/Sao_Paulo';
  const today = localDateKey(now, timeZone), seconds = now.getTime() / 1000;
  const upcoming = [], continueItems = [], backlog = [], premieres = [], seen = new Set();
  let missing = 0, stale = 0;
  for (const row of rows) {
    const id = positive(row.media_id), type = row.media_type === 'MANGA' ? 'MANGA' : 'ANIME', key = `${type}:${id}`;
    if (!id || seen.has(key)) continue;
    seen.add(key);
    const m = row.media;
    if (!m || typeof m.title !== 'string' || !m.title.trim()) { missing++; continue; }
    const progress = Math.max(0, Math.floor(Number(row.progress) || 0));
    const total = positive(type === 'MANGA' ? m.chapters : m.episodes);
    const item = { id, mediaType: type, title: m.title.slice(0, 300), cover: safeImage(m.cover), progress, total, status: row.status || null,
      href: `/${type === 'MANGA' ? 'manga' : 'anime'}/${id}`, updatedAt: row.updated_at || null };
    const cacheAge = now.getTime() - Date.parse(row.cached_at || '');
    const freshSchedule = Number.isFinite(cacheAge) && cacheAge >= -60000 && cacheAge <= 48 * 3600000;
    if (!freshSchedule) stale++;
    if (row.status === 'CURRENT' && (m.status !== 'FINISHED' || !total || progress < total)) {
      continueItems.push({ ...item, next: total && progress >= total ? null : progress + 1 });
    }
    // Only finished titles have a reliable total released count. Never infer delivery from a timetable.
    if (type === 'ANIME' && row.status === 'CURRENT' && m.status === 'FINISHED' && total && total > progress) {
      backlog.push({ ...item, remaining: total - progress });
    }
    const air = Number(m.nextAiringEpisode?.airingAt), episode = positive(m.nextAiringEpisode?.episode);
    if (type === 'ANIME' && freshSchedule && episode && Number.isFinite(air) && air > 0 && air <= seconds + 8 * 86400) {
      const day = localDateKey(new Date(air * 1000), timeZone);
      const daysAhead = (Date.parse(day) - Date.parse(today)) / 86400000;
      if (daysAhead >= 0 && daysAhead < 7 && (row.status === 'PLANNING' || row.status === 'CURRENT' || row.followed)) {
        upcoming.push({ ...item, airingAt: air, episode, day, isToday: day === today, alreadyScheduled: air <= seconds });
      }
    }
    const premiere = exactDate(m.startDate);
    if (m.status === 'NOT_YET_RELEASED' && premiere && premiere >= today) premieres.push({ ...item, date: premiere });
  }
  continueItems.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  upcoming.sort((a, b) => a.airingAt - b.airingAt || a.id - b.id);
  premieres.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return { generatedAt: now.toISOString(), timeZone, today,
    continue: continueItems.slice(0, 12), todayItems: upcoming.filter(i => i.isToday).slice(0, 20),
    week: upcoming.slice(0, 40), backlog: backlog.slice(0, 8), premieres: premieres.slice(0, 12),
    coverage: { tracked: seen.size, missingMetadata: missing, staleMetadata: stale, truncated,
      schedule: 'Horários previstos pela fonte; disponibilidade e região devem ser confirmadas na plataforma.' } };
}

// User-leading PKs/indexes scope each branch; the composite cache PK keeps anime/manga isolated.
export const personalHomeSql = `WITH tracked AS (
  (SELECT media_id,'ANIME'::text media_type,status,progress,updated_at FROM user_anime WHERE user_id=$1 AND status IN ('CURRENT','PLANNING','PAUSED') ORDER BY updated_at DESC LIMIT 1001)
  UNION ALL
  (SELECT media_id,'MANGA'::text,status,progress,updated_at FROM user_manga WHERE user_id=$1 AND status IN ('CURRENT','PLANNING','PAUSED') ORDER BY updated_at DESC LIMIT 1001)
), entries AS (
  SELECT t.*,EXISTS(SELECT 1 FROM user_follows f WHERE f.user_id=$1 AND f.media_id=t.media_id AND f.media_type=t.media_type) followed FROM tracked t
  UNION ALL
  (SELECT f.media_id,f.media_type,NULL::text,0,f.created_at,true FROM user_follows f WHERE f.user_id=$1
    AND NOT EXISTS(SELECT 1 FROM tracked t WHERE t.media_id=f.media_id AND t.media_type=f.media_type) ORDER BY f.created_at DESC LIMIT 1001)
)
SELECT e.*,mc.updated_at cached_at,CASE WHEN mc.media_id IS NULL THEN NULL ELSE jsonb_build_object(
 'title',mc.payload->>'title','cover',mc.payload->>'cover','episodes',mc.payload->'episodes','chapters',mc.payload->'chapters',
 'status',mc.payload->>'status','startDate',mc.payload->'startDate','nextAiringEpisode',mc.payload->'nextAiringEpisode') END media
FROM entries e LEFT JOIN media_cache mc ON mc.media_id=e.media_id AND mc.media_type=e.media_type
ORDER BY e.updated_at DESC,e.media_type,e.media_id LIMIT 1001`;

export function registerPersonalHome(app, { q, requireUser, privateReadRate, clock = () => new Date() }) {
  app.get('/api/me/home', privateReadRate, async (req, reply) => {
    const user = await requireUser(req, reply); if (!user) return;
    const timeZone = validTimeZone(req.query?.timeZone || 'America/Sao_Paulo');
    if (!timeZone) return reply.code(400).send({ error: 'INVALID_TIME_ZONE' });
    reply.header('Cache-Control', 'private, no-store');
    const { rows } = await q(personalHomeSql, [user.id]);
    return personalHome(rows.slice(0, 1000), { now: clock(), timeZone, truncated: rows.length > 1000 });
  });
}

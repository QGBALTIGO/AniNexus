import crypto from 'node:crypto';
import { pool, q } from './db.mjs';
import { resolvedAvatar } from './avatar.mjs';

export const TIER_XP = Object.freeze({ BRONZE: 20, SILVER: 50, GOLD: 100, PLATINUM: 200, DIAMOND: 400 });
export const TIER_LABELS = Object.freeze({ BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro', PLATINUM: 'Platina', DIAMOND: 'Diamante' });

const make = (id, category, metric, target, tier, title, description, rewardTitle = null) => Object.freeze({
  id, category, metric, target, tier, xp: TIER_XP[tier], title, description, rewardTitle,
});

export const ACHIEVEMENTS = Object.freeze([
  make('profile-new-face', 'PROFILE', 'profileAvatar', 1, 'BRONZE', 'Cara Nova', 'Troque o avatar padrão.'),
  make('profile-nexus-identity', 'PROFILE', 'profileIdentity', 1, 'SILVER', 'Identidade do Nexus', 'Preencha nome, avatar, banner e biografia.'),

  make('library-first-step', 'LIBRARY', 'library', 1, 'BRONZE', 'Primeiro Passo', 'Adicione seu primeiro anime.'),
  make('library-starter-collector', 'LIBRARY', 'library', 5, 'SILVER', 'Colecionador Iniciante', 'Adicione 5 animes diferentes.'),
  make('library-growing-collection', 'LIBRARY', 'library', 25, 'GOLD', 'Coleção em Expansão', 'Adicione 25 animes diferentes.'),
  make('library-otaku-library', 'LIBRARY', 'library', 50, 'PLATINUM', 'Biblioteca Otaku', 'Adicione 50 animes diferentes.'),
  make('library-nexus-archive', 'LIBRARY', 'library', 100, 'DIAMOND', 'Arquivo do Nexus', 'Adicione 100 animes diferentes.'),

  make('completed-until-credits', 'COMPLETED', 'completed', 1, 'BRONZE', 'Até os Créditos', 'Conclua seu primeiro anime com progresso registrado.'),
  make('completed-season-finale', 'COMPLETED', 'completed', 10, 'SILVER', 'Fim de Temporada', 'Conclua 10 animes.'),
  make('completed-experienced-marathoner', 'COMPLETED', 'completed', 25, 'GOLD', 'Maratonista Experiente', 'Conclua 25 animes.'),
  make('completed-anime-legend', 'COMPLETED', 'completed', 50, 'PLATINUM', 'Lenda dos Animes', 'Conclua 50 animes.'),
  make('completed-living-encyclopedia', 'COMPLETED', 'completed', 100, 'DIAMOND', 'Enciclopédia Viva', 'Conclua 100 animes.', 'Enciclopédia Viva'),

  make('episodes-first-play', 'EPISODES', 'episodes', 1, 'BRONZE', 'Primeiro Play', 'Assista ao primeiro episódio.'),
  make('episodes-fifty', 'EPISODES', 'episodes', 50, 'SILVER', 'Cinquenta Episódios', 'Assista a 50 episódios diferentes.'),
  make('episodes-between-arcs', 'EPISODES', 'episodes', 250, 'GOLD', 'Entre Arcos', 'Assista a 250 episódios diferentes.'),
  make('episodes-thousand-later', 'EPISODES', 'episodes', 1000, 'PLATINUM', 'Mil Episódios Depois', 'Assista a 1.000 episódios diferentes.'),
  make('episodes-tireless-player', 'EPISODES', 'episodes', 2500, 'DIAMOND', 'Player Incansável', 'Assista a 2.500 episódios diferentes.'),

  make('ratings-first-score', 'RATINGS', 'ratings', 1, 'BRONZE', 'Primeira Nota', 'Avalie sua primeira obra.'),
  make('ratings-notebook', 'RATINGS', 'ratings', 10, 'SILVER', 'Caderno de Notas', 'Avalie 10 obras diferentes.'),
  make('ratings-critical-eye', 'RATINGS', 'ratings', 25, 'GOLD', 'Olhar Crítico', 'Avalie 25 obras diferentes.'),
  make('ratings-specialist', 'RATINGS', 'ratings', 50, 'PLATINUM', 'Especialista em Notas', 'Avalie 50 obras diferentes.'),
  make('ratings-exam-board', 'RATINGS', 'ratings', 100, 'DIAMOND', 'Banca Examinadora', 'Avalie 100 obras diferentes.', 'Crítico do Nexus'),

  make('community-first-impression', 'COMMUNITY', 'contributions', 1, 'BRONZE', 'Primeira Impressão', 'Faça sua primeira contribuição válida.'),
  make('community-episode-talk', 'COMMUNITY', 'contributions', 10, 'SILVER', 'Papo de Episódio', 'Faça 10 contribuições válidas.'),
  make('community-social-critic', 'COMMUNITY', 'contributions', 25, 'GOLD', 'Crítico Social', 'Faça 25 contribuições válidas.'),
  make('community-voice', 'COMMUNITY', 'contributions', 50, 'PLATINUM', 'Voz da Comunidade', 'Faça 50 contribuições válidas.'),
  make('community-legend', 'COMMUNITY', 'contributions', 100, 'DIAMOND', 'Lenda da Comunidade', 'Faça 100 contribuições válidas.', 'Voz do Nexus'),

  make('genres-starter-explorer', 'GENRES', 'genres', 3, 'BRONZE', 'Explorador Iniciante', 'Consuma animes de 3 gêneros diferentes.'),
  make('genres-outside-bubble', 'GENRES', 'genres', 5, 'SILVER', 'Fora da Bolha', 'Consuma animes de 5 gêneros diferentes.'),
  make('genres-cartographer', 'GENRES', 'genres', 8, 'GOLD', 'Cartógrafo de Gêneros', 'Consuma animes de 8 gêneros diferentes.'),
  make('genres-universal-explorer', 'GENRES', 'genres', 12, 'PLATINUM', 'Explorador Universal', 'Consuma animes de 12 gêneros diferentes.'),
  make('genres-master', 'GENRES', 'genres', 16, 'DIAMOND', 'Mestre dos Gêneros', 'Consuma animes de 16 gêneros diferentes.'),

  make('streak-three-days', 'STREAK', 'streak', 3, 'BRONZE', 'Três Dias', 'Tenha atividade por 3 dias consecutivos.'),
  make('streak-week', 'STREAK', 'streak', 7, 'SILVER', 'Semana em Dia', 'Tenha atividade por 7 dias consecutivos.'),
  make('streak-fortnight', 'STREAK', 'streak', 14, 'GOLD', 'Quinzena Otaku', 'Tenha atividade por 14 dias consecutivos.'),
  make('streak-training-arc', 'STREAK', 'streak', 30, 'PLATINUM', 'Arco de Treinamento', 'Tenha atividade por 30 dias consecutivos.'),
  make('streak-protagonist-discipline', 'STREAK', 'streak', 100, 'DIAMOND', 'Disciplina de Protagonista', 'Tenha atividade por 100 dias consecutivos.'),

  make('organization-planner', 'ORGANIZATION', 'planning', 10, 'BRONZE', 'Planejador', 'Tenha 10 animes planejados.'),
  make('organization-multitasker', 'ORGANIZATION', 'current', 3, 'BRONZE', 'Multitarefa', 'Tenha 3 animes sendo acompanhados.'),
  make('organization-in-order', 'ORGANIZATION', 'statusVariety', 5, 'SILVER', 'Biblioteca em Ordem', 'Tenha pelo menos uma obra em cada status.'),
]);

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map(item => [item.id, item]));
export const CATEGORY_LABELS = Object.freeze({
  PROFILE: 'Perfil', LIBRARY: 'Biblioteca', COMPLETED: 'Concluídos', EPISODES: 'Episódios',
  RATINGS: 'Avaliações', COMMUNITY: 'Comunidade', GENRES: 'Gêneros', STREAK: 'Sequência', ORGANIZATION: 'Organização',
});

const dayNumber = value => {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000) : null;
};
const dayString = day => new Date(day * 86400000).toISOString().slice(0, 10);

export function longestProtectedStreak(values = []) {
  const days = [...new Set(values.map(dayNumber).filter(Number.isInteger))].sort((a, b) => a - b);
  if (!days.length) return 0;
  let longest = 1;
  for (let start = 0; start < days.length; start += 1) {
    const graceMonths = new Set();
    for (let end = start + 1; end < days.length; end += 1) {
      const gap = days[end] - days[end - 1];
      if (gap === 1) {
        longest = Math.max(longest, days[end] - days[start] + 1);
        continue;
      }
      if (gap === 2) {
        const missedMonth = dayString(days[end - 1] + 1).slice(0, 7);
        if (graceMonths.has(missedMonth)) break;
        graceMonths.add(missedMonth);
        longest = Math.max(longest, days[end] - days[start] + 1);
        continue;
      }
      break;
    }
  }
  return longest;
}

export function levelFromXp(rawXp = 0) {
  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.floor(Math.sqrt(xp / 30)) + 1;
  const levelFloor = 30 * ((level - 1) ** 2);
  const nextXp = 30 * (level ** 2);
  return { level, name: `Nível Nexus ${level}`, xp, levelFloor, nextXp };
}

export function validTimeZone(value) {
  const timezone = String(value || '').trim();
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(timezone)) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); return timezone; } catch { return null; }
}

function dateInTimeZone(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timezone) || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function ensureProfile(client, userId) {
  await client.query('INSERT INTO achievement_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING', [userId]);
  return (await client.query('SELECT * FROM achievement_profiles WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
}

async function seedHistory(client, userId, timezone) {
  await client.query(`
    INSERT INTO achievement_anime_history(
      user_id,media_id,ever_added,ever_completed,ever_rated,trusted_import,max_progress,first_seen_at,last_activity_at
    )
    SELECT ua.user_id,ua.media_id,true,
      ua.status='COMPLETED' AND (ua.progress>0 OR (li.imported_at IS NOT NULL AND ua.updated_at<=li.imported_at)),
      ua.score IS NOT NULL,
      li.imported_at IS NOT NULL AND ua.updated_at<=li.imported_at,
      ua.progress,ua.updated_at,ua.updated_at
    FROM user_anime ua
    LEFT JOIN local_imports li ON li.user_id=ua.user_id
    WHERE ua.user_id=$1
    ON CONFLICT(user_id,media_id) DO UPDATE SET
      ever_added=true,
      ever_completed=achievement_anime_history.ever_completed OR EXCLUDED.ever_completed,
      ever_rated=achievement_anime_history.ever_rated OR EXCLUDED.ever_rated,
      trusted_import=achievement_anime_history.trusted_import OR EXCLUDED.trusted_import,
      max_progress=GREATEST(achievement_anime_history.max_progress,EXCLUDED.max_progress),
      first_seen_at=LEAST(achievement_anime_history.first_seen_at,EXCLUDED.first_seen_at),
      last_activity_at=GREATEST(achievement_anime_history.last_activity_at,EXCLUDED.last_activity_at)
  `, [userId]);

  await client.query(`
    INSERT INTO achievement_activity_days(user_id,activity_date,source)
    SELECT DISTINCT ua.user_id,(ua.updated_at AT TIME ZONE $2)::date,
      CASE WHEN ua.score IS NOT NULL THEN 'RATING' ELSE 'PROGRESS' END
    FROM user_anime ua
    LEFT JOIN local_imports li ON li.user_id=ua.user_id
    WHERE ua.user_id=$1 AND (ua.progress>0 OR ua.score IS NOT NULL)
      AND (li.imported_at IS NULL OR ua.updated_at>li.imported_at)
    ON CONFLICT(user_id,activity_date) DO NOTHING
  `, [userId, timezone]);

  await client.query(`
    INSERT INTO achievement_contribution_history(
      user_id,contribution_type,contribution_id,counted,contributed_at
    )
    SELECT $1,entry.contribution_type,entry.id,true,entry.created_at
    FROM (
      SELECT id,'IMPRESSION'::text contribution_type,created_at,body FROM impressions WHERE user_id=$1 AND hidden=false
      UNION ALL SELECT id,'THREAD',created_at,body FROM community_threads WHERE user_id=$1 AND hidden=false
      UNION ALL SELECT id,'POST',created_at,body FROM community_posts WHERE user_id=$1 AND hidden=false
      UNION ALL SELECT id,'NEWS_COMMENT',created_at,body FROM news_comments WHERE user_id=$1 AND hidden=false
    ) entry
    WHERE char_length(btrim(entry.body))>=20
    ON CONFLICT(contribution_type,contribution_id) DO NOTHING
  `, [userId]);

  await client.query(`
    INSERT INTO achievement_activity_days(user_id,activity_date,source)
    SELECT DISTINCT user_id,(contributed_at AT TIME ZONE $2)::date,'CONTRIBUTION'
    FROM achievement_contribution_history
    WHERE user_id=$1 AND counted=true
    ON CONFLICT(user_id,activity_date) DO NOTHING
  `, [userId, timezone]);
}

async function metricsFor(client, userId) {
  const profile = (await client.query(`
    SELECT display_name,avatar_url,avatar_source,profile_banner_url,bio
    FROM users WHERE id=$1
  `, [userId])).rows[0] || {};

  const history = (await client.query(`
    WITH watched AS (
      SELECT media_id,count(*)::int watched_count FROM watched_episodes WHERE user_id=$1 GROUP BY media_id
    ), history AS (
      SELECT * FROM achievement_anime_history WHERE user_id=$1
    )
    SELECT count(*) FILTER(WHERE h.ever_added)::int library,
      count(*) FILTER(WHERE h.ever_completed)::int completed,
      count(*) FILTER(WHERE h.ever_rated)::int ratings,
      COALESCE(sum(GREATEST(COALESCE(h.max_progress,0),COALESCE(w.watched_count,0))),0)::bigint episodes
    FROM history h FULL OUTER JOIN watched w ON w.media_id=h.media_id
  `, [userId])).rows[0] || {};

  const state = (await client.query(`
    SELECT count(*) FILTER(WHERE status='PLANNING')::int planning,
      count(*) FILTER(WHERE status='CURRENT')::int current,
      count(DISTINCT status)::int status_variety
    FROM user_anime WHERE user_id=$1
  `, [userId])).rows[0] || {};

  const genres = (await client.query(`
    WITH watched AS (
      SELECT media_id,count(*)::int watched_count FROM watched_episodes WHERE user_id=$1 GROUP BY media_id
    ), history AS (
      SELECT * FROM achievement_anime_history WHERE user_id=$1
    ), consumed AS (
      SELECT COALESCE(h.media_id,w.media_id) media_id,h.ever_completed,
        GREATEST(COALESCE(h.max_progress,0),COALESCE(w.watched_count,0)) episode_count
      FROM history h FULL OUTER JOIN watched w ON w.media_id=h.media_id
    )
    SELECT count(DISTINCT lower(genre.value))::int count
    FROM consumed c
    JOIN media_cache mc ON mc.media_type='ANIME' AND mc.media_id=c.media_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(mc.payload->'genres')='array' THEN mc.payload->'genres' ELSE '[]'::jsonb END
    ) genre(value)
    WHERE c.ever_completed OR c.episode_count>=3
  `, [userId])).rows[0]?.count || 0;

  const contributions = (await client.query(
    'SELECT count(*)::int count FROM achievement_contribution_history WHERE user_id=$1 AND counted=true', [userId],
  )).rows[0]?.count || 0;

  const activityDays = (await client.query(
    'SELECT activity_date::text value FROM achievement_activity_days WHERE user_id=$1 ORDER BY activity_date', [userId],
  )).rows.map(row => row.value);

  const customAvatar = profile.avatar_source === 'custom'
    || (profile.avatar_source === 'clerk' && /^https:\/\//i.test(String(profile.avatar_url || '')));
  return {
    profileAvatar: customAvatar ? 1 : 0,
    profileIdentity: customAvatar && String(profile.display_name || '').trim() && String(profile.profile_banner_url || '').trim() && String(profile.bio || '').trim() ? 1 : 0,
    library: Number(history.library || 0), completed: Number(history.completed || 0), episodes: Number(history.episodes || 0),
    ratings: Number(history.ratings || 0), contributions: Number(contributions), genres: Number(genres),
    streak: longestProtectedStreak(activityDays), planning: Number(state.planning || 0), current: Number(state.current || 0),
    statusVariety: Number(state.status_variety || 0),
  };
}

const unlockedDescription = description => String(description || '').replace(
  /^(Troque|Preencha|Adicione|Conclua|Assista|Avalie|Faça|Consuma|Tenha)\b/,
  verb => ({ Troque: 'Trocou', Preencha: 'Preencheu', Adicione: 'Adicionou', Conclua: 'Concluiu', Assista: 'Assistiu', Avalie: 'Avaliou', Faça: 'Fez', Consuma: 'Consumiu', Tenha: 'Manteve' })[verb],
);

function publicDefinition(item) {
  return {
    id: item.id, category: item.category, categoryLabel: CATEGORY_LABELS[item.category], title: item.title,
    description: item.description, unlockedDescription: unlockedDescription(item.description),
    tier: item.tier, tierLabel: TIER_LABELS[item.tier], xp: item.xp,
    target: item.target, rewardTitle: item.rewardTitle,
  };
}

export function achievementCatalog() {
  return ACHIEVEMENTS.map(publicDefinition);
}

function payloadFrom(definitions, metrics, unlockRows, pinRows, profileRow) {
  const unlocks = new Map(unlockRows.map(row => [row.achievement_id, row]));
  const pins = new Map(pinRows.map(row => [row.achievement_id, Number(row.slot)]));
  const items = definitions.map(definition => {
    const unlock = unlocks.get(definition.id), value = Math.max(0, Number(metrics[definition.metric] || 0));
    return {
      ...publicDefinition(definition), progress: Math.min(value, definition.target), progressValue: value,
      unlocked: Boolean(unlock), unlockedAt: unlock?.unlocked_at || null, pinnedSlot: pins.get(definition.id) || null,
    };
  });
  const xp = unlockRows.reduce((total, row) => total + Number(row.xp || 0), 0), level = levelFromXp(xp);
  const availableTitles = items.filter(item => item.unlocked && item.rewardTitle).map(item => item.rewardTitle);
  const equippedTitle = availableTitles.includes(profileRow.equipped_title) ? profileRow.equipped_title : null;
  return {
    total: items.length, unlockedCount: unlockRows.length, percentage: Math.round((unlockRows.length / items.length) * 100),
    xp, level, metrics, items, pins: pinRows.sort((a, b) => Number(a.slot) - Number(b.slot)).map(row => row.achievement_id),
    availableTitles, equippedTitle, preferences: { shareFeed: profileRow.share_feed !== false, timezone: profileRow.timezone },
  };
}

export async function syncUserAchievements(userId, { source = 'ACTION', notify = true } = {}) {
  const normalizedSource = source === 'RETROACTIVE' ? 'RETROACTIVE' : 'ACTION';
  return withTransaction(async client => {
    const achievementProfile = await ensureProfile(client, userId);
    const firstEvaluation = !achievementProfile.first_evaluated_at;
    await seedHistory(client, userId, achievementProfile.timezone);
    const metrics = await metricsFor(client, userId);
    const existingRows = (await client.query(
      'SELECT achievement_id,tier,xp,source,batch_id,unlocked_at FROM achievement_unlocks WHERE user_id=$1', [userId],
    )).rows;
    const existing = new Set(existingRows.map(row => row.achievement_id));
    const unlocked = ACHIEVEMENTS.filter(item => !existing.has(item.id) && Number(metrics[item.metric] || 0) >= item.target);
    const batchId = crypto.randomUUID();
    if (unlocked.length) {
      const records = unlocked.map(item => ({ achievement_id: item.id, tier: item.tier, xp: item.xp }));
      await client.query(`
        INSERT INTO achievement_unlocks(user_id,achievement_id,tier,xp,source,batch_id)
        SELECT $1,x.achievement_id,x.tier,x.xp,$3,$4
        FROM jsonb_to_recordset($2::jsonb) AS x(achievement_id text,tier text,xp integer)
        ON CONFLICT(user_id,achievement_id) DO NOTHING
      `, [userId, JSON.stringify(records), normalizedSource, batchId]);
      if (notify) {
        const title = unlocked.length === 1 ? 'Conquista desbloqueada' : `${unlocked.length} conquistas desbloqueadas`;
        const body = normalizedSource === 'RETROACTIVE'
          ? `Você desbloqueou ${unlocked.length} ${unlocked.length === 1 ? 'conquista' : 'conquistas'} com base no seu histórico.`
          : unlocked.length === 1 ? unlocked[0].title : `Sua jornada liberou ${unlocked.length} novas conquistas.`;
        await client.query(`INSERT INTO notifications(user_id,kind,title,body,url) VALUES($1,'SYSTEM',$2,$3,'/conquistas')`, [userId, title, body]);
      }
    }
    await client.query(`
      UPDATE achievement_profiles SET first_evaluated_at=COALESCE(first_evaluated_at,now()),last_evaluated_at=now(),updated_at=now()
      WHERE user_id=$1
    `, [userId]);
    const [unlockResult, pinResult, profileResult] = await Promise.all([
      client.query('SELECT achievement_id,tier,xp,source,batch_id,unlocked_at FROM achievement_unlocks WHERE user_id=$1 ORDER BY unlocked_at', [userId]),
      client.query('SELECT slot,achievement_id FROM achievement_pins WHERE user_id=$1 ORDER BY slot', [userId]),
      client.query('SELECT * FROM achievement_profiles WHERE user_id=$1', [userId]),
    ]);
    return {
      ...payloadFrom(ACHIEVEMENTS, metrics, unlockResult.rows, pinResult.rows, profileResult.rows[0]),
      firstEvaluation, newUnlocks: unlocked.map(publicDefinition), batchId: unlocked.length ? batchId : null,
    };
  });
}

export async function recordMeaningfulActivity(userId, source = 'PROGRESS', at = new Date()) {
  const normalizedSource = ['PROGRESS', 'RATING', 'EPISODE', 'CONTRIBUTION'].includes(source) ? source : 'PROGRESS';
  const { rows } = await q(`
    INSERT INTO achievement_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET updated_at=achievement_profiles.updated_at
    RETURNING timezone
  `, [userId]);
  const activityDate = dateInTimeZone(at, rows[0]?.timezone || 'America/Sao_Paulo');
  await q(`
    INSERT INTO achievement_activity_days(user_id,activity_date,source) VALUES($1,$2,$3)
    ON CONFLICT(user_id,activity_date) DO NOTHING
  `, [userId, activityDate, normalizedSource]);
}

const CONTRIBUTION_TYPES = new Set(['IMPRESSION', 'THREAD', 'POST', 'NEWS_COMMENT']);

export async function recordContributionHistory(userId, contributionType, contributionId, body, at = new Date()) {
  const type = String(contributionType || '').toUpperCase();
  const id = String(contributionId || '');
  if (!CONTRIBUTION_TYPES.has(type) || !/^[0-9a-f-]{36}$/i.test(id) || String(body || '').trim().length < 20) return false;
  await q(`
    INSERT INTO achievement_contribution_history(user_id,contribution_type,contribution_id,counted,contributed_at)
    VALUES($1,$2,$3,true,$4) ON CONFLICT(contribution_type,contribution_id) DO NOTHING
  `, [userId, type, id, at]);
  await recordMeaningfulActivity(userId, 'CONTRIBUTION', at);
  return true;
}

export async function setContributionHistoryValidity(userId, contributionType, contributionId, counted) {
  const type = String(contributionType || '').toUpperCase();
  const id = String(contributionId || '');
  if (!CONTRIBUTION_TYPES.has(type) || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const result = await q(`
    UPDATE achievement_contribution_history SET counted=$4,moderated_at=now()
    WHERE user_id=$1 AND contribution_type=$2 AND contribution_id=$3
  `, [userId, type, id, Boolean(counted)]);
  return result.rowCount > 0;
}

export async function recordAnimeHistory(userId, mediaId, entry, previous = null, { trustedImport = false } = {}) {
  const progress = Math.max(0, Number(entry.progress || 0));
  const rated = entry.score !== null && entry.score !== undefined;
  const completed = entry.status === 'COMPLETED' && (progress > 0 || trustedImport);
  await q(`
    INSERT INTO achievement_anime_history(user_id,media_id,ever_added,ever_completed,ever_rated,trusted_import,max_progress)
    VALUES($1,$2,true,$3,$4,$5,$6)
    ON CONFLICT(user_id,media_id) DO UPDATE SET
      ever_added=true,
      ever_completed=achievement_anime_history.ever_completed OR EXCLUDED.ever_completed,
      ever_rated=achievement_anime_history.ever_rated OR EXCLUDED.ever_rated,
      trusted_import=achievement_anime_history.trusted_import OR EXCLUDED.trusted_import,
      max_progress=GREATEST(achievement_anime_history.max_progress,EXCLUDED.max_progress),
      last_activity_at=now()
  `, [userId, mediaId, completed, rated, trustedImport, progress]);
  if (trustedImport) return;
  const previousProgress = Math.max(0, Number(previous?.progress || 0));
  const scoreChanged = rated && Number(entry.score) !== Number(previous?.score);
  const progressChanged = progress !== previousProgress || (completed && previous?.status !== 'COMPLETED');
  if (progressChanged || scoreChanged) await recordMeaningfulActivity(userId, scoreChanged ? 'RATING' : 'PROGRESS');
}

export async function getAchievementFeed(limit = 16) {
  const safeLimit = Math.max(1, Math.min(40, Math.trunc(Number(limit) || 16)));
  const { rows } = await q(`
    WITH candidates AS (
      SELECT au.*,u.username,u.display_name,u.avatar_url,u.avatar_source,
        count(*) OVER(PARTITION BY au.user_id,au.batch_id)::int batch_count,
        row_number() OVER(PARTITION BY au.user_id,au.batch_id ORDER BY au.xp DESC,au.achievement_id) batch_rank
      FROM achievement_unlocks au
      JOIN users u ON u.id=au.user_id
      JOIN achievement_profiles ap ON ap.user_id=au.user_id
      WHERE u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' AND ap.share_feed=true
    )
    SELECT * FROM candidates WHERE batch_rank=1 ORDER BY unlocked_at DESC LIMIT $1
  `, [safeLimit]);
  return rows.map(row => {
    const definition = ACHIEVEMENT_BY_ID.get(row.achievement_id);
    if (!definition) return null;
    const avatar = resolvedAvatar(row);
    return {
      ...publicDefinition(definition), username: String(row.username), displayName: row.display_name || row.username,
      avatarUrl: avatar.url, avatarPreset: avatar.preset, unlockedAt: row.unlocked_at,
      batchCount: Number(row.batch_count || 1), url: `/u/${encodeURIComponent(row.username)}?tab=achievements&achievement=${encodeURIComponent(definition.id)}`,
    };
  }).filter(Boolean);
}

export async function publicAchievementProfile(userId) {
  const [unlockResult, pinResult, profileResult] = await Promise.all([
    q('SELECT achievement_id,tier,xp,unlocked_at FROM achievement_unlocks WHERE user_id=$1 ORDER BY unlocked_at DESC', [userId]),
    q('SELECT slot,achievement_id FROM achievement_pins WHERE user_id=$1 ORDER BY slot', [userId]),
    q('SELECT equipped_title FROM achievement_profiles WHERE user_id=$1', [userId]),
  ]);
  const unlocks = unlockResult.rows.map(row => {
    const definition = ACHIEVEMENT_BY_ID.get(row.achievement_id);
    return definition ? { ...publicDefinition(definition), unlocked: true, unlockedAt: row.unlocked_at } : null;
  }).filter(Boolean);
  const byId = new Map(unlocks.map(item => [item.id, item]));
  const pinnedAchievements = pinResult.rows.map(row => byId.get(row.achievement_id)).filter(Boolean);
  const xp = unlockResult.rows.reduce((total, row) => total + Number(row.xp || 0), 0);
  const titles = new Set(unlocks.map(item => item.rewardTitle).filter(Boolean));
  const equippedTitle = titles.has(profileResult.rows[0]?.equipped_title) ? profileResult.rows[0].equipped_title : null;
  return { achievements: unlocks, pinnedAchievements, equippedTitle, rank: levelFromXp(xp) };
}

export async function setAchievementPins(userId, achievementIds = []) {
  const ids = [...new Set(achievementIds.map(String))];
  if (ids.length > 3 || ids.some(id => !ACHIEVEMENT_BY_ID.has(id))) throw Object.assign(new Error('INVALID_PINS'), { code: 'INVALID_PINS' });
  return withTransaction(async client => {
    await ensureProfile(client, userId);
    if (ids.length) {
      const { rows } = await client.query('SELECT achievement_id FROM achievement_unlocks WHERE user_id=$1 AND achievement_id=ANY($2::text[])', [userId, ids]);
      if (rows.length !== ids.length) throw Object.assign(new Error('ACHIEVEMENT_LOCKED'), { code: 'ACHIEVEMENT_LOCKED' });
    }
    await client.query('DELETE FROM achievement_pins WHERE user_id=$1', [userId]);
    for (let index = 0; index < ids.length; index += 1) {
      await client.query('INSERT INTO achievement_pins(user_id,slot,achievement_id) VALUES($1,$2,$3)', [userId, index + 1, ids[index]]);
    }
    return ids;
  });
}

export async function updateAchievementPreferences(userId, { shareFeed, timezone, equippedTitle }) {
  return withTransaction(async client => {
    await ensureProfile(client, userId);
    if (equippedTitle !== undefined && equippedTitle !== null) {
      const allowed = ACHIEVEMENTS.filter(item => item.rewardTitle === equippedTitle).map(item => item.id);
      const unlocked = allowed.length && (await client.query(
        'SELECT 1 FROM achievement_unlocks WHERE user_id=$1 AND achievement_id=ANY($2::text[]) LIMIT 1', [userId, allowed],
      )).rows[0];
      if (!unlocked) throw Object.assign(new Error('TITLE_LOCKED'), { code: 'TITLE_LOCKED' });
    }
    const cleanTimezone = timezone === undefined ? undefined : validTimeZone(timezone);
    if (timezone !== undefined && !cleanTimezone) throw Object.assign(new Error('INVALID_TIMEZONE'), { code: 'INVALID_TIMEZONE' });
    const { rows } = await client.query(`
      UPDATE achievement_profiles SET
        share_feed=COALESCE($2,share_feed),timezone=COALESCE($3,timezone),
        equipped_title=CASE WHEN $4::boolean THEN $5 ELSE equipped_title END,updated_at=now()
      WHERE user_id=$1 RETURNING share_feed,timezone,equipped_title
    `, [userId, shareFeed === undefined ? null : Boolean(shareFeed), cleanTimezone || null, equippedTitle !== undefined, equippedTitle || null]);
    return rows[0];
  });
}

export async function syncAllUsersAchievements({ maxUsers = Number.POSITIVE_INFINITY, onError = () => {} } = {}) {
  let cursor = null, processed = 0;
  while (processed < maxUsers) {
    const { rows } = await q(`
      SELECT u.id FROM users u LEFT JOIN achievement_profiles ap ON ap.user_id=u.id
      WHERE u.deleted_at IS NULL AND u.status='active' AND ap.first_evaluated_at IS NULL
        AND ($1::uuid IS NULL OR u.id>$1)
      ORDER BY u.id LIMIT 25
    `, [cursor]);
    if (!rows.length) break;
    for (const row of rows) {
      cursor = row.id;
      try { await syncUserAchievements(row.id, { source: 'RETROACTIVE', notify: true }); } catch (error) { onError(error, row.id); }
      processed += 1;
      if (processed >= maxUsers) break;
    }
  }
  return { processed };
}

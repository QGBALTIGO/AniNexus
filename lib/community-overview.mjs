// Aggregate public contributions before joining metadata, so covers never multiply votes.
export const communityOverviewSql = `
WITH members AS MATERIALIZED (
  SELECT id,username,display_name,avatar_url,created_at,show_library,show_activity,show_stats
  FROM users WHERE deleted_at IS NULL AND status='active' AND privacy='public'
), lists AS MATERIALIZED (
  SELECT a.user_id,a.media_id,'ANIME'::text media_type,a.status,a.score,a.reactions,a.reaction,a.updated_at
  FROM user_anime a JOIN members u ON u.id=a.user_id
  WHERE u.show_library IS DISTINCT FROM false AND u.show_stats IS DISTINCT FROM false
  UNION ALL
  SELECT a.user_id,a.media_id,'MANGA',a.status,a.score,a.reactions,a.reaction,a.updated_at
  FROM user_manga a JOIN members u ON u.id=a.user_id
  WHERE u.show_library IS DISTINCT FROM false AND u.show_stats IS DISTINCT FROM false
), reactions AS MATERIALIZED (
  SELECT l.user_id,l.media_id,l.media_type,r.label
  FROM lists l CROSS JOIN LATERAL (
    SELECT DISTINCT CASE value WHEN 'LOVE' THEN 'Amei' WHEN 'LIKE' THEN 'Curtindo'
      WHEN 'DISLIKE' THEN 'Esperava mais' WHEN 'WOW' THEN 'De arrepiar' ELSE value END label
    FROM jsonb_array_elements_text(CASE WHEN jsonb_array_length(l.reactions)>0 THEN l.reactions
      WHEN l.reaction IS NOT NULL THEN jsonb_build_array(l.reaction) ELSE '[]'::jsonb END)
  ) r WHERE r.label<>''
), votes AS (
  SELECT media_id,media_type,label,count(*)::int count FROM reactions GROUP BY media_id,media_type,label
), ranked AS (
  SELECT v.*,row_number() OVER(PARTITION BY label ORDER BY count DESC,media_type,media_id) rank FROM votes v
), favorites AS (
  SELECT f.media_id,f.media_type,count(*)::int count FROM user_favorites f JOIN members u ON u.id=f.user_id
  WHERE u.show_library IS DISTINCT FROM false AND u.show_stats IS DISTINCT FROM false
  GROUP BY f.media_id,f.media_type ORDER BY count DESC,f.media_type,f.media_id LIMIT 6
), drops AS (
  SELECT media_id,media_type,count(*) FILTER(WHERE status='DROPPED')::int dropped,
    count(*) FILTER(WHERE status='COMPLETED')::int completed
  FROM lists GROUP BY media_id,media_type HAVING count(*) FILTER(WHERE status='DROPPED')>0
  ORDER BY dropped DESC,media_type,media_id LIMIT 5
), contributions AS (
  SELECT user_id,updated_at at FROM lists
  UNION ALL SELECT i.user_id,i.created_at FROM impressions i JOIN members u ON u.id=i.user_id
    WHERE i.hidden=false AND u.show_activity IS DISTINCT FROM false
  UNION ALL SELECT t.user_id,t.created_at FROM community_threads t JOIN members u ON u.id=t.user_id
    WHERE t.hidden=false AND u.show_activity IS DISTINCT FROM false
  UNION ALL SELECT p.user_id,p.created_at FROM community_posts p JOIN community_threads t ON t.id=p.thread_id
    JOIN members u ON u.id=p.user_id WHERE p.hidden=false AND t.hidden=false AND u.show_activity IS DISTINCT FROM false
), active AS (
  SELECT u.username,u.display_name,u.avatar_url,d.days,count(*)::int count,
    row_number() OVER(PARTITION BY d.days ORDER BY count(*) DESC,u.username) rank
  FROM contributions c JOIN members u ON u.id=c.user_id CROSS JOIN (VALUES(7),(30)) d(days)
  WHERE c.at>=now()-d.days*interval '1 day' AND u.show_activity IS DISTINCT FROM false
  GROUP BY u.username,u.display_name,u.avatar_url,d.days
), studios AS (
  SELECT studio->>'name' name,count(*)::int count FROM lists l
  JOIN media_cache mc ON mc.media_id=l.media_id AND mc.media_type=l.media_type
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(mc.payload->'studios')='array'
    THEN mc.payload->'studios' ELSE '[]'::jsonb END) studio
  WHERE l.media_type='ANIME' AND COALESCE(studio->>'name','')<>''
  GROUP BY studio->>'name' ORDER BY count DESC,name LIMIT 10
)
SELECT jsonb_build_object(
  'totals',jsonb_build_object(
    'works',(SELECT count(*) FROM media_cache WHERE media_type IN ('ANIME','MANGA')),
    'reactions',(SELECT count(*) FROM reactions),
    'completed',(SELECT count(*) FROM lists WHERE status='COMPLETED'),
    'impressions',(SELECT count(*) FROM impressions i JOIN members u ON u.id=i.user_id WHERE i.hidden=false AND u.show_activity IS DISTINCT FROM false),
    'ratings',(SELECT count(score) FROM lists)),
  'distribution',COALESCE((SELECT jsonb_agg(x ORDER BY count DESC,label) FROM
    (SELECT label,count(*)::int count FROM reactions GROUP BY label) x),'[]'::jsonb),
  'rankings',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.media_id,'mediaType',r.media_type,
    'label',r.label,'count',r.count,'rank',r.rank,'title',mc.payload->>'title','cover',mc.payload->>'cover') ORDER BY label,rank)
    FROM ranked r LEFT JOIN media_cache mc ON mc.media_id=r.media_id AND mc.media_type=r.media_type WHERE rank<=6),'[]'::jsonb),
  'favorites',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.media_id,'mediaType',f.media_type,
    'count',f.count,'title',mc.payload->>'title','cover',mc.payload->>'cover') ORDER BY f.count DESC,f.media_type,f.media_id)
    FROM favorites f LEFT JOIN media_cache mc ON mc.media_id=f.media_id AND mc.media_type=f.media_type),'[]'::jsonb),
  'dropped',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.media_id,'mediaType',d.media_type,
    'dropped',d.dropped,'completed',d.completed,'title',mc.payload->>'title','cover',mc.payload->>'cover') ORDER BY d.dropped DESC,d.media_type,d.media_id)
    FROM drops d LEFT JOIN media_cache mc ON mc.media_id=d.media_id AND mc.media_type=d.media_type),'[]'::jsonb),
  'studios',COALESCE((SELECT jsonb_agg(s ORDER BY count DESC,name) FROM studios s),'[]'::jsonb),
  'activeMembers',COALESCE((SELECT jsonb_agg(a ORDER BY days,rank) FROM active a WHERE rank<=10),'[]'::jsonb),
  'newMembers',COALESCE((SELECT jsonb_agg(m ORDER BY created_at DESC,username) FROM
    (SELECT username,display_name,avatar_url,created_at FROM members ORDER BY created_at DESC,username LIMIT 8) m),'[]'::jsonb),
  'joinedToday',(SELECT count(*) FROM members WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
) overview`;

export async function getCommunityOverview(query) {
  const {rows} = await query(communityOverviewSql);
  return rows[0].overview;
}

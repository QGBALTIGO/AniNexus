-- Retire catalog/score questions without erasing votes or rewriting final audits.
INSERT INTO notifications(user_id,kind,title,body,media_id,url,dedupe_key)
SELECT v.user_id,'SYSTEM','Previsão retirada',
  'As perguntas sobre nota ou dados do catálogo foram retiradas. Seu palpite foi preservado no histórico técnico e não afeta sua reputação.',
  p.media_id,'/previsoes','prediction-retired:'||p.id::text
FROM prediction_votes v JOIN prediction_questions p ON p.id=v.question_id
JOIN users u ON u.id=v.user_id
WHERE p.type IN ('SCORE_AT_DEADLINE','CATALOG_DATE_OBSERVED') AND u.deleted_at IS NULL
ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
UPDATE prediction_votes v SET eligible=false
FROM prediction_questions p
WHERE v.question_id=p.id AND p.type IN ('SCORE_AT_DEADLINE','CATALOG_DATE_OBSERVED') AND v.eligible;
UPDATE prediction_questions SET status='VOID',result=NULL,resolved_at=clock_timestamp(),updated_at=clock_timestamp()
WHERE type IN ('SCORE_AT_DEADLINE','CATALOG_DATE_OBSERVED') AND status IN ('OPEN','LOCKED','DRAFT');

ALTER TABLE prediction_questions DROP CONSTRAINT IF EXISTS prediction_questions_type_check;
ALTER TABLE prediction_questions ADD CONSTRAINT prediction_questions_type_check
  CHECK (type IN ('CATALOG_DATE_OBSERVED','SCORE_AT_DEADLINE','OFFICIAL_EVENT'));
ALTER TABLE prediction_questions DROP CONSTRAINT IF EXISTS prediction_questions_source_check;
ALTER TABLE prediction_questions ADD CONSTRAINT prediction_questions_source_check
  CHECK (source IN ('AniList','Crunchyroll','Netflix'));
ALTER TABLE prediction_questions DROP CONSTRAINT IF EXISTS prediction_questions_source_url_check;
ALTER TABLE prediction_questions ADD CONSTRAINT prediction_questions_source_url_check CHECK (
  (source='AniList' AND source_url ~ '^https://anilist[.]co/(anime|manga)/[0-9]+$') OR
  (source='Crunchyroll' AND source_url ~ '^https://(www[.])?crunchyroll[.]com/') OR
  (source='Netflix' AND source_url ~ '^https://(www[.])?netflix[.]com/')
);

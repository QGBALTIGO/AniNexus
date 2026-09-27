-- Existing questions predate vote snapshots. Preserve their current tally as
-- the earliest honest observation; earlier 24h movement cannot be reconstructed.
INSERT INTO prediction_snapshots(question_id,bucket_at,yes_count,no_count)
SELECT p.id,clock_timestamp(),c.yes_count,c.no_count
FROM prediction_questions p
CROSS JOIN LATERAL (
  SELECT count(*) FILTER(WHERE choice='YES')::int yes_count,
         count(*) FILTER(WHERE choice='NO')::int no_count
  FROM prediction_votes v WHERE v.question_id=p.id AND v.eligible
) c
WHERE p.status<>'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM prediction_snapshots s WHERE s.question_id=p.id)
ON CONFLICT DO NOTHING;

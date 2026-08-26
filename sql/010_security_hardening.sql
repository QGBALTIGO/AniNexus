DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_url_length'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_url_length
      CHECK (url IS NULL OR char_length(url) <= 1200) NOT VALID;
    ALTER TABLE notifications VALIDATE CONSTRAINT notifications_url_length;
  END IF;
END $$;

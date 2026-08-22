-- Hot-path indexes for larger traffic volumes. Safe to run repeatedly.
CREATE INDEX IF NOT EXISTS sessions_user_created_idx ON sessions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS user_anime_user_updated_idx ON user_anime(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS user_follows_user_created_idx ON user_follows(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id,created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS impressions_media_visible_idx ON impressions(media_id,created_at DESC) WHERE hidden=false;
CREATE INDEX IF NOT EXISTS community_threads_visible_time_idx ON community_threads(created_at DESC) WHERE hidden=false;
CREATE INDEX IF NOT EXISTS community_threads_visible_media_idx ON community_threads(media_id,created_at DESC) WHERE hidden=false;
CREATE INDEX IF NOT EXISTS community_posts_visible_thread_idx ON community_posts(thread_id,created_at) WHERE hidden=false;
CREATE INDEX IF NOT EXISTS news_articles_live_idx ON news_articles(published_at DESC) WHERE status='published';
CREATE INDEX IF NOT EXISTS news_articles_expiry_idx ON news_articles(expires_at) WHERE status='published';
CREATE INDEX IF NOT EXISTS analytics_events_event_time_idx ON analytics_events(event_name,created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS dmca_requests_status_created_idx ON dmca_requests(status,created_at DESC);

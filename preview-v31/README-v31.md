# AniNexus V31

## Home
- ANIQuim remains a reference for information hierarchy only.
- The top of the Home uses AniNexus red/carmine identity, branded gradients, glow, motion and live-community material.
- The final Tags section is removed by the V31 runtime.
- Manga/Light Novel and News blocks remain first-class Home sections.

## Native news
- `/noticias` is rendered as an AniNexus-native hub.
- `/noticias/:slug` opens an article inside AniNexus.
- PostgreSQL stores title, summary, AniNexus editorial body, image metadata, source traceability and expiry.
- `NEWS_RETENTION_DAYS` defaults to 5 days.
- Automated source material is translated/summarized and rewritten into an original Portuguese AniNexus synthesis instead of copying full source articles.
- Source URLs stay in the database for provenance/audit, not as the primary user reading flow.
- Old articles are archived after expiry and later deleted by the retention sweep.

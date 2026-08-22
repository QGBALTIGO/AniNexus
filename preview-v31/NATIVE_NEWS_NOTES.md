# Native news source handling

AniNexus keeps source metadata internally for provenance and moderation. The user-facing reading experience stays inside AniNexus.

Automated ingestion must not reproduce full third-party articles verbatim. It should extract facts, translate where needed, and generate an original Portuguese synthesis with AniNexus editorial wording. Images should only be used when the upstream feed supplies a usable image URL and the deployment/operator has the right or permission to display it; otherwise the UI falls back to AniNexus artwork/material.

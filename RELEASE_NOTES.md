Release notes - Social Automation Prototype

Finalization checklist completed:

- Core server and endpoints implemented (`/generate`, `/schedule`, `/drafts`, `/prometheus`, `/config/compact`, `/credentials` admin)
- Fallback JSON storage when `better-sqlite3` not available
- Queue + worker with BullMQ fallback
- Connectors for Facebook, LinkedIn, X implemented (basic)
- Prompt compaction + optional model-based summarization
- Cost estimation and budget/alert hooks
- Admin endpoint and minimal UI for credential management
- Tests: integration dry-run + connector unit tests

Operational notes:
- By default the system uses a local simulator unless `REAL_AI_URL` and `REAL_AI_KEY` are set.
- To avoid consuming credits in production, keep `REAL_AI_URL` unset and use dry-run/testing only.
- Configure `ADMIN_TOKEN` in environment to protect credential endpoints.

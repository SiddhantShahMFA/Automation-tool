# Release Log

Use one line per shipped change.

| Date | Branch | Commit | Type | Summary | AI Tool | AI Usage | Human Check | Validation | Client Impact | Rollback | Defect Found |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-03-10 | feature/canonical-prd-history | uncommitted | refactor | Added canonical PRD requirement history, Jira delta review/publish flow, artifact versioning, and project timeline views. | Codex | Schema, API, UI, and build-fix implementation | Pending human review | `npx prisma generate`; `npm run lint`; `npm run build` | Internal planning workflow is now DB-first with reviewable Jira deltas | Revert this branch or back out the added canonical schema and delta routes before merge | None during local verification |
| 2026-03-10 | feature/canonical-prd-history | uncommitted | fix | Added migration-readiness guards, Prisma migration scripts, baseline migration metadata, and local canonical table migration apply flow. | Codex | Runtime guard, migration workflow, DB baseline, and docs update | Pending human review | `npx prisma migrate resolve --applied 20260310_000000_legacy_baseline`; `npm run prisma:migrate`; `npm run lint`; `npm run build`; direct `psql` table check | Project pages no longer crash when canonical tables are missing, and the local DB now contains the canonical tables | Revert the readiness guard changes and migration files if a full baseline migration strategy replaces them | Missing-table runtime error addressed |

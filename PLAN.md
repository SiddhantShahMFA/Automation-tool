# plan.md

## Summary
Refactor the app into an app-DB-first system where PRDs, requirement history, Jira mappings, and generated artifacts are canonical in the database. Notion, `PLAN.md`, and Jira remain projections of the canonical state.

## Implementation Phases
1. Schema and backfill foundation
- Extend the Prisma schema with canonical requirement, change-tracking, Jira mapping, and artifact versioning tables.
- Preserve existing `prd_documents` and `generated_artifacts` data while adding migration-safe backfill support.
- Add helper utilities that normalize PRD content into canonical requirement records and create timeline events.

2. Canonical PRD requirement/version pipeline
- Persist canonical requirements and initial requirement versions when a PRD draft is created.
- Diff updated PRD content against canonical requirements on PRD update and store `ADD`, `UPDATE`, and `REMOVE` requirement changes.
- Version generated artifacts so each PRD version has traceable PRD, plan, Jira delta, Jira publish, and Notion publish snapshots.

3. Jira delta draft and publish workflow
- Replace whole-board Jira regeneration with a delta generation flow tied to changed requirements and existing Jira ticket mappings.
- Store Jira issue identity, ticket-to-requirement links, and publish status in canonical tables rather than only JSON artifacts.
- Keep legacy Jira endpoints as wrappers around the delta flow for compatibility during UI migration.

4. Timeline and UI migration
- Add a project timeline API and render PRD versions, requirement-level changes, artifact versions, Jira draft state, and publish events.
- Update the Jira UI to show reviewed delta actions and explicit approval before publish.
- Fix PRD update navigation to return to the owning project using `projectId`.

5. Verification and rollout hardening
- Backfill existing PRDs, update release documentation, and verify compatibility wrappers.
- Add automated tests around canonical persistence, diffing, Jira delta generation, publish behavior, and timeline ordering.
- Run manual smoke verification for PRD create, PRD update, Jira review/publish, and Notion republish.

## Technical Approach
- Introduce canonical models: `PrdRequirement`, `RequirementVersion`, `RequirementChange`, `JiraTicket`, `JiraTicketRequirementLink`, and `ArtifactVersion`.
- Keep `PrdDocument` as the container record, but treat requirement-level records as authoritative for diffing and downstream regeneration.
- Give each requirement a stable internal key that survives PRD edits; presentation IDs like `FR-1` remain display-only.
- Store timeline events from PRD generation, PRD update, plan generation, Jira delta generation, Jira publish, and Notion publish in queryable database records.
- For Jira removals, record `CLOSE` as a reviewed recommendation only; do not auto-transition Jira workflow states in v1.

## Public APIs and Key Interfaces
- Extend existing PRD create/update responses to include `projectId`, `prdDocumentId`, `version`, `changedRequirementIds`, and `artifactVersionIds`.
- Add `POST /api/jira/generate-delta`.
- Add `POST /api/jira/publish-delta`.
- Add `GET /api/projects/{id}/timeline`.
- Keep `POST /api/jira/generate` and `POST /api/jira/publish` as compatibility wrappers over the new delta workflow.

Core persisted entities:
- `workspace_settings`
- `integration_credentials`
- `projects`
- `prd_documents`
- `prd_requirements`
- `requirement_versions`
- `requirement_changes`
- `jira_tickets`
- `jira_ticket_requirement_links`
- `artifact_versions`
- `generation_sessions`
- `clarification_questions`
- `generated_artifacts`
- `background_jobs`
- `prd_update_logs`
- `audit_events`

## Test Plan
- Create a PRD and verify canonical requirements, initial requirement versions, and artifact versions are persisted.
- Update one requirement and verify only linked Jira tickets are included in the generated delta.
- Add a requirement and verify only new ticket actions are drafted.
- Remove a requirement and verify a `CLOSE` recommendation is drafted and logged.
- Re-run Jira delta generation with no PRD changes and verify the delta is empty.
- Publish an approved Jira delta and verify issue keys persist for Epic and Stories in the selected Jira project.
- Backfill existing PRDs and verify canonical requirement/ticket records are created without losing prior artifact history.
- Verify the timeline endpoint returns ordered PRD, requirement, plan, Jira, and Notion events.
- Perform manual smoke validation for PRD create, PRD update, timeline review, Jira publish review, Jira publish, and Notion republish.

## Rollback Plan
- Keep legacy Jira endpoints and artifact payloads readable during rollout so the UI can fall back if the new delta flow regresses.
- Make schema migrations additive first; only rely on new canonical tables after backfill succeeds.
- Preserve existing `contentJson` snapshots and generated artifact JSON so the prior behavior can still be reconstructed if needed.
- After pulling canonical schema changes, run `npm run prisma:migrate` before opening `/projects/[id]`. Use `npm run prisma:migrate:dev` only when authoring a new migration on a clean migration history.

## Known Risks
- Requirement matching across PRD updates may misclassify edits unless canonical keying and diff heuristics are conservative.
- Backfill quality depends on the consistency of legacy PRD JSON and Jira artifact payloads.
- Jira publish behavior must tolerate partial failures while preserving local ticket identity and auditability.
- Notion remains a projection, so publish metadata must stay versioned to avoid ambiguity after republish.

## Assumptions
- Internal-only single-workspace launch with no external tenant isolation.
- App DB is the canonical source of truth.
- Jira mutations remain review-first.
- Existing Jira endpoints stay as compatibility wrappers during rollout.
- Existing PRDs must be backfilled before the new timeline and Jira delta experience are considered complete.

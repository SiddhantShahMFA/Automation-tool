# plan.md

## Summary
Build v1 as a single-workspace internal app that replaces n8n with an app-owned orchestration layer. The first usable slice is: connect Notion, connect an OpenAI-compatible model, create a PRD from pasted input through a clarification loop, publish it to Notion, and return the live Notion link.

## First Implementation Slice
Implement these first, in this order:

1. App foundation
- Bootstrap a Next.js App Router app, Prisma schema, and Postgres connection.
- Add core tables for `workspace_settings`, `integration_credentials`, `projects`, `prd_documents`, `generation_sessions`, and `background_jobs`.
- Add a minimal internal layout with routes for `/setup`, `/projects`, `/projects/new`, and `/projects/[id]`.

2. Workspace setup flow
- Build a setup wizard that requires Notion first and model config second.
- Add `POST /api/setup/notion/verify` to validate the token and enumerate/select a target Notion database.
- Add `POST /api/setup/model/verify` to validate `baseUrl`, `apiKey`, and `model` against an OpenAI-compatible endpoint.
- Encrypt secrets at rest and store only masked values in the UI after save.

3. PRD creation vertical slice
- Build the `Create PRD` screen with a large input box for notes/transcript/context.
- Add `POST /api/prds/create/session` to create a generation session from pasted input.
- Add a clarification stage that extracts missing requirements and renders follow-up questions in the UI.
- Add `POST /api/sessions/{id}/answers` and `POST /api/sessions/{id}/generate` to turn user input plus answers into a structured PRD draft.
- Render a review screen before publish.

4. Notion publish path
- Add `POST /api/prds/{id}/publish`.
- Map the reviewed PRD draft into the app-owned Notion database schema and page body template.
- Store the resulting Notion page ID and return the page URL to the UI.
- Make publish idempotent so a retry does not create duplicate pages.

## Key Implementation Details
- Use a separate worker runtime for long-running LLM and Notion write jobs; the web app should enqueue and poll job status rather than doing everything inline.
- Standardize the Notion PRD structure in v1: overview, goals, users, scope, functional requirements, non-functional requirements, assumptions/open questions, and change log.
- Only support full round-trip updates for PRDs created by the app in the configured Notion database.
- Defer Jira until after PRD create/update is working end to end.

## Public APIs and Types
- `POST /api/setup/notion/verify`
- `POST /api/setup/model/verify`
- `POST /api/prds/create/session`
- `POST /api/sessions/{id}/answers`
- `POST /api/sessions/{id}/generate`
- `POST /api/prds/{id}/publish`

Core persisted entities:
- `workspace_settings`
- `integration_credentials`
- `projects`
- `prd_documents`
- `generation_sessions`
- `clarification_questions`
- `generated_artifacts`
- `background_jobs`

## Test Plan
- Verify valid and invalid Notion credentials against database selection.
- Verify valid and invalid OpenAI-compatible model configs.
- Create a PRD from short notes and from a long transcript.
- Confirm clarification questions are required before final generation when input is incomplete.
- Confirm publish creates one Notion page, stores the page ID, and returns a working link.
- Confirm retrying publish does not duplicate the PRD in Notion.
- Confirm failed model or Notion jobs surface actionable errors in the UI.

## Assumptions
- Internal-only v1 with no app-level login.
- Vercel hosts the web app; a small worker service handles durable background jobs.
- Notion is mandatory in setup; Jira stays optional until ticket generation is added.
- `plan.md` is generated in-app later; GitHub push/commit is out of scope for v1.

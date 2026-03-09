# AGENTS.md

Purpose: This file defines the operating rules for AI-assisted software development in this repository. All AI tools used for planning, coding, testing, refactoring, or documentation must follow this file.

Status: Mandatory for this repository.
Location: Repository root.
Applies to: All contributors, all branches, all features, all bug fixes, all AI tools.

---

## 1) Core Principles

These rules are non-negotiable:

- Do not start implementation unless the required repository documents exist and are current.
- Do not use AI output blindly; read, verify, and understand all generated code before committing it.
- Ask the user when requirements, assumptions, or implementation choices are unclear.
- Security, correctness, code quality, and rollback safety take priority over speed.
- Human approval is required before merge.
- Merge is always manual.

---

## 2) Required Project Artifacts

Before coding, confirm the following exist:

1. plan.md
   - Stored in the repository root or feature folder.
   - Must exist before coding starts.
   - Must contain:
     - Feature overview
     - Implementation phases
     - Technical approach
     - Key interfaces and dependencies
     - Test plan
     - Rollback plan
     - Known risks

2. AGENTS.md
   - Stored in the repository root.
   - Must exist before any AI tool is used for coding work.

If any required artifact is missing, stop and create or update it first.

Do not begin implementation until `plan.md` is complete enough that another contributor could continue the work safely.

---

## 3) Required Delivery Flow

Follow this sequence for every task, feature, or change:

1. Review the requirement and identify any missing information.
2. Ask the user about any ambiguity before planning or coding.
3. Ask which branch should be used as the base:
   - current branch
   - or another branch such as `main`, `master`, `develop`, or a release branch
4. Create or update `plan.md`.
5. Confirm this `AGENTS.md` is present and applicable.
6. Create a feature branch from the approved base branch.
7. Break the work into small tasks and implementation phases.
8. Implement in small, reviewable increments.
9. Write and update tests as you build.
10. Commit code regularly.
11. Run required checks and quality gates.
12. Open a pull request with the required summaries.
13. Obtain human review and approval.
14. Merge manually only after all checks pass and human approval is given.
15. Deploy according to the rollback plan.

Do not skip the clarification step. If a requirement is unclear, stop and ask.

---

## 4) Clarification Rules

The implementer must ask the user before proceeding whenever any of the following is unclear:

- Which branch should be used as the base branch
- Scope of the feature or bug fix
- Acceptance criteria
- Provider or integration choice
- Required environments or deployment targets
- Data model assumptions
- Security-sensitive behavior
- Whether backward compatibility is required
- Whether any existing behavior must be preserved exactly

For authentication or authorization work, do not assume:
- Auth provider choice
- Password rules
- Registration rules
- Role requirements
- Protected routes or protected actions
- Email verification requirements
- Password reset requirements
- Session behavior
- Redirect behavior after login/logout

If the user has not specified these, ask first.

---

## 5) Git and Branch Rules

Git history must stay clean, reviewable, and easy to roll back.

### Branch rules
- Never commit directly to `main`, `master`, or any protected production branch.
- Always create a feature branch before starting implementation.
- Before creating the branch, ask whether it should be created from the current branch or from another base branch.
- Use short, descriptive branch names.

Recommended branch name patterns:
- `feature/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`
- `refactor/<short-description>`
- `hotfix/<short-description>`

Examples:
- `feature/user-auth`
- `fix/session-timeout`
- `refactor/auth-middleware`

### Commit rules
- Commit regularly in small, reviewable units.
- Each commit should represent one logical change.
- Write clear commit messages that explain intent, not just files changed.
- Avoid mixing unrelated changes in the same commit.
- Do not commit generated secrets, `.env` files, production credentials, or sensitive data.
- Do not commit broken code unless the branch is clearly marked as work in progress and is not opened for final review.
- Rebase or clean up noisy history before merge when appropriate.

Recommended commit style:
- `feat: add auth configuration and login flow`
- `fix: reject invalid session token`
- `test: add registration and login coverage`
- `refactor: simplify auth provider setup`
- `chore: add auth-related environment examples`

### Sync rules
- Pull and sync with the target branch regularly.
- Resolve merge conflicts carefully; never accept conflicting AI output without review.
- Re-run tests and required checks after conflict resolution or rebasing.
- If the branch drifts significantly from the base branch, re-validate the rollback plan.

### Protected branch rules
- Protected branches must require pull requests.
- Protected branches should require passing CI checks where available.
- Direct pushes to protected branches should be disabled.
- Force-push to shared branches is discouraged; if used on a personal feature branch, do it only before review or with team awareness.

### Merge rules
- Merge is always manual.
- AI tools must never merge branches, auto-approve pull requests, or bypass branch protections.
- Do not use automatic merge actions unless a human explicitly triggers and verifies them.
- A human reviewer must approve the pull request before merge.
- Merge only after all required checks pass.

### Preferred merge behavior
- Prefer squash merge or rebase merge for small, self-contained changes when it keeps history cleaner.
- Prefer merge commits when preserving branch history is important.
- Choose one merge strategy per repository and use it consistently.

### Before merge
- Confirm the branch is up to date with the base branch.
- Confirm tests and required checks are passing.
- Confirm the PR summary is complete.
- Confirm the rollback plan still matches the final diff.

### After merge
- Delete the feature branch after successful merge unless there is a documented reason to keep it.
- Confirm deployment or release steps follow the rollback plan.
- If a post-merge issue appears, prioritize rollback or revert over unreviewed hot patches.

---

## 6) AI Tool Rules

Any AI tool may be used, but the following rules always apply:

### Never do this
- Never paste API keys, passwords, tokens, client secrets, production secrets, or sensitive personal data into an AI tool.
- Never allow AI to auto-deploy to production.
- Never allow AI to execute destructive database commands.
- Never merge AI-generated code without reading and understanding it.
- Never ignore security warnings, quality gate failures, or code review findings.
- Never fabricate test results, approvals, logs, or completion status.
- Never bypass review or rollback requirements.
- Never guess when the requirement is ambiguous.

### Always do this
- Always review, edit, and validate AI-generated output.
- Always follow this file before accepting AI-generated code.
- Always ask the user when requirements are incomplete or unclear.
- Always write tests for AI-generated or AI-assisted changes.
- Always manually validate security-sensitive code, especially:
  - Authentication and authorization
  - Payments and financial logic
  - File upload, storage, and handling
  - Database access and migrations
  - Permissions, secrets, and access control
- Always include a pull request summary that states:
  - What AI generated
  - What was changed manually
  - What risks were checked

When in doubt, prefer smaller prompts, smaller commits, and more human verification.

---

## 7) Planning Rules

`plan.md` is mandatory and must be updated before implementation starts.

At minimum, `plan.md` must include:
- Feature overview
- Implementation phases
- Technical approach
- Key interfaces and dependencies
- Test plan
- Rollback plan
- Known risks

### Phase requirements
Break implementation into clear phases. Do not use a single undifferentiated task list for meaningful features.

Example phase structure:
- Phase 1: discovery and clarification
- Phase 2: schema or interface changes
- Phase 3: backend implementation
- Phase 4: UI integration
- Phase 5: test implementation
- Phase 6: manual verification and PR prep

### Risk requirements
Known risks must be explicit, not implied. Document at least:
- Security risks
- Data or migration risks
- Session or state risks
- User access risks
- Compatibility risks
- Rollback risks

### Rollback requirements
The rollback plan must explain:
- What files or systems are changing
- What can be reverted safely
- Whether schema changes are reversible
- What to do if deployment fails
- How to restore previous behavior quickly

Do not start coding until `plan.md` has real phases, a real rollback plan, and real risks.

---

## 8) Coding Standards

Unless the repository specifies stricter rules, use these defaults:

- Prefer clear, maintainable, idiomatic code over clever code.
- Keep functions and modules focused on one responsibility.
- Reuse existing patterns in the repository before introducing new abstractions.
- Avoid unnecessary dependencies.
- Keep public interfaces stable unless the task explicitly requires a breaking change.
- Document non-obvious decisions in code comments or `plan.md`.
- Preserve backward compatibility where practical.
- Favor explicit error handling over silent failure.
- Log meaningful operational events, but never log secrets or sensitive user data.

### Framework correctness
- Follow the current official documentation for framework- and library-specific implementation details.
- Do not assume a pattern is valid just because it worked in another version of the framework.
- If a library requires a client-side wrapper, server-side route, env variable, adapter, or setup sequence, reflect that accurately in the plan before coding.
- When implementation details are version-sensitive, confirm them before proceeding.

### Language and framework specifics
Add project-specific rules here, for example:
- Naming conventions
- Folder structure
- API design conventions
- ORM usage rules
- Migration practices
- Frontend state management rules
- Accessibility requirements
- Performance budgets

If repository-specific conventions exist elsewhere, follow those in addition to this file.

---

## 9) Security Rules

Security is mandatory for every change.

- Treat all external input as untrusted.
- Validate and sanitize inputs at system boundaries.
- Use parameterized queries or safe ORM patterns; never build SQL through string concatenation.
- Enforce authentication and authorization explicitly.
- Use least-privilege access for services, roles, and credentials.
- Do not hardcode secrets, credentials, or private endpoints.
- Store secrets only in approved secret-management systems or environment configuration.
- Avoid insecure defaults.
- Review changes carefully for:
  - Injection risks
  - Broken access control
  - Sensitive data exposure
  - Unsafe file handling
  - SSRF, XSS, CSRF, and deserialization risks where relevant
- For database changes:
  - Review migration safety
  - Check rollback feasibility
  - Avoid destructive changes without explicit approval and recovery planning

### Additional rules for authentication work
- Authentication work is always security-sensitive.
- Authentication changes require manual security review before merge.
- Do not assume password policy, session duration, redirect rules, or provider behavior without confirmation.
- Password storage must use approved hashing, never plaintext or reversible encryption.
- Registration, login, logout, invalid credential handling, and protected-route behavior must all be reviewed explicitly.

If the repository uses security tooling, high-severity findings must be fixed before merge unless a human reviewer explicitly accepts and records the risk.

---

## 10) Environment and Configuration Rules

When a feature depends on infrastructure or configuration, the plan must include that setup explicitly.

Examples:
- Environment variables
- Database connection settings
- Auth URLs and callback URLs
- Secret generation
- Provider credentials
- Local development setup
- CI environment updates
- Deployment environment updates

Do not assume required configuration already exists. Confirm it.

When database schema changes are required:
- Prefer proper tracked migrations as the default path
- Use quick schema sync commands only when explicitly appropriate for the repository
- Re-check rollback implications before applying schema changes

---

## 11) Testing Rules

Tests are required for all new or changed behavior unless a human reviewer explicitly approves a documented exception.

Minimum expectations:
- Add or update unit tests for business logic.
- Add integration tests for important cross-system behavior where applicable.
- Add regression tests for bugs being fixed.
- Verify edge cases, error paths, and access control behavior.
- Ensure tests are deterministic and runnable in CI.

### If the project has no existing test suite
- Do not use the lack of tests as a reason to skip testing.
- Add the minimum viable test setup needed to cover the new requirement.
- Include tests for the new feature as part of the implementation.
- Manual verification may supplement tests, but it does not replace them.

### Additional minimum expectations for authentication work
At minimum, add coverage for:
- Registration flow
- Login flow
- Logout flow
- Invalid credentials
- Session or auth state behavior
- Protected route or protected action behavior

Do not:
- Remove tests just to make CI pass.
- Mark tests flaky without investigation.
- Claim coverage that does not exist.
- Replace automated tests with only manual verification unless a reviewer explicitly approves a documented exception.

If a change is hard to test, document why in the PR and propose the nearest reliable alternative.

---

## 12) Manual Verification Rules

Manual verification is required for important user flows, especially security-sensitive changes, but it is not a substitute for automated testing.

Manual verification should include:
- Happy path behavior
- Error handling
- Permission or access behavior
- State persistence where relevant
- Rollback-sensitive behavior where relevant

For authentication work, manually verify:
- User can register if registration is in scope
- User can log in with valid credentials
- Invalid credentials are rejected safely
- User can log out
- Auth state updates correctly in the UI
- Protected routes or actions behave correctly

Document what was checked in the pull request.

---

## 13) Pull Request Rules

Every pull request must be complete and reviewable.

### PR description must include
- Summary of the change
- Summary of what AI generated
- Summary of manual edits and checks performed
- Risks reviewed
- Test evidence
- Manual verification evidence
- Rollback plan

### Required checklist
- [ ] `plan.md` exists and is up to date
- [ ] `plan.md` includes phases, test plan, rollback plan, and known risks
- [ ] Any unclear requirements were clarified with the user before implementation
- [ ] The feature branch was created from the approved base branch
- [ ] `AGENTS.md` rules were followed
- [ ] Tests were added or updated and are passing
- [ ] Manual verification was performed for user-facing changes
- [ ] Security-sensitive code was manually reviewed where applicable
- [ ] Required environment or configuration changes are documented
- [ ] Rollback plan is clear
- [ ] AI contribution summary is included

### If enabled in this repository
- [ ] Snyk scan passed
- [ ] SonarQube quality gate passed
- [ ] CodeRabbit comments reviewed and resolved

Do not open a “ready for review” pull request until these are satisfied.

---

## 14) Review and Merge Rules

Human review is mandatory before merge.

The reviewer must confirm:
- The code works as intended
- Tests exist and are appropriate
- Manual verification is documented where needed
- Security has been checked
- The rollback plan is clear

Do not merge if:
- Required checks are failing
- Required documentation is missing
- Security warnings remain unresolved without explicit approval
- The change cannot be explained clearly by the author
- The reviewer has unresolved concerns

Additional merge requirements:
- Merge is always manual.
- No AI tool may merge code on behalf of a contributor or reviewer.
- No bot, script, or automation may bypass required review or branch protections.
- The final merge action must be performed intentionally by an authorized human.

---

## 15) Deployment and Rollback

Before merging, ensure the rollback plan is practical and documented.

For any risky change, document:
- What could fail
- How to detect failure
- How to revert safely
- Any manual operational steps
- Any data or migration recovery concerns

Never rely on “fix forward later” as the only safety plan for a high-risk change.

If the change includes configuration, schema, auth, or access-control updates, verify rollback steps especially carefully.

---

## 16) Expected Contributor Behavior

All contributors, including AI-assisted contributors, must:
- Ask for clarification when requirements are ambiguous
- Surface risks early
- Prefer small, reversible changes
- Keep commits focused and descriptive
- Leave the codebase cleaner when practical
- Escalate uncertainty instead of guessing on security-critical behavior

Do not guess your way through missing requirements.

---

## 17) Definition of Done

A change is done only when:
- The implementation matches the approved and clarified scope
- `plan.md` is updated
- `plan.md` includes phases, test plan, rollback plan, and known risks
- Tests are added or updated and passing
- Required manual verification is completed
- Required security and quality checks pass
- PR documentation is complete
- A human approves the change
- The rollback path is clear

If any of the above is missing, the work is not done.

---

## 18) Local Project Overrides

Projects may add stricter rules below, but they may not weaken the mandatory controls in this file.

Add repository-specific details here:
- Tech stack rules
- Architecture constraints
- Compliance requirements
- Performance expectations
- Accessibility standards
- Environment setup notes
- CI/CD specifics
- Branch naming conventions
- Commit message conventions

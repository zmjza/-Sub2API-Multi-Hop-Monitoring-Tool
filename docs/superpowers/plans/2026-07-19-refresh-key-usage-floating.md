# Refresh, Key Context, Usage, and Floating Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all-site refresh truthful and responsive, persist per-site manual key presentation, improve usage records, and add safe draggable floating-window placement.

**Architecture:** Keep network ownership in `SiteService` and `RefreshScheduler`, expose one validated per-site key-context map through IPC, and emit a site-scoped key-context event as soon as core key data is available. Keep renderer state keyed by site ID so card selection and manual key state are independent. Extend floating settings with a backward-compatible custom position and use pure work-area geometry helpers before persisting native move events.

**Tech Stack:** Electron, React, TypeScript, Zod, SQLite settings, Vitest, Playwright, electron-builder.

---

### Task 1: Establish failing refresh and key-context tests

**Files:**

- Modify: `electron/main/services/refresh-scheduler.test.ts`
- Modify: `electron/main/services/site-service.integration.test.ts`
- Modify: `src/renderer/shells/overview/OverviewPage.test.ts`
- Create: `src/renderer/site-key-context.test.ts`

- [x] Add a scheduler test proving concurrent duplicate `refreshAll()` calls share one active run.
- [x] Add service tests proving cached key summaries survive service recreation and the key-context listener runs before per-key request statistics finish.
- [x] Add renderer tests proving independent key/filter responses do not overwrite another site.
- [x] Add overview tests proving a non-selected manually configured site still uses its own quota.
- [x] Run the focused Vitest files and confirm each new assertion fails for the missing behavior.

### Task 2: Implement all-site refresh and early key contexts

**Files:**

- Modify: `electron/shared/contracts.ts`
- Modify: `electron/main/storage/database.ts`
- Modify: `electron/main/services/site-service.ts`
- Modify: `electron/main/services/refresh-scheduler.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/bridge.cts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/preview/types.ts`

- [x] Add strict `siteKeyContextSchema` and a record schema containing `keys` plus `preference`.
- [x] Persist only non-secret normalized key summaries under a site-scoped setting and hydrate them in `SiteService` construction.
- [x] Add `listKeyContexts()` and a site-scoped listener invoked immediately after `readCore()` returns and key cache is committed.
- [x] Add a validated `sites:refresh-all` IPC backed by `RefreshScheduler.refreshAll()` and a `keys:changed` event.
- [x] Deduplicate simultaneous `refreshAll()` calls while preserving current-site priority, concurrency limits, and isolated failures.
- [x] Replace renderer singleton key state with `Record<siteId, SiteKeyContext>` and independently update keys, preference, and usage filters.
- [x] Derive provisional group filter options from cached keys, then merge remote groups/models without clearing successful values.
- [x] Route overview refresh to all sites, top-bar refresh by current shell, and floating refresh to current site.
- [x] Run focused tests until green, then run all service/renderer tests.

### Task 3: Make manual key cards site-scoped

**Files:**

- Modify: `src/renderer/preview/types.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/shells/overview/OverviewPage.tsx`
- Modify: `src/renderer/shells/overview/overview.css`
- Modify: `src/renderer/shells/overview/OverviewPage.test.ts`

- [x] Change the preference callback signature to `(siteId, preference)` and update only that site's context.
- [x] Render a select for every manual card and for the currently selected automatic card; stop control clicks from selecting the card accidentally.
- [x] Compute quota from the card's own selected key and use account balance for zero/missing quota.
- [x] Preserve the selected border independently from manual presentation and reset only invalid/stopped keys to automatic mode.
- [x] Add stable loading, fallback, and long-label CSS without changing the global theme.
- [x] Run overview and E2E integration tests until green.

### Task 4: Improve per-key request-stat performance

**Files:**

- Modify: `electron/main/adapters/sub2api-adapter.ts`
- Modify: `electron/main/adapters/sub2api-adapter.test.ts`

- [x] Add a failing test proving today-request reads use a bounded worker pool and isolate call ordering from result mapping.
- [x] Implement a small fixed concurrency limit while retaining per-worker pauses and stable key-to-result mapping.
- [x] Verify adapter tests and service refresh tests.

### Task 5: Rebuild the usage Token cell and timestamp

**Files:**

- Modify: `src/renderer/lib/format.test.ts`
- Modify: `src/renderer/lib/format.ts`
- Modify: `src/renderer/shells/usage/UsagePage.test.ts`
- Modify: `src/renderer/shells/usage/UsagePage.tsx`
- Modify: `src/renderer/shells/usage/types.ts`
- Modify: `src/renderer/shells/usage/data.ts`
- Modify: `src/renderer/shells/usage/usage.css`
- Modify: `tests/e2e/electron-smoke.spec.ts`

- [x] Add failing formatter tests for `YYYY/MM/DD HH:mm:ss` and invalid input.
- [x] Add a pure row-normalization test for input, output, and cache-read tokens.
- [x] Remove the visible cache-token column and render the three metrics in one stable cell using Lucide icons and accessible labels.
- [x] Retain first-token thresholds and CSV fields.
- [x] Update mock API data and E2E assertions for exact timestamp and token metrics.
- [x] Run usage, formatter, adapter, and E2E tests.

### Task 6: Add floating title, action group, and custom placement

**Files:**

- Modify: `electron/shared/contracts.test.ts`
- Modify: `electron/shared/contracts.ts`
- Modify: `electron/main/domain/window-bounds.test.ts`
- Modify: `electron/main/domain/window-bounds.ts`
- Modify: `electron/main/index.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/preview/types.ts`
- Modify: `src/renderer/shells/floating/FloatingWindow.test.ts`
- Modify: `src/renderer/shells/floating/FloatingWindow.tsx`
- Modify: `src/renderer/shells/floating/floating.css`
- Modify: `tests/e2e/electron-smoke.spec.ts`

- [x] Add schema tests for preset/custom settings and reject partial or unsafe coordinates.
- [x] Add pure geometry tests for negative displays, clamping, removed displays, and preset corners.
- [x] Extend settings to a discriminated `placement` while accepting legacy `position` rows through normalization.
- [x] Restore custom bounds against available display work areas; make presets use the display nearest the current window.
- [x] Mark the header safe area draggable and every interactive descendant `no-drag`.
- [x] Debounce native move persistence, ignore programmatic moves, and store the clamped final bounds.
- [x] Prefer trimmed site note for the floating title and group open/refresh buttons at bottom-right.
- [x] Add E2E coverage for title sync, grouped actions, custom movement, restart restore, and preset override.
- [x] Preserve `380x260`, `alwaysOnTop=false`, show-inactive behavior, and existing opacity behavior.

### Task 7: Documentation, release, and final verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: relevant files under `liran_docs/`
- Modify: relevant files under `docs/pitfalls/`
- Update: `release/` current-version artifacts and metadata

- [x] Increment patch version from the authoritative current version.
- [x] Update requirements, architecture, API/data, tests, tracking, UI-shell, and real-device documentation with only verified results.
- [x] Record newly confirmed pitfalls using the mandatory symptom/root-cause/fix/verification format.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, security audit, and Electron E2E.
- [x] Build a no-sign macOS directory for real-device testing and capture stable screenshots under `real-test-evidence/`.
- [x] Perform macOS real-device interaction and visual checks for every requested state.
- [x] Build the macOS ARM64 DMG and Windows x64 NSIS, inspect metadata/structure, and calculate SHA-256.
- [x] Ensure `release/` contains only current-version release files and current builder metadata without deleting source or user data.
- [x] Inspect the full final diff and map every objective requirement to direct evidence.

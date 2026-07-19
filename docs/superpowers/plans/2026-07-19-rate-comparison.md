# Rate Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-site recharge-ratio settings, safe available-group rate loading, per-site rate popovers, and normalized cross-site platform comparisons.

**Architecture:** The main process owns authenticated requests, strict normalization, persisted safe caches, ratio settings, inflight deduplication, and bounded all-site refresh. The Renderer receives only strict shared-contract payloads and uses focused pure helpers for platform labels, effective-rate calculations, cheapest-group selection, and cross-site comparison. `App.tsx` coordinates IPC state while `OverviewPage` renders the existing dashboard UI.

**Tech Stack:** Electron 43, React 19, TypeScript 5.9, Zod 4, Vitest, Playwright, node:sqlite, existing CSS and Lucide icons.

---

### Task 1: Rate contracts and pure comparison rules

**Files:**

- Modify: `electron/shared/contracts.ts`
- Modify: `electron/shared/contracts.test.ts`
- Create: `src/renderer/shells/overview/rate-comparison.ts`
- Create: `src/renderer/shells/overview/rate-comparison.test.ts`

- [x] Write failing contract tests proving arbitrary upstream fields are rejected, ratios must be finite and positive, and zero group rates remain valid.
- [x] Write failing pure tests for `rate / ratio`, six-decimal formatting, known/unknown platform labels, per-platform minima, ties, inactive/invalid exclusion, and exclusion of sites with no ratio.
- [x] Run `npm test -- --run electron/shared/contracts.test.ts src/renderer/shells/overview/rate-comparison.test.ts` and confirm failures are caused by missing APIs.
- [x] Add strict `AvailableRateGroup`, per-site rate cache/result, ratio map, and request schemas plus minimal pure helper implementations.
- [x] Re-run the same tests and refactor only while green.

### Task 2: Adapter normalization and safe persistence

**Files:**

- Modify: `electron/main/adapters/sub2api-adapter.ts`
- Modify: `electron/main/adapters/sub2api-adapter.test.ts`
- Modify: `electron/main/storage/database.ts`
- Modify: `electron/main/storage/storage.test.ts`

- [x] Write failing adapter tests for finite non-negative `rate_multiplier`, finite payload unwrapping, description/platform/status preservation, inactive retention for downstream exclusion, and secret-field dropping.
- [x] Write failing database tests for per-site safe rate cache, fetched time, and positive recharge ratio persistence.
- [x] Run the two targeted test files and confirm RED.
- [x] Implement `readAvailableRateGroups`, keep `readUsageGroups` compatible through shared normalized data, and add focused database getters/setters.
- [x] Re-run targeted tests and inspect serialized cache to confirm it cannot contain credentials or arbitrary upstream fields.

### Task 3: SiteService rate coordinator and IPC

**Files:**

- Modify: `electron/main/services/site-service.ts`
- Modify: `electron/main/services/site-service.integration.test.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/bridge.cts`

- [x] Write failing integration tests proving cached contexts load before network refresh, same-site inflight calls deduplicate, all-site refresh is bounded and failure-isolated, timezone is sent, and ratio changes do not cause network calls.
- [x] Add `rateContexts`, `refreshRateGroups`, `refreshAllRateGroups`, and `setRechargeRatio` using the strict contracts. Use a small fixed worker pool consistent with existing scheduling patterns.
- [x] Add strict IPC handlers and preload methods for contexts, one-site refresh, all-site refresh, and ratio updates.
- [x] Run adapter, contract, storage, and service integration tests until green.

### Task 4: Renderer data flow and overview UI

**Files:**

- Modify: `src/renderer/preview/types.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/shells/overview/OverviewPage.tsx`
- Modify: `src/renderer/shells/overview/OverviewPage.test.ts`
- Modify: `src/renderer/shells/overview/overview.css`

- [x] Write failing Renderer tests for ratio validation, cross-site recalculation, button event isolation, platform search/filter, tied minima, and loading/error/empty/retry copy.
- [x] Load persisted rate contexts independently from dashboard refresh, then background-refresh all sites. Keep requests isolated by site ID and generation.
- [x] Add the compact comparison band between metrics and site status, dynamic platform items, independent refresh, pending-ratio count, and tie rendering.
- [x] Add each card's bottom action row with recharge-ratio menu/custom editor and `查看倍率` button.
- [x] Add an anchored, one-at-a-time Popover with Escape/outside close, search, platform filters, minima summary, full list, cache timestamp, and retry.
- [x] Add locally scoped responsive styles without changing global theme or unrelated components.
- [x] Run overview unit tests and typecheck until green.

### Task 5: Electron E2E and documentation

**Files:**

- Modify: `tests/e2e/electron-smoke.spec.ts`
- Modify: `liran_docs/04-开发追踪.md`
- Modify: `liran_docs/06-数据字典.md`
- Modify: `liran_docs/07-API文档.md`
- Modify: `liran_docs/08-测试用例.md`
- Modify: `liran_docs/09-真机实测.md`
- Modify: `liran_docs/10-UI壳接入清单.md`
- Modify: `liran_docs/modules/07-API-Key与倍率/_API-Key与倍率.md`
- Modify: `liran_docs/modules/10-全站总览与汇总/_全站总览与汇总.md`
- Modify: `liran_docs/ui-shells/应用主框架与全站总览-UI壳接入清单.md`

- [x] Extend the local E2E server with multiple platforms, different raw rates, one failure, an unknown platform, and tied normalized values.
- [x] Assert cache-first rendering, independent rate refresh, ratio persistence, popover search/filter/close, event isolation, ties, and unchanged Key/full-refresh behavior.
- [x] Run build first, then E2E serially.
- [x] Update affected documentation with actual implementation and test evidence only.
- [x] Add a pitfall only if the implementation or real verification confirms a reusable issue.

### Task 6: Version, full verification, real-device QA, and release

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: release metadata documents discovered in the current tree

- [x] Change `1.2.1` to `1.3.0` after feature tests are green and synchronize release notes.
- [x] Run, in order: targeted tests, `npm run test`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run test:e2e`.
- [x] Use the three authorized real sites for read-only group verification without recording secrets or raw sensitive payloads.
- [x] Build the unsigned internal macOS ARM64 app and test the packaged app's ratio controls, popover, comparisons, errors, window sizing, and visual layout; save redacted evidence under `real-test-evidence/macos-1.3.0/`.
- [x] Run the real-test checklist validator before marking macOS real-device status complete.
- [x] Build current-version macOS ARM64 DMG and Windows x64 NSIS sequentially; inspect package structure and calculate SHA-256.
- [x] Do not delete old release artifacts without explicit current authorization and do not create sibling archive/work directories; report this release-directory cleanup gate separately if it remains.
- [x] Inspect the full final diff and perform a requirement-by-requirement completion audit before any completion claim.

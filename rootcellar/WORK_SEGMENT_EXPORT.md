# Root Cellar Work export — browser-test candidate

Status: PR #1 remains draft. Source and built userscript are intended for supervised browser testing, not a claim of live ChatGPT/Tampermonkey compatibility or completed archival. Do not merge on build success alone.

## Scope and identity

- This is a **derived projection of the backend `current_node` ancestry**, exclusive of the selected boundary. It is not a full raw conversation export or a complete execution trace.
- One synthetic message-less boundary preserves the parent link. Selected descendant nodes retain their message content and metadata; children lists are pruned. Ancestors and siblings are excluded.
- Unknown conversation-level fields are deliberately omitted: they may contain information from outside the interval. Source-window timestamps are not misrepresented as segment timestamps.
- Off-path tool/analysis nodes, alternate answers, edits and branches may therefore be absent. Keep a separate full raw export when complete provenance is required. Do not silently delete existing full sources after acquiring a segment.
- Attachments are pointers only, not archived binaries. Selected messages can themselves quote earlier conversation; this is graph trimming, not semantic redaction.
- `rootcellar-work-segment-v2` explicitly records derived status, synthetic boundary, unverified archive status and unarchived attachments.
- A random UUID creates each session identity. Re-export keeps that session ID and exports the entire interval again. Snapshot filenames include a timestamp; no incremental archive cursor advances.

## Naming

The policy owner is Root Cellar `SURFACE_DISCIPLINE.md` on `continuity/work-excursion-2026-09-17` (PR #4), not this implementation note.

Current origin label: `晞02`; numbering starts at `00`; continuations are `晞02-1` and `晞02-2`; legacy names remain unchanged. Work display labels use `W02｜目标` or `W02-1｜目标` as appropriate.

The export asks for a display label so it can match the window without mutating the platform title. Source title and IDs remain separate metadata. A title does not prove a parent relationship.

## Installation for a supervised test

1. Back up the installed exporter/settings using the userscript manager. Keep the Root Cellar read-only guard enabled and unchanged.
2. Disable (do not delete) the existing exporter to avoid duplicate menus. Import this PR's `dist/chatgpt.user.js` into Tampermonkey.
3. Confirm the separate name **ChatGPT Exporter — Root Cellar Test**, namespace `lena-rootcellar-exporter-test`, version `2.35.0-rootcellar.2`. It must not replace the previous script.
4. `@updateURL none` and `@downloadURL none` intentionally disable automatic updates during testing. Updates are manual. The build retains upstream CDN requirements; browser availability must be tested.
5. Reload the intended saved conversation. If Work has an unsupported URL or no exporter menu, stop and report the URL shape without sharing tokens. Do not weaken the guard or guess a different conversation.
6. Roll back by disabling the test script and re-enabling the previous exporter; reload. Preserve test-script marker storage if continuing later.

No automatic installation, title rename, conversation PATCH/DELETE, or raw-history upload is performed by the new Work actions. The original exporter has other actions; leave the guard enabled and use only the Work buttons for this test.

## Normal workflow

1. Wait until generation finishes. In the parent Chat choose **Mark Work Start**, enter the goal, and verify the boundary preview. That boundary message will NOT be included.
2. Confirm. The marker must persist in userscript-manager storage and read back successfully. Refresh before departure to test persistence.
3. Move to the Work branch; keep the origin Chat frozen.
4. Choose **Export Work Segment**. Select the intended marker explicitly even if only one candidate is listed; `0` starts manual recovery instead. A shared ancestor alone is not proof of session membership.
5. Enter the export label. Verify source window, start/end node previews, count and parent provenance. Cancel if wrong. Finish any ongoing response before downloading.
6. Confirm download and inspect the resulting JSON. “Download requested” does not prove disk persistence or Root Cellar archival.

After first confirmation the session is bound to the source Work conversation and first node. A previously requested export end must remain on the current path. Sibling, shortened or divergent paths require a separately recovered session; they never silently reuse the bound session ID.

An unbound marker's parent ID records **where it was marked**, not independently verified provider genealogy. Confirming the export is the user's association of the marker with the Work interval.

## First excursion: retroactive recovery

This excursion predates pre-departure marking. Choose **Export Work Segment**; select `0` if candidates appear.

- Goal: `根窖接线`
- Unique first Work user-message phrase: `其实你切work不做正式指令都行`
- Display label: `W02｜根窖接线`

Matching is limited to user nodes on the selected backend ancestry. Zero/multiple matches fail closed. A unique match still needs human preview confirmation: a quotation later in the conversation could otherwise be mistaken for the intended occurrence.

The matched message's parent is the exclusive boundary. `parent_conversation_id` stays null because a phrase does not establish the parent window ID. `marked_at` is the actual recovery-marker creation time, not the historical message time. v1 marker bytes are preserved but not silently migrated; recover explicitly into the separate v2 store.

## Persistence and failures

- Uses synchronous userscript-manager storage only, with read-back verification. No memory fallback and no silent eviction after 50 markers.
- Invalid JSON/schema/storage errors abort; do not overwrite corrupted storage as an empty list.
- Cancellation before final confirmation does not save a new marker or request a download.
- Actions on one page are serialised. The protocol still assumes a single active surface; simultaneous writes from multiple tabs are not supported or transactionally locked.
- Missing saved-conversation URL, temporary/shared pages, missing graph nodes, node-key mismatches, ancestry cycles and boundary message mismatch fail closed. No fallback to “most recent conversation”.
- The fetched backend path can differ from a selected UI regeneration; always inspect previews. A snapshot is of the fetch time, not every message arriving afterwards.

## Local verification

With the locked dependencies installed (repository specifies pnpm 8.14.1):

```sh
pnpm install --frozen-lockfile
npm run test
npm run test:work
./node_modules/.bin/eslint src tests vite.config.ts
npm run build
git diff --check
```

`npm run test` is upstream source typechecking. `test:work` bundles and executes synthetic graph, persistent-storage and mocked button-flow regressions; it is not a live browser test. No new dependencies are required. Full-repo lint may still report pre-existing guard-script style violations; do not silently modify that safety script to pass lint.

## Browser acceptance checklist — pending

- [ ] Isolated install, one exporter menu, guard still active, no upstream auto-update.
- [ ] Mark then refresh: marker survives; test normal parent-to-Work matching if a disposable test conversation is available.
- [ ] First-excursion phrase matches the intended first user message; boundary content and earlier mainline are absent, selected Work descendants remain.
- [ ] Final preview shows the actual backend path intended for export, including the expected latest reply.
- [ ] Cancel leaves marker/download state unchanged; ambiguous phrase fails without a download.
- [ ] Re-export retains session ID, produces another timestamped snapshot, and includes the full Work interval.
- [ ] Switching to a sibling/regenerated path cannot silently reuse a bound session.
- [ ] Inspect downloaded bytes, count, IDs and attachment pointers; record any omitted execution branches. Keep the raw source if complete evidence is needed.
- [ ] Rollback restores the original exporter.

## Root Cellar import and return boundary

The previous v1 bounded mapping was smoke-tested against parser v0.2. This revised v2 allowlisted projection has NOT yet been validated end-to-end against the actual Root Cellar importer. Do not inherit v1's pass as a v2 pass.

The importer has previously ignored custom top-level session metadata. Preserve the downloaded artifact and reconcile its exporter UUID with the existing Root Cellar session ID through an explicit relation/manifest mapping; do not overwrite either identity. Hash, verify coverage and register source locations before claiming archival. Synthetic boundary content must not be mistaken for an original empty message or deduplicated over the real parent message.

Build success, download request, local file verification, Root Cellar acquisition, conversational reintegration and Git merge are distinct events. This PR performs none of the latter events automatically.

Deferred: Mainline Delta, archive acknowledgement/cursors, Recent Ledger, automatic compaction, automatic reminders, title-only PATCH allowance, complete multi-branch archival and exporter/Root Cellar schema adapter.

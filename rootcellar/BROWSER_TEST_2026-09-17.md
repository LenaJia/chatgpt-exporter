# Browser test — first real Work-segment export

Date: 2026-09-17
PR head tested: `8dd34cbeb5925d32d8106215e8aad66566ea6632`
Test surface label: `W02｜根窖接线`
Status: supervised browser export succeeded; archival and Root Cellar import remain pending.

## Test procedure

- The previous exporter was disabled rather than deleted.
- The Root Cellar read-only guard remained enabled.
- The isolated test userscript `ChatGPT Exporter — Root Cellar Test` was installed.
- The first excursion had no pre-departure v2 marker, so retroactive recovery used the unique first-user-message phrase:
  `其实你切work不做正式指令都行`
- Goal: `根窖接线`
- Display label: `W02｜根窖接线`

## Acquired test artifact

The user downloaded and attached a test artifact inside the Work conversation for inspection. It is evidence of the browser test, not the final post-closure transcript archive.

- Browser filename: `W02｜根窖接线_ws-e38bd2cd-3e29-440d-a279-81306c487029_20260917135659087.json`
- Bytes: `4,818,391`
- SHA-256: `b4c81bb5110d7146f46cb77c80b47293dd07b949a34476e03b6cd4d555839269`
- Exporter session ID: `ws-e38bd2cd-3e29-440d-a279-81306c487029`
- Source conversation ID: `6aabc6bc-4c1c-83ed-8c09-dbb5daf60817`
- Marker basis: `retroactive_user_match`
- Parent conversation ID: `null` (correctly left unverified)
- Boundary node: `ff020857-608f-412a-be5c-1c0b689be142`
- First included node: `dda78b5f-7564-4ec0-b37a-fa579f8323ec`
- Last included node: `c17ac29e-011e-5f7a-9bbe-11de0cbd092d`
- Selected segment nodes: `700`
- Exported mapping nodes including synthetic boundary: `701`
- Full source mapping nodes reported: `3,267`
- Current source ancestry nodes reported: `3,262`
- Earlier ancestry excluded: `2,561`
- Off-path nodes excluded: `5`

## Verification result

The JSON parsed successfully. The mapping formed one linear selected ancestry rooted at the synthetic boundary. Checks found:

- no missing parent;
- no ancestry cycle;
- no node-key/id mismatch;
- no nodes outside the selected path;
- no duplicate message IDs;
- metadata start/end/counts matched the mapping;
- the unique recovery phrase occurred in exactly one selected user node;
- the first included user message was the intended Work-entry instruction;
- the final included content was the browser-test instruction immediately before the download.

The 4.59 MB size is explained primarily by Work/Codex execution data rather than leaked pre-Work ancestry. Two execution-related nodes contributed about 2.19 MB; selected tool/assistant nodes contain code, execution output and large aggregate metadata.

## Known source gap

One user occurrence, `刚才不小心按了停止`, was absent from the artifact. The user independently observed that this occurrence had also disappeared from the live conversation UI, while assistant replies responding to it remained present.

Current conclusion:

- do not attribute this gap to segment trimming without evidence;
- do not reconstruct the missing user text inside the exported JSON;
- record it as a known provider/source gap supported by user observation;
- exact cause (failed persistence, path replacement, UI/backend behaviour, or another mechanism) remains unknown.

## Acceptance and remaining work

The first real browser export validates isolated installation, menu availability, retroactive phrase recovery, preview/confirmation, download request and bounded current-path output.

Still pending:

- re-export after the Work closing response so the final artifact includes closure;
- user upload to private Google Drive storage;
- hash and storage-locator verification for that final artifact;
- source registry entry and explicit relation to Root Cellar session `work-excursion-2026-09-17-01`;
- parser v2/registry round-trip;
- conversational reintegration in `晞02`.

The PR remains draft and must not be merged based on this test alone.

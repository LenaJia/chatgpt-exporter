# Root Cellar Work-segment export

This fork adds a bounded export path for serial Chat ↔ Work excursions.

## Identity and naming

A ChatGPT window title is a human navigation aid, not a source-of-truth identifier.

Recommended title format:

```text
<surface>｜<goal>
```

Examples:

- `主干｜后院`
- `Work｜根窖连续性交接`
- `Work｜交易账本`

Keep dates, lifecycle state, and provenance out of the title. The export records those in machine-readable metadata.

Each marked session receives a stable `session_id`. Re-exporting later keeps that ID while updating `exported_at` and `end_node_id`.

## Normal workflow

1. In the parent Chat, open the exporter and choose **Mark Work Start**.
2. Enter a short goal. The marker records the current node as the exclusive boundary.
3. Switch to the Work branch and keep the parent Chat frozen.
4. When the Work excursion reaches a return gate, choose **Export Work Segment**.
5. Archive the resulting JSON with the Work-session manifest and handoff.

The exported mapping contains:

- one message-less boundary node carrying the original boundary node ID;
- only nodes after that boundary on the selected `current_node` ancestry;
- no earlier parent messages;
- no sibling branches;
- `rootcellar_work_segment` metadata with session, source, boundary, start, and end identifiers.

## Retroactive recovery

If no compatible marker exists, **Export Work Segment** asks for:

1. the Work goal; and
2. a unique phrase from the first user message in the Work session.

The exporter locates that user node on the current ancestry and uses its parent as the boundary. Ambiguous or missing matches fail closed.

## Read-only guard interaction

The current Root Cellar guard blocks conversation `PATCH` and `DELETE` requests. ChatGPT title renaming may use `PATCH`, so manual or automatic renaming can be blocked while the guard is active.

Do not weaken the guard implicitly. A future change may allow only a verified title-only PATCH after the exact request shape is captured and reviewed. Until then, the goal entered in **Mark Work Start** is the authoritative human-readable session label.

## Import boundary

Root Cellar parser v0.2 accepts the bounded mapping and projects the boundary plus segment nodes without graph issues. It currently ignores the custom `rootcellar_work_segment` top-level metadata. The raw export and Work-session manifest therefore remain authoritative for session provenance until a separately reviewed canonical-schema adapter exists.

# ADR-0024: Adopt Tiptap for the editorial content pipeline

## Status

Accepted

## Date

2026-08-03

## Context

The schema imposes two requirements that rule out most editors.

`post_revisions.content_json` stores structured editor JSON, not HTML
(ADR-0002). And block identifiers must be **stable**: `post_revision_media` keys
inline image placements by `block_id`, and `toc_json` anchors are derived from
the same IDs specifically so that rewording a heading does not break deep links
(ADR-0012). An editor whose node identities are regenerated on every load, or
which only emits HTML, cannot satisfy either.

There is also a constraint from ADR-0020: no component may pull in `@radix-ui/*`,
because a second primitive library means two implementations of focus, keyboard,
and ARIA behavior in one project.

## Decision

Adopt **Tiptap**, headless, on ProseMirror.

Alternatives evaluated on 2026-08-03:

| Option        | Outcome                                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plate**     | Rejected. The best shadcn integration — it ships components through its own registry — but it is built on Radix, so adopting it would require amending ADR-0020 and accepting two primitive systems |
| **BlockNote** | Rejected. Stable block IDs out of the box and JSON output, but it ships its own UI layer and imposes its block model                                                                                |
| **Tiptap**    | **Adopted.** Headless, so it contributes no UI primitives at all and does not touch ADR-0020. The toolbar is built from the Base UI components already in the project                               |

Tiptap is the most work of the three, because the editing surface has to be
built rather than installed. That cost buys a single primitive system and full
control over how the document maps to the schema.

### Pipeline

**Stable identity.** `@tiptap/extension-unique-id` assigns IDs that persist
across splitting, merging, and undo. Those IDs _are_
`post_revision_media.block_id`, and the `toc_json` anchors derive from them.

**Inline images.** A custom image node stores `mediaAssetId` on the node. On
save, the `content_json` is walked, image nodes are collected, and
`post_revision_media` rows are upserted with their `block_id`, `position`, and
`media_asset_id`. That walk is the bridge between the editor document and the
relational schema, and it is the only place the two representations must agree.

**Upload.** The editor posts to an admin endpoint that writes through the R2
binding (`env.BUCKET.put()`). Streaming a request body to R2 is I/O rather than
compute, so it barely touches the CPU budget. The same endpoint creates the
`media_assets` row and returns its `id` in one response — one round trip, and no
window in which an uploaded object exists without its row. Clipboard paste and
drag-and-drop both resolve to this handler.

What arrives at that handler — resizing, format conversion, type validation, and
the `r2_key` convention — is settled by
[ADR-0028](0028-normalize-and-validate-media-uploads-before-storage.md).

**Validation.** A **Zod schema for `content_json`** is the contract between its
three producers and consumers: the editor produces it, the seed script of
ADR-0017 also produces it, and `ArticleBody` consumes it when rendering. Without
a shared contract the seed script and the editor drift apart silently, and the
failure surfaces as a broken article rather than an error. The module that
derives `reading_time_minutes` and `toc_json` reads through the same schema.

**Syntax highlighting.** Code is highlighted **at publish time**, and the result
is stored inside the code node of `content_json`. Never at render time. This is
the same argument that already justified `reading_time_minutes` and `toc_json`: a
revision is immutable, so a derived value cannot drift from it, and the Worker
cannot spend its budget running a highlighter on every uncached request.

## Consequences

### Positive

- One primitive system survives; ADR-0020 needs no exception.
- Block identity is stable by construction, so inline media placements and TOC
  anchors survive editing.
- Uploads cost one round trip and cannot orphan an R2 object.
- The Zod contract makes the seed script and the editor provably
  interchangeable producers.
- Highlighting, reading time, and the TOC are all computed once at publish, which
  keeps the render path uniform.

### Negative

- The entire editing surface — toolbar, menus, image placement UI — must be
  built, since Tiptap supplies no components.
- The `content_json` walk that syncs `post_revision_media` is bespoke logic with
  no framework support, and a bug there desynchronizes placements from the
  document.
- Storing highlighted output inside `content_json` enlarges revisions, and
  changing the highlighting theme requires reprocessing published revisions.
- ProseMirror's document model is a real thing to learn before custom nodes can
  be written confidently.

## Related Decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0006](0006-model-editorial-media-and-social-preview-images.md)
- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md)
- [ADR-0017](0017-bootstrap-content-with-seed-script.md)
- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md)

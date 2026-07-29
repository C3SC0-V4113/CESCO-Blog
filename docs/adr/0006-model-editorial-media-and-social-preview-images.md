# ADR-0006: Model editorial media and social preview images

## Status

Accepted

## Context

Cesco Blog stores posts as versioned editor JSON in D1 and media objects in R2.
The database foundation needs to support three related but distinct media uses:

- reusable media asset records with accessibility and attribution metadata;
- inline rich-text image placements tied to a specific post revision block;
- Open Graph/social preview image metadata that can differ from standard SEO
  title and description fields.

This slice only models the data foundation. It does not implement upload UI,
admin editor UI, rendering, SEO components, or route behavior.

## Decision

Extend the D1/Drizzle schema with:

- additional attribution fields on `media_assets`, keeping `alt_text` as the
  canonical asset-level accessibility and SEO alt text;
- a `post_revision_media` join table from `post_revisions` to `media_assets`
  that records editor block ID, position, and per-placement alt text, caption,
  and credit override;
- Open Graph/social preview fields on `post_revisions`, including a nullable
  `og_image_media_id` reference to `media_assets`.

Inline media rows cascade when their revision or media asset is deleted. Social
preview image references are set to null when the referenced asset is deleted.

## Consequences

### Positive

- Keeps reusable asset metadata separate from per-revision placement metadata.
- Allows the same asset to be reused across posts while preserving block-level
  captions, alt text, and credit overrides.
- Lets editorial teams tune social previews independently from base SEO fields.
- Keeps future rendering and admin UI work grounded in explicit relationships.

### Negative

- Application code must keep editor block IDs stable within a revision.
- Rendering code must choose between placement overrides and asset defaults.
- Social preview selection now has a nullable relationship to handle.

## Related decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0005](0005-use-drizzle-for-d1-schema-and-migrations.md)

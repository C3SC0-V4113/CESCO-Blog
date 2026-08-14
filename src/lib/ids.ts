/**
 * Identifier generation (ADR-0026).
 *
 * `crypto.randomUUID()` is native in Workers, in Node for the seed script, and
 * in the browser for the admin, so no dependency is needed. Ordering never
 * relies on identifiers: listings order by `first_published_at` and revisions by
 * `version`.
 *
 * These wrappers exist so the strategy lives in one file rather than at every
 * insert site. Some identifiers are permanent public contracts — a post
 * localization ID is the RSS `guid` (ADR-0014) — so they must never be
 * regenerated for an existing row.
 */

function newId(): string {
  return crypto.randomUUID();
}

export const newPostId = newId;
export const newPostLocalizationId = newId;
export const newPostRevisionId = newId;
export const newAuthorId = newId;
export const newSlugHistoryId = newId;
export const newMediaAssetId = newId;

// Wrappers for the remaining entities — games, tags, platforms,
// genres, collections — are added when their first insert site exists. An
// exported name with no caller is maintenance surface, not preparation.

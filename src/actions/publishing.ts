import { eq } from 'drizzle-orm';

import { drainPendingPurges, recordPendingPurge } from '@/actions/pending-purges';
import { schema, type Db } from '@/db/client';
import { findPublicationMedia, loadPublicationSource } from '@/db/queries/admin-review';
import { deriveReadingTime, deriveToc } from '@/lib/content/derive';
import { safeExternalUrl } from '@/lib/media';
import {
  collectPublicationMedia,
  preparePublishedContent,
  publicationTags,
  publishSchema,
  renameLocalizationSchema,
  unpublishSchema,
  type PublishInput,
  type RenameLocalizationInput,
  type UnpublishInput,
} from '@/lib/publishing';
import { toDbTimestamp } from '@/lib/timestamps';

export type PurgeTags = (tags: string[]) => Promise<void>;
type PublicationOutcome = {
  status: 'published' | 'published-with-cache-warning';
  revisionId: string;
};

export function publicationErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (['draft-conflict', 'publish-conflict', 'slug-reserved'].includes(message))
    return 'CONFLICT' as const;
  if (message === 'localization-not-found') return 'NOT_FOUND' as const;
  if (
    [
      'post-inactive',
      'title-required',
      'cover-required',
      'media-missing',
      'media-url-invalid',
      'duplicate-block-id',
      'too-many-media',
      'too-many-highlight-languages',
      'redirect-acknowledgement-required',
    ].includes(message)
  )
    return 'BAD_REQUEST' as const;
  return null;
}

function isUniqueViolation(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  return /UNIQUE constraint failed/.test(`${String(error)} ${String(cause ?? '')}`);
}

async function purgePublication(
  db: Db,
  purge: PurgeTags,
  revisionId: string
): Promise<PublicationOutcome> {
  return (await drainPendingPurges(db, purge))
    ? { status: 'published', revisionId }
    : { status: 'published-with-cache-warning', revisionId };
}

export async function publishLocalization(
  db: Db,
  raw: PublishInput,
  purge: PurgeTags,
  date: Date = new Date()
): Promise<PublicationOutcome> {
  const input = publishSchema.parse(raw);
  const source = await loadPublicationSource(db, input.postId, input.localizationId);
  if (!source) throw Error('localization-not-found');
  const tags = publicationTags(source.postId, source.section, source.locale);
  const [existing] = await db
    .select({ localizationId: schema.postRevisions.postLocalizationId })
    .from(schema.postRevisions)
    .where(eq(schema.postRevisions.id, input.operationId));
  if (existing) {
    if (
      existing.localizationId !== input.localizationId ||
      source.publishedRevisionId !== input.operationId
    )
      throw Error('publish-conflict');
    // The original attempt recorded its tags with the commit, so a replay only
    // has to settle whatever is still owed.
    return purgePublication(db, purge, input.operationId);
  }
  if (source.editorialState !== 'active') throw Error('post-inactive');
  if (source.draftToken !== input.draftToken) throw Error('draft-conflict');
  if (!source.title?.trim()) throw Error('title-required');
  if (!source.coverMediaId || !source.coverAssetId) throw Error('cover-required');
  const content = await preparePublishedContent(source.contentJson);
  const placements = collectPublicationMedia(content);
  const mediaIds = [...new Set(placements.map((item) => item.mediaAssetId))];
  const media = await findPublicationMedia(db, mediaIds);
  if (media.length !== mediaIds.length) throw Error('media-missing');
  if (
    media.some(
      (asset) =>
        (asset.sourceUrl && !safeExternalUrl(asset.sourceUrl)) ||
        (asset.licenseUrl && !safeExternalUrl(asset.licenseUrl))
    )
  )
    throw Error('media-url-invalid');
  const assets = new Map(media.map((asset) => [asset.id, asset]));
  const placementSnapshots = placements.map((placement) => {
    const asset = assets.get(placement.mediaAssetId)!;
    return {
      ...placement,
      r2Key: asset.r2Key,
      width: asset.width,
      height: asset.height,
      caption: asset.caption,
      creatorName: asset.creatorName,
      sourceUrl: asset.sourceUrl,
      licenseLabel: asset.licenseLabel,
      licenseUrl: asset.licenseUrl,
    };
  });
  const timestamp = toDbTimestamp(date);
  const insertRevision = `INSERT INTO post_revisions (id, post_localization_id, version, title, excerpt, content_json, seo_title, seo_description, canonical_url, og_title, og_description, og_image_media_id, og_image_alt, reading_time_minutes, toc_json, created_at)
SELECT ?, l.id, (SELECT COALESCE(MAX(version), 0) + 1 FROM post_revisions WHERE post_localization_id = l.id), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
FROM post_localizations l JOIN posts p ON p.id = l.post_id JOIN post_drafts d ON d.post_localization_id = l.id
WHERE l.id = ? AND l.post_id = ? AND p.editorial_state = 'active' AND p.cover_media_id IS NOT NULL
AND EXISTS (SELECT 1 FROM media_assets WHERE id = p.cover_media_id) AND d.draft_token = ? AND l.published_revision_id IS ?`;
  const statements = [
    db.$client
      .prepare(insertRevision)
      .bind(
        input.operationId,
        source.title,
        source.excerpt,
        JSON.stringify(content),
        source.seoTitle,
        source.seoDescription,
        source.canonicalUrl,
        source.ogTitle,
        source.ogDescription,
        source.ogImageMediaId,
        source.ogImageAlt,
        deriveReadingTime(content),
        JSON.stringify(deriveToc(content)),
        timestamp,
        input.localizationId,
        input.postId,
        input.draftToken,
        source.publishedRevisionId
      ),
    db.$client
      .prepare(
        `INSERT INTO post_revision_media (revision_id, media_asset_id, block_id, position, alt_text, caption, credit_override, asset_r2_key, asset_width, asset_height, asset_caption, asset_creator_name, asset_source_url, asset_license_label, asset_license_url)
SELECT ?, json_extract(value, '$.mediaAssetId'), json_extract(value, '$.blockId'), json_extract(value, '$.position'), json_extract(value, '$.altText'), NULL, NULL, json_extract(value, '$.r2Key'), json_extract(value, '$.width'), json_extract(value, '$.height'), json_extract(value, '$.caption'), json_extract(value, '$.creatorName'), json_extract(value, '$.sourceUrl'), json_extract(value, '$.licenseLabel'), json_extract(value, '$.licenseUrl')
FROM json_each(?) WHERE EXISTS (SELECT 1 FROM post_revisions WHERE id = ?)`
      )
      .bind(input.operationId, JSON.stringify(placementSnapshots), input.operationId),
    db.$client
      .prepare(
        `UPDATE post_localizations SET status = 'published', published_revision_id = ?, first_published_at = COALESCE(first_published_at, ?), current_published_at = ?, updated_at = ?
WHERE id = ? AND post_id = ? AND published_revision_id IS ? AND EXISTS (SELECT 1 FROM post_revisions WHERE id = ?)`
      )
      .bind(
        input.operationId,
        timestamp,
        timestamp,
        timestamp,
        input.localizationId,
        input.postId,
        source.publishedRevisionId,
        input.operationId
      ),
    recordPendingPurge(
      db,
      tags,
      source.publishedRevisionId ? 'republish' : 'publish',
      'EXISTS (SELECT 1 FROM post_localizations WHERE id = ? AND published_revision_id = ?)',
      input.localizationId,
      input.operationId
    ),
  ];
  let results: D1Result[];
  try {
    results = await db.$client.batch(statements);
  } catch (error) {
    // A replay of this operation that committed between our read and our write
    // collides on the revision's keys. The batch rolled back as a unit, so this
    // is the same lost race as the checks below, not a server fault.
    if (isUniqueViolation(error)) throw Error('publish-conflict');
    throw error;
  }
  if (results[0]!.meta.changes !== 1 || results[2]!.meta.changes !== 1)
    throw Error('publish-conflict');
  return purgePublication(db, purge, input.operationId);
}

export async function unpublishLocalization(db: Db, raw: UnpublishInput, purge: PurgeTags) {
  const input = unpublishSchema.parse(raw);
  const source = await loadPublicationSource(db, input.postId, input.localizationId);
  if (!source) throw Error('localization-not-found');
  // Conditional, so withdrawing something that is not public — never
  // published, withdrawn by another tab, or republished since the reviewer
  // looked — changes nothing and owes no purge.
  const expected = input.publishedRevisionId ?? null;
  const [withdrawn] = await db.$client.batch([
    db.$client
      .prepare(
        `UPDATE post_localizations SET status = 'draft', published_revision_id = NULL, updated_at = ?
WHERE id = ? AND post_id = ? AND published_revision_id IS NOT NULL AND (? IS NULL OR published_revision_id = ?)`
      )
      .bind(toDbTimestamp(), input.localizationId, input.postId, expected, expected),
    recordPendingPurge(
      db,
      publicationTags(source.postId, source.section, source.locale),
      'unpublish',
      'changes() = 1'
    ),
  ]);
  if (withdrawn.meta.changes !== 1) return { status: 'unchanged' as const };
  return (await drainPendingPurges(db, purge))
    ? { status: 'unpublished' as const }
    : { status: 'unpublished-with-cache-warning' as const };
}

export async function renameLocalizationSlug(
  db: Db,
  raw: RenameLocalizationInput,
  purge: PurgeTags
) {
  const input = renameLocalizationSchema.parse(raw);
  const source = await loadPublicationSource(db, input.postId, input.localizationId);
  if (!source) throw Error('localization-not-found');
  if (source.firstPublishedAt && !input.acknowledgePermanentRedirect)
    throw Error('redirect-acknowledgement-required');
  if (source.slug === input.slug) return { status: 'unchanged' as const };
  const update = db.$client
    .prepare(
      `UPDATE post_localizations SET slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND post_id = ? AND slug = ?
AND NOT EXISTS (SELECT 1 FROM post_localizations WHERE locale = ? AND slug = ? AND id <> ?)
AND NOT EXISTS (SELECT 1 FROM post_localization_slug_history WHERE locale = ? AND old_slug = ?)
AND (first_published_at IS NULL OR ? = 1)`
    )
    .bind(
      input.slug,
      input.localizationId,
      input.postId,
      source.slug,
      source.locale,
      input.slug,
      input.localizationId,
      source.locale,
      input.slug,
      input.acknowledgePermanentRedirect ? 1 : 0
    );
  const statements = [
    update,
    db.$client
      .prepare(
        `INSERT INTO post_localization_slug_history (id, post_localization_id, locale, old_slug)
SELECT ?, l.id, l.locale, ? FROM post_localizations l
WHERE l.id = ? AND l.post_id = ? AND l.first_published_at IS NOT NULL AND changes() = 1`
      )
      .bind(crypto.randomUUID(), source.slug, input.localizationId, input.postId),
    // Keyed on the resulting slug because `changes()` now describes the history
    // insert. A concurrent rename to the same slug can record twice, which only
    // repeats an idempotent purge.
    recordPendingPurge(
      db,
      publicationTags(source.postId, source.section, source.locale),
      'rename',
      'EXISTS (SELECT 1 FROM post_localizations WHERE id = ? AND slug = ?)',
      input.localizationId,
      input.slug
    ),
  ];
  const [updated] = await db.$client.batch(statements);
  if (updated.meta.changes !== 1) {
    const current = await loadPublicationSource(db, input.postId, input.localizationId);
    if (current?.firstPublishedAt && !input.acknowledgePermanentRedirect)
      throw Error('redirect-acknowledgement-required');
    throw Error('slug-reserved');
  }
  return (await drainPendingPurges(db, purge))
    ? { status: 'renamed' as const, slug: input.slug }
    : { status: 'renamed-with-cache-warning' as const, slug: input.slug };
}

import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb, schema } from '@/db/client';
import { resolveArticleUrl } from '@/db/queries/posts';
import { safeExternalUrl } from '@/lib/media';

const testEnv = env as typeof env & {
  MIGRATION_DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

describe('migration 0011', () => {
  it('backfills immutable placement data and prevents its asset from being deleted', async () => {
    const index = testEnv.TEST_MIGRATIONS.findIndex(({ name }) => name.startsWith('0011_'));
    expect(index).toBe(11);
    await applyD1Migrations(testEnv.MIGRATION_DB, testEnv.TEST_MIGRATIONS.slice(0, index));

    await testEnv.MIGRATION_DB.batch([
      testEnv.MIGRATION_DB.prepare(
        `INSERT INTO media_assets (id,r2_key,content_type,width,height,caption,creator_name,source_url,license_url)
         VALUES ('asset','media/2026/08/asset.webp','image/webp',800,600,'Legacy caption','Legacy creator','javascript:alert(1)','data:text/html,unsafe')`
      ),
      testEnv.MIGRATION_DB.prepare(
        `INSERT INTO posts (id,section,editorial_state) VALUES ('post','analysis','active')`
      ),
      testEnv.MIGRATION_DB.prepare(
        `INSERT INTO post_localizations (id,post_id,locale,slug,status,first_published_at,current_published_at,published_revision_id)
         VALUES ('localization','post','es','legacy-placement','published','2026-08-01 00:00:00','2026-08-01 00:00:00','revision')`
      ),
      testEnv.MIGRATION_DB.prepare(
        `INSERT INTO post_revisions (id,post_localization_id,version,title,content_json)
         VALUES ('revision','localization',1,'Legacy','{"type":"doc","content":[{"type":"image","attrs":{"blockId":"block","mediaAssetId":"asset","alt":"Legacy"}}]}')`
      ),
      testEnv.MIGRATION_DB.prepare(
        `INSERT INTO post_revision_media (revision_id,media_asset_id,block_id,position,alt_text)
         VALUES ('revision','asset','block',0,'Legacy')`
      ),
    ]);

    await applyD1Migrations(testEnv.MIGRATION_DB, [testEnv.TEST_MIGRATIONS[index]!]);
    const db = createDb(testEnv.MIGRATION_DB);
    const [placement] = await db.select().from(schema.postRevisionMedia);
    expect(placement).toMatchObject({
      assetR2Key: 'media/2026/08/asset.webp',
      assetCaption: 'Legacy caption',
      assetCreatorName: 'Legacy creator',
      assetSourceUrl: 'javascript:alert(1)',
      assetLicenseUrl: 'data:text/html,unsafe',
    });
    expect(safeExternalUrl(placement!.assetSourceUrl)).toBeNull();
    expect(safeExternalUrl(placement!.assetLicenseUrl)).toBeNull();
    await expect(
      testEnv.MIGRATION_DB.prepare("DELETE FROM media_assets WHERE id='asset'").run()
    ).rejects.toThrow();
    await expect(
      resolveArticleUrl(db, { locale: 'es', section: 'analysis', slug: 'legacy-placement' })
    ).resolves.toMatchObject({ kind: 'render' });
  });
});

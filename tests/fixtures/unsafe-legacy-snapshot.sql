-- Test-only fixture, applied by `pnpm run e2e:serve` after the seed and never
-- by `db:seed`, so unsafe URLs stay out of the public demo content.
--
-- Snapshots written before action-side URL validation can hold any scheme
-- (ADR-0037), so the public renderer has to refuse them on its own. This gives
-- the demo article's example image one such snapshot. The caption marks the row
-- as the fixture's, so the e2e test fails if the fixture was not applied rather
-- than passing on a snapshot with nothing unsafe in it.
UPDATE post_revision_media
SET asset_caption = 'Captura heredada con enlaces inseguros',
    asset_source_url = 'javascript:alert(1)',
    asset_license_url = 'data:text/html,unsafe'
WHERE revision_id = '7a1b2c3d-4e5f-4081-9a2b-3c4d5e6f7a8b'
  AND block_id = 'a1b2c3d4-e5f6-4071-8a1b-2c3d4e5f6a74';

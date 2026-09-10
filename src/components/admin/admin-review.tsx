import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import {
  callPublish,
  callRenameLocalization,
  callRetryPendingPurges,
  callUnpublish,
} from '@/lib/admin-actions';
import { mediaPath } from '@/lib/media';
import { isRenameLocalizationRejection } from '@/lib/publishing';

import type { ReviewDetail, ReviewQueueItem } from '@/db/queries/admin-review';

const t = getTranslations('es');
type Props = {
  items: ReviewQueueItem[];
  detail: ReviewDetail | null;
  page: number;
  pageSize: number;
  total: number;
  pendingPurges: number;
};
type State = 'idle' | 'pending' | 'error' | 'acknowledgement-error';

// Every outcome reloads, including one whose purge failed: the change recorded
// its tags when it committed (ADR-0037), so the server renders the pending
// notice and its retry for whoever opens the page next, not just this tab.
const reload = () => window.location.reload();

function PendingPurgesNotice() {
  const [state, setState] = useState<'idle' | 'pending' | 'error'>('idle');
  const retry = async () => {
    setState('pending');
    try {
      const { data, error } = await callRetryPendingPurges();
      if (error || data?.status !== 'purged') throw error ?? Error('purge-still-pending');
      reload();
    } catch {
      setState('error');
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
      <p>{t('admin.review.pendingPurges')}</p>
      <Button
        type="button"
        variant="outline"
        disabled={state === 'pending'}
        onClick={() => void retry()}
      >
        {t('admin.review.retryPurge')}
      </Button>
      {state === 'error' && (
        <p role="alert" className="basis-full">
          {t('admin.review.pendingPurgesError')}
        </p>
      )}
    </div>
  );
}

function ReviewPreview({ detail }: { detail: ReviewDetail }) {
  const assets = new Map(detail.referencedMedia.map((asset) => [asset.id, asset]));
  return (
    <section
      aria-label={t('admin.review.preview')}
      className="grid gap-4 rounded-lg border bg-muted/20 p-4"
      key={detail.draftToken ?? 'missing-draft'}
    >
      {detail.contentJson.content.map((block) => {
        const text = 'content' in block ? block.content.map((node) => node.text).join('') : '';
        if (block.type === 'paragraph') return <p key={block.attrs.blockId}>{text}</p>;
        if (block.type === 'heading') {
          const Heading = `h${block.attrs.level}` as 'h2';
          return (
            <Heading key={block.attrs.blockId} className="text-lg font-semibold">
              {text}
            </Heading>
          );
        }
        if (block.type === 'codeBlock')
          return (
            <pre
              key={block.attrs.blockId}
              className="overflow-x-auto rounded-md bg-foreground p-3 text-background"
            >
              <code>{text}</code>
            </pre>
          );
        const asset = assets.get(block.attrs.mediaAssetId);
        return asset ? (
          <figure key={block.attrs.blockId}>
            <img
              src={mediaPath(asset.r2Key)}
              width={asset.width ?? undefined}
              height={asset.height ?? undefined}
              alt={block.attrs.alt}
              className="h-auto max-h-[32rem] w-full rounded-md object-contain"
            />
          </figure>
        ) : (
          <p key={block.attrs.blockId} role="status">
            {t('admin.media.unavailable')}
          </p>
        );
      })}
    </section>
  );
}

function reviewUrl(page: number, selection?: ReviewDetail | ReviewQueueItem | null) {
  const params = new URLSearchParams({ page: String(page) });
  if (selection) {
    params.set('post', selection.postId);
    params.set('localization', selection.localizationId);
  }
  return `/admin/review?${params}`;
}

export function AdminReview({ items, detail, page, pageSize, total, pendingPurges }: Props) {
  const [state, setState] = useState<State>('idle');
  const [renameConfirmed, setRenameConfirmed] = useState(false);
  const operationId = useRef<string | null>(null);
  const mutation = detail ? { postId: detail.postId, localizationId: detail.localizationId } : null;
  const run = async (work: () => Promise<{ error?: unknown; data?: unknown }>) => {
    setState('pending');
    try {
      const result = await work();
      if (result.error) throw result.error;
      return result.data;
    } catch {
      setState('error');
      return null;
    }
  };
  const publish = async () => {
    if (!detail?.draftToken) return;
    // Kept across a failed call, so retrying after a lost response replays the
    // same revision instead of publishing a second one.
    operationId.current ??= crypto.randomUUID();
    const data = await run(() =>
      callPublish({
        ...mutation!,
        draftToken: detail.draftToken!,
        operationId: operationId.current!,
      })
    );
    if (data) {
      operationId.current = null;
      reload();
    }
  };
  const blocked = !detail?.draftToken || !detail.title?.trim() || !detail.coverAssetId;
  const everPublished = Boolean(detail?.firstPublishedAt);
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="grid gap-6">
      {pendingPurges > 0 && <PendingPurgesNotice />}
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <section
          aria-label={t('admin.review.queue')}
          className="order-last max-h-[70vh] overflow-auto rounded-xl border bg-background p-4 lg:order-first"
        >
          {items.length ? (
            <ul className="grid gap-2">
              {items.map((item) => (
                <li key={item.localizationId}>
                  <a
                    className="block rounded-lg border p-3"
                    aria-current={
                      detail?.localizationId === item.localizationId ? 'page' : undefined
                    }
                    href={reviewUrl(page, item)}
                  >
                    <strong className="block truncate">{item.title}</strong>
                    <span className="text-sm text-muted-foreground">
                      {item.locale.toUpperCase()} · {t(`admin.posts.locale.${item.status}`)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('admin.review.empty')}</p>
          )}
          {total > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('admin.review.showing')} {firstItem}–{lastItem} {t('admin.review.of')} {total}
            </p>
          )}
          {total > pageSize && (
            <nav aria-label={t('listing.pagination')} className="mt-3 flex justify-between gap-2">
              {page > 1 ? (
                <a href={reviewUrl(page - 1, detail)}>{t('listing.previous')}</a>
              ) : (
                <span />
              )}
              {lastItem < total && <a href={reviewUrl(page + 1, detail)}>{t('listing.next')}</a>}
            </nav>
          )}
        </section>
        <section
          aria-label={t('admin.review.detail')}
          className="order-first rounded-xl border bg-background p-4 lg:order-last"
        >
          {!detail ? (
            <p>{t('admin.review.select')}</p>
          ) : (
            <form className="grid gap-4">
              <div>
                <h2 className="text-xl font-semibold">{detail.title || detail.slug}</h2>
                <p className="text-sm text-muted-foreground">
                  {detail.locale.toUpperCase()} · {t(`admin.posts.locale.${detail.status}`)}
                </p>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt>{t('admin.review.cover')}</dt>
                  <dd>{t(detail.coverAssetId ? 'admin.review.ready' : 'admin.review.missing')}</dd>
                </div>
                <div>
                  <dt>{t('admin.review.blocks')}</dt>
                  <dd>{detail.contentJson.content.length}</dd>
                </div>
                <div>
                  <dt>{t('admin.review.media')}</dt>
                  <dd>{detail.referencedMedia.length}</dd>
                </div>
                <div>
                  <dt>{t('admin.review.draft')}</dt>
                  <dd>{detail.draftToken ? t('admin.review.ready') : t('admin.review.missing')}</dd>
                </div>
              </dl>
              <ReviewPreview detail={detail} />
              <label>
                {t('admin.posts.slug')}
                <input
                  name="slug"
                  defaultValue={detail.slug}
                  onChange={(event) => {
                    if (event.target.value === detail.slug) setRenameConfirmed(false);
                  }}
                  className="mt-1 h-10 w-full rounded-lg border px-3"
                />
              </label>
              {everPublished && (
                <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-foreground">
                  <p>{t('admin.review.renameWarning')}</p>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      autoComplete="off"
                      checked={renameConfirmed}
                      onChange={(event) => setRenameConfirmed(event.target.checked)}
                    />
                    {t('admin.review.renameConfirm')}
                  </label>
                </div>
              )}
              {blocked && <p role="alert">{t('admin.review.blocked')}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={blocked || state === 'pending'}
                  onClick={() => void publish()}
                >
                  {t(
                    detail.status === 'published'
                      ? 'admin.review.republish'
                      : 'admin.review.publish'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={detail.status !== 'published' || state === 'pending'}
                  onClick={() =>
                    void run(() =>
                      callUnpublish({
                        ...mutation!,
                        publishedRevisionId: detail.publishedRevisionId ?? undefined,
                      })
                    ).then((data) => {
                      if (data) reload();
                    })
                  }
                >
                  {t('admin.review.unpublish')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={state === 'pending' || (everPublished && !renameConfirmed)}
                  onClick={(event) => {
                    const slug = new FormData(event.currentTarget.form!).get('slug');
                    void run(() =>
                      callRenameLocalization({
                        ...mutation!,
                        slug: String(slug),
                        acknowledgePermanentRedirect: renameConfirmed,
                      })
                    ).then((data) => {
                      if (isRenameLocalizationRejection(data)) {
                        setState('acknowledgement-error');
                      } else if (data) {
                        setRenameConfirmed(false);
                        reload();
                      }
                    });
                  }}
                >
                  {t('admin.review.rename')}
                </Button>
              </div>
              <p role={state === 'error' || state === 'acknowledgement-error' ? 'alert' : 'status'}>
                {state === 'pending'
                  ? t('admin.review.pending')
                  : state === 'error'
                    ? t('admin.review.error')
                    : state === 'acknowledgement-error'
                      ? t('admin.review.renameAcknowledgementError')
                      : ''}
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

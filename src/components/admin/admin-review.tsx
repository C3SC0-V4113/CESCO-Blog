import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getTranslations } from '@/i18n/utils';
import {
  callPublish,
  callRenameLocalization,
  callRetryPendingPurges,
  callUnpublish,
} from '@/lib/admin-actions';
import { mediaPath } from '@/lib/media';
import { isRenameLocalizationRejection } from '@/lib/publishing';

import { FormStatus, PendingButton } from './admin-form';

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
type State = 'idle' | 'pending' | 'error';
type Action = 'publish' | 'unpublish' | 'rename';

// Every outcome reloads, including one whose purge failed: the change recorded
// its tags when it committed (ADR-0037), so the server renders the pending
// notice and its retry for whoever opens the page next, not just this tab.
const reload = () => window.location.reload();
const textLink = 'inline-flex min-h-6 items-center underline underline-offset-4';

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
      <PendingButton
        type="button"
        variant="outline"
        pending={state === 'pending'}
        onClick={() => void retry()}
      >
        {t('admin.review.retryPurge')}
      </PendingButton>
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
        // Styled, not structural: the draft's headings would otherwise nest
        // under the page's own and break its outline.
        if (block.type === 'heading')
          return (
            <p key={block.attrs.blockId} className="text-lg font-semibold">
              {text}
            </p>
          );
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
              className="h-auto max-h-128 w-full rounded-md object-contain"
            />
          </figure>
        ) : (
          <p key={block.attrs.blockId}>{t('admin.media.unavailable')}</p>
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

function ReviewQueue({
  items,
  detail,
  page,
  pageSize,
  total,
}: Pick<Props, 'items' | 'detail' | 'page' | 'pageSize' | 'total'>) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  return (
    <section
      aria-label={t('admin.review.queue')}
      className="order-last max-h-[70vh] overflow-auto rounded-xl border bg-background p-1.5 lg:order-first"
    >
      {items.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          {items.map((item) => (
            <li key={item.localizationId}>
              <a
                className="block rounded-md border p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:border-primary aria-[current=page]:bg-muted"
                aria-current={detail?.localizationId === item.localizationId ? 'page' : undefined}
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
        <p className="p-2.5">{t('admin.review.empty')}</p>
      )}
      {total > 0 && (
        <p className="mt-1.5 px-2.5 text-sm text-muted-foreground tabular-nums">
          {t('admin.review.showing')} {firstItem}–{lastItem} {t('admin.review.of')} {total}
        </p>
      )}
      {total > pageSize && (
        <nav
          aria-label={t('listing.pagination')}
          className="mt-1.5 flex justify-between gap-2 px-2.5 pb-1"
        >
          {page > 1 ? (
            <a className={textLink} href={reviewUrl(page - 1, detail)}>
              {t('listing.previous')}
            </a>
          ) : (
            <span />
          )}
          {lastItem < total && (
            <a className={textLink} href={reviewUrl(page + 1, detail)}>
              {t('listing.next')}
            </a>
          )}
        </nav>
      )}
    </section>
  );
}

function ReviewSummary({ detail }: { detail: ReviewDetail }) {
  return (
    <>
      <div>
        <h2 className="text-xl font-semibold wrap-anywhere">
          {detail.title || detail.slug}
        </h2>
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
          <dd className="tabular-nums">{detail.contentJson.content.length}</dd>
        </div>
        <div>
          <dt>{t('admin.review.media')}</dt>
          <dd className="tabular-nums">{detail.referencedMedia.length}</dd>
        </div>
        <div>
          <dt>{t('admin.review.draft')}</dt>
          <dd>{detail.draftToken ? t('admin.review.ready') : t('admin.review.missing')}</dd>
        </div>
      </dl>
      <ReviewPreview detail={detail} />
    </>
  );
}

function RenameConfirmation({
  acknowledgement,
  renameConfirmed,
  acknowledgementMissing,
  onChange,
}: {
  acknowledgement: { current: HTMLButtonElement | null };
  renameConfirmed: boolean;
  acknowledgementMissing: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-foreground">
      <p>{t('admin.review.renameWarning')}</p>
      <Field orientation="horizontal" className="items-start">
        <Checkbox
          id="review-rename-confirmation"
          ref={acknowledgement}
          name="acknowledgePermanentRedirect"
          checked={renameConfirmed}
          onCheckedChange={(checked) => onChange(checked === true)}
          aria-invalid={acknowledgementMissing ? true : undefined}
          aria-describedby={
            acknowledgementMissing ? 'acknowledgePermanentRedirect-error' : undefined
          }
        />
        <FieldLabel htmlFor="review-rename-confirmation" className="font-normal">
          {t('admin.review.renameConfirm')}
        </FieldLabel>
      </Field>
      {acknowledgementMissing && (
        <FieldError id="acknowledgePermanentRedirect-error">
          {t('admin.review.renameAcknowledgementError')}
        </FieldError>
      )}
    </div>
  );
}

function ReviewActions({
  detail,
  state,
  running,
  blocked,
  renameBlocked,
  onPublish,
  onUnpublish,
}: {
  detail: ReviewDetail;
  state: State;
  running?: Action;
  blocked: boolean;
  renameBlocked: boolean;
  onPublish(): void;
  onUnpublish(): void;
}) {
  return (
    <>
      {blocked && (
        <p id="publish-blocked" className="text-sm text-muted-foreground">
          {t('admin.review.blocked')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <PendingButton
          type="button"
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          pending={state === 'pending' && running === 'publish'}
          disabled={blocked || state === 'pending'}
          focusableWhenDisabled
          aria-describedby={blocked ? 'publish-blocked' : undefined}
          onClick={onPublish}
        >
          {t(detail.status === 'published' ? 'admin.review.republish' : 'admin.review.publish')}
        </PendingButton>
        <PendingButton
          type="button"
          variant="outline"
          pending={state === 'pending' && running === 'unpublish'}
          disabled={detail.status !== 'published' || state === 'pending'}
          onClick={onUnpublish}
        >
          {t('admin.review.unpublish')}
        </PendingButton>
        {/* The form's only submit button, so Enter in the slug field renames. */}
        <PendingButton
          type="submit"
          variant="outline"
          pending={state === 'pending' && running === 'rename'}
          disabled={renameBlocked}
        >
          {t('admin.review.rename')}
        </PendingButton>
      </div>
      <FormStatus
        message={state === 'pending' ? t('admin.review.pending') : undefined}
        error={state === 'error' ? t('admin.review.error') : undefined}
      />
    </>
  );
}

function ReviewDetailPanel({
  detail,
  state,
  running,
  acknowledgement,
  renameConfirmed,
  setRenameConfirmed,
  needsAcknowledgement,
  acknowledgementMissing,
  blocked,
  renameBlocked,
  onRename,
  onPublish,
  onUnpublish,
}: {
  detail: ReviewDetail | null;
  state: State;
  running?: Action;
  acknowledgement: { current: HTMLButtonElement | null };
  renameConfirmed: boolean;
  setRenameConfirmed(confirmed: boolean): void;
  needsAcknowledgement: boolean;
  acknowledgementMissing: boolean;
  blocked: boolean;
  renameBlocked: boolean;
  onRename(form: HTMLFormElement): void;
  onPublish(): void;
  onUnpublish(): void;
}) {
  return (
    <section
      aria-label={t('admin.review.detail')}
      className="order-first min-w-0 rounded-xl border bg-background p-4 lg:order-last"
    >
      {!detail ? (
        <p>{t('admin.review.select')}</p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onRename(event.currentTarget);
          }}
        >
          <ReviewSummary detail={detail} />
          <Field className="gap-1">
            <FieldLabel htmlFor="review-slug">{t('admin.posts.slug')}</FieldLabel>
            <Input
              id="review-slug"
              name="slug"
              defaultValue={detail.slug}
              autoComplete="off"
              required
              spellCheck={false}
              onChange={(event) => {
                if (event.target.value === detail.slug) setRenameConfirmed(false);
              }}
            />
          </Field>
          {needsAcknowledgement && (
            <RenameConfirmation
              acknowledgement={acknowledgement}
              renameConfirmed={renameConfirmed}
              acknowledgementMissing={acknowledgementMissing}
              onChange={setRenameConfirmed}
            />
          )}
          <ReviewActions
            detail={detail}
            state={state}
            running={running}
            blocked={blocked}
            renameBlocked={renameBlocked}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
          />
        </form>
      )}
    </section>
  );
}

export function AdminReview({ items, detail, page, pageSize, total, pendingPurges }: Props) {
  const [state, setState] = useState<State>('idle');
  const [running, setRunning] = useState<Action>();
  const [renameConfirmed, setRenameConfirmed] = useState(false);
  // Set when the server asks for the redirect confirmation this page did not
  // know it needed, because the localization went live after it loaded.
  const [acknowledgementRejected, setAcknowledgementRejected] = useState(false);
  const acknowledgement = useRef<HTMLButtonElement>(null);
  const operationId = useRef<string | null>(null);
  const mutation = detail ? { postId: detail.postId, localizationId: detail.localizationId } : null;
  const run = async (action: Action, work: () => Promise<{ error?: unknown; data?: unknown }>) => {
    setState('pending');
    setRunning(action);
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
    const data = await run('publish', () =>
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
  const needsAcknowledgement = Boolean(detail?.firstPublishedAt) || acknowledgementRejected;
  const acknowledgementMissing = acknowledgementRejected && !renameConfirmed;
  const renameBlocked = state === 'pending' || (needsAcknowledgement && !renameConfirmed);
  const rename = async (form: HTMLFormElement) => {
    // Enter in the slug field submits as well, so this repeats the guard the
    // disabled button already applies.
    if (renameBlocked) return;
    const slug = new FormData(form).get('slug');
    const data = await run('rename', () =>
      callRenameLocalization({
        ...mutation!,
        slug: String(slug),
        acknowledgePermanentRedirect: renameConfirmed,
      })
    );
    if (isRenameLocalizationRejection(data)) {
      // Rendered before the move, so focus lands on a checkbox already described.
      flushSync(() => {
        setAcknowledgementRejected(true);
        setState('idle');
      });
      acknowledgement.current?.focus();
    } else if (data) {
      setRenameConfirmed(false);
      reload();
    }
  };
  const unpublish = () =>
    void run('unpublish', () =>
      callUnpublish({
        ...mutation!,
        publishedRevisionId: detail?.publishedRevisionId ?? undefined,
      })
    ).then((data) => {
      if (data) reload();
    });

  return (
    <div className="grid gap-6">
      {pendingPurges > 0 && <PendingPurgesNotice />}
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* Concentric: the items' radius-md plus the 6px inset is radius-xl. */}
        <ReviewQueue items={items} detail={detail} page={page} pageSize={pageSize} total={total} />
        <ReviewDetailPanel
          detail={detail}
          state={state}
          running={running}
          acknowledgement={acknowledgement}
          renameConfirmed={renameConfirmed}
          setRenameConfirmed={setRenameConfirmed}
          needsAcknowledgement={needsAcknowledgement}
          acknowledgementMissing={acknowledgementMissing}
          blocked={blocked}
          renameBlocked={renameBlocked}
          onRename={(form) => void rename(form)}
          onPublish={() => void publish()}
          onUnpublish={unpublish}
        />
      </div>
    </div>
  );
}

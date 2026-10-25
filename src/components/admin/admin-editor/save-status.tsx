import { getTranslations } from '@/i18n/utils';

import type { SaveStatusValue } from './use-draft-autosave';

const t = getTranslations('es');

/**
 * The visible line follows every state. Screen readers hear a landed save,
 * through a region that is always there, and a failure, which interrupts;
 * typing does not announce "pending" on every keystroke.
 */
export function SaveStatus({ status, edited }: { status: SaveStatusValue; edited: boolean }) {
  return (
    <>
      {status === 'failed' || status === 'conflict' ? (
        <p role="alert">{t(`admin.editor.status.${status}`)}</p>
      ) : (
        <p>{t(`admin.editor.status.${status}`)}</p>
      )}
      <p role="status" className="sr-only">
        {edited && status === 'saved' ? t('admin.editor.status.saved') : ''}
      </p>
    </>
  );
}

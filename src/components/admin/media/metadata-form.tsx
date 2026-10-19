import { useId, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getTranslations } from '@/i18n/utils';
import { callUpdateMediaAsset } from '@/lib/admin-actions';

import { FormStatus, PendingButton } from '../admin-form';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');
const metadataFields = [
  'caption',
  'description',
  'creatorName',
  'sourceUrl',
  'licenseLabel',
  'licenseUrl',
] as const;
const urlFields: ReadonlySet<string> = new Set(['sourceUrl', 'licenseUrl']);

export function MetadataForm({
  asset,
  onSaved,
}: {
  asset: AdminMediaAsset;
  onSaved(asset: AdminMediaAsset): void;
}) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const formId = useId();
  const save = async (form: HTMLFormElement) => {
    setStatus('pending');
    const data = new FormData(form);
    try {
      const result = await callUpdateMediaAsset({
        id: asset.id,
        decorative: data.get('decorative') === 'on',
        altText: String(data.get('altText') ?? ''),
        isOwnWork: data.get('isOwnWork') === 'on',
        ...Object.fromEntries(
          metadataFields.map((field) => [field, String(data.get(field) ?? '') || null])
        ),
      });
      if (result.error) throw result.error;
      onSaved(result.data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };
  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <Field spacing="compact">
        <FieldLabel htmlFor={`${formId}-alt`}>{t('admin.media.alt')}</FieldLabel>
        <Input id={`${formId}-alt`} name="altText" defaultValue={asset.altText ?? ''} />
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          id={`${formId}-decorative`}
          name="decorative"
          defaultChecked={asset.altText === ''}
        />
        <FieldLabel htmlFor={`${formId}-decorative`}>{t('admin.media.decorative')}</FieldLabel>
      </Field>
      {metadataFields.map((field) => (
        <Field key={field} spacing="compact">
          <FieldLabel htmlFor={`${formId}-${field}`}>{t(`admin.media.${field}`)}</FieldLabel>
          <Input
            id={`${formId}-${field}`}
            name={field}
            defaultValue={asset[field] ?? ''}
            {...(urlFields.has(field) && { type: 'url', inputMode: 'url' as const })}
          />
        </Field>
      ))}
      <Field orientation="horizontal">
        <Checkbox id={`${formId}-own-work`} name="isOwnWork" defaultChecked={asset.isOwnWork} />
        <FieldLabel htmlFor={`${formId}-own-work`}>{t('admin.media.isOwnWork')}</FieldLabel>
      </Field>
      <PendingButton type="submit" variant="outline" pending={status === 'pending'}>
        {t('admin.media.saveMetadata')}
      </PendingButton>
      <FormStatus
        message={
          status === 'pending'
            ? t('admin.media.metadataPending')
            : status === 'success'
              ? t('admin.media.metadataSuccess')
              : undefined
        }
        error={status === 'error' ? t('admin.media.metadataError') : undefined}
      />
    </form>
  );
}

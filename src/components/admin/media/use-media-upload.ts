import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeImage } from '@/lib/image-normalize';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

export class PendingMediaUploadQueue {
  private pending: File[][] = [];
  private consumer: ((files: File[]) => Promise<void>) | null = null;
  private tail = Promise.resolve();

  private dispatch(files: File[]) {
    const consumer = this.consumer;
    if (consumer) this.tail = this.tail.then(() => consumer(files));
  }

  enqueue(files: File[]) {
    if (this.consumer) this.dispatch(files);
    else this.pending.push(files);
  }

  connect(consumer: (files: File[]) => Promise<void>) {
    this.consumer = consumer;
    for (const files of this.pending) this.dispatch(files);
    this.pending = [];
    return () => {
      if (this.consumer === consumer) this.consumer = null;
    };
  }
}

type Props = {
  onUploaded(asset: AdminMediaAsset): void;
  onSelect?: (asset: AdminMediaAsset) => void;
  pendingUploadQueue?: PendingMediaUploadQueue;
};

export function useMediaUpload({ onUploaded, onSelect, pendingUploadQueue }: Props) {
  const [altText, setAltText] = useState('');
  const [decorative, setDecorative] = useState(false);
  const [altMissing, setAltMissing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  const altInput = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      if (files.length === 1 && !decorative && !altText.trim()) {
        setAltMissing(true);
        setStatus('idle');
        // Let the sheet's initial focus settle before moving to the required field.
        requestAnimationFrame(() => altInput.current?.focus());
        if (fileInput.current) fileInput.current.value = '';
        return;
      }
      if (files.length !== 1) {
        setStatus('error');
        if (fileInput.current) fileInput.current.value = '';
        return;
      }
      setStatus('loading');
      try {
        const { blob } = await normalizeImage(files[0]!);
        const response = await fetch('/admin/media/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'image/webp',
            'X-Cesco-Media-Upload': '1',
            'X-Cesco-Media-Metadata': encodeURIComponent(JSON.stringify({ decorative, altText })),
          },
          body: blob,
        });
        if (!response.ok) throw Error('upload-failed');
        const asset = (await response.json()) as AdminMediaAsset;
        onUploaded(asset);
        setStatus('idle');
        onSelect?.(asset);
      } catch {
        setStatus('error');
      } finally {
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [altText, decorative, onSelect, onUploaded]
  );

  useEffect(() => pendingUploadQueue?.connect(upload), [pendingUploadQueue, upload]);

  return {
    altText,
    setAltText: (value: string) => {
      setAltText(value);
      setAltMissing(false);
    },
    decorative,
    setDecorative: (value: boolean) => {
      setDecorative(value);
      setAltMissing(false);
    },
    altMissing,
    status,
    fileInput,
    altInput,
    upload,
  };
}

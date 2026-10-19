import { XIcon } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';

import { AdminMedia, type MediaUploader } from '@/components/admin/admin-media';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getTranslations } from '@/i18n/utils';
import { cn } from '@/lib/utils';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');
const PANEL_ID = 'editor-image-picker';
const PANEL_HEADING_ID = 'editor-image-picker-heading';

type PickerContextValue = {
  isWide: boolean;
  openState: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  uploaderRef: RefObject<MediaUploader | null>;
  pendingFilesRef: RefObject<File[] | null>;
  restoreFocusRef: RefObject<boolean>;
  toggle(): void;
  close(restoreFocus?: boolean): void;
  uploadFiles(files: File[]): void;
  assets: AdminMediaAsset[];
  total: number;
};

const PickerContext = createContext<PickerContextValue | null>(null);

export function useImagePicker() {
  const picker = useContext(PickerContext);
  if (!picker) throw new Error('ImagePicker components must be inside ImagePicker.Root');
  return picker;
}

type RootProps = {
  isWide: boolean;
  assets: AdminMediaAsset[];
  total: number;
  children: ReactNode;
};

function Root({ isWide, assets, total, children }: RootProps) {
  const [openState, setOpenState] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const uploaderRef = useRef<MediaUploader>(null);
  const pendingFilesRef = useRef<File[] | null>(null);
  const restoreFocusRef = useRef(true);
  const openRef = useRef(false);

  const close = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    openRef.current = false;
    setOpenState(false);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  const open = useCallback(
    (focusHeading: boolean) => {
      restoreFocusRef.current = true;
      openRef.current = true;
      setOpenState(true);
      if (focusHeading && isWide)
        requestAnimationFrame(() => {
          if (openRef.current) headingRef.current?.focus();
        });
    },
    [isWide]
  );

  const toggle = useCallback(() => {
    if (openState) close();
    else open(true);
  }, [close, open, openState]);

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (uploaderRef.current) uploaderRef.current.upload(files);
      else pendingFilesRef.current = files;
      open(false);
    },
    [open]
  );

  const value = useMemo<PickerContextValue>(
    () => ({
      isWide,
      openState,
      headingRef,
      buttonRef,
      uploaderRef,
      pendingFilesRef,
      restoreFocusRef,
      toggle,
      close,
      uploadFiles,
      assets,
      total,
    }),
    [isWide, openState, toggle, close, uploadFiles, assets, total]
  );

  return (
    <PickerContext.Provider value={value}>
      <div
        className={cn(
          'grid gap-4',
          openState && isWide ? 'max-w-none grid-cols-editor-picker items-start' : 'max-w-4xl'
        )}
      >
        {children}
      </div>
    </PickerContext.Provider>
  );
}

type TriggerProps = Omit<
  ComponentProps<typeof Button>,
  'onClick' | 'ref' | 'aria-expanded' | 'aria-controls' | 'aria-haspopup'
>;

function Trigger(props: TriggerProps) {
  const picker = useImagePicker();
  return (
    <Button
      {...props}
      ref={picker.buttonRef}
      aria-expanded={picker.openState}
      aria-controls={picker.isWide ? PANEL_ID : undefined}
      aria-haspopup={picker.isWide ? undefined : 'dialog'}
      onClick={picker.toggle}
    />
  );
}

type PanelProps = {
  onSelect(asset: AdminMediaAsset): void;
};

function Panel({ onSelect }: PanelProps) {
  const picker = useImagePicker();

  function attachUploader(instance: MediaUploader | null) {
    picker.uploaderRef.current = instance;
    if (!instance || !picker.pendingFilesRef.current) return;
    const files = picker.pendingFilesRef.current;
    picker.pendingFilesRef.current = null;
    // The sheet popup mounts through a portal after the editor commits.
    queueMicrotask(() => {
      if (picker.uploaderRef.current === instance) instance.upload(files);
      else picker.pendingFilesRef.current ??= files;
    });
  }

  return (
    <>
      {picker.isWide && (
        <aside
          id={PANEL_ID}
          aria-labelledby={PANEL_HEADING_ID}
          className={cn(
            'sticky top-4 max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4 transition transition-picker transition-discrete duration-200 ease-out-cubic starting:opacity-0 motion-safe:starting:translate-x-2',
            picker.openState
              ? 'flex translate-x-0 opacity-100'
              : 'pointer-events-none hidden opacity-0 duration-150 motion-safe:translate-x-2'
          )}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              picker.close();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id={PANEL_HEADING_ID}
              ref={picker.headingRef}
              tabIndex={-1}
              className="flex min-w-0 items-center gap-2 font-heading text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {t('admin.editor.insertImage')}
            </h2>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('admin.editor.closeImagePicker')}
              onClick={() => picker.close()}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          {picker.openState && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <AdminMedia
                  ref={attachUploader}
                  assets={picker.assets}
                  total={picker.total}
                  showLibraryLink={false}
                  onSelect={onSelect}
                />
              </div>
              <footer className="border-t pt-3">
                <a className={buttonVariants({ variant: 'link' })} href="/admin/media">
                  {t('admin.media.openLibrary')}
                </a>
              </footer>
            </>
          )}
        </aside>
      )}
      {!picker.isWide && (
        <Sheet open={picker.openState} onOpenChange={(nextOpen) => !nextOpen && picker.close()}>
          {picker.openState && (
            <SheetContent
              side="bottom"
              initialFocus={() => picker.headingRef.current}
              finalFocus={() => (picker.restoreFocusRef.current ? picker.buttonRef.current : false)}
              closeLabel={t('admin.editor.closeImagePicker')}
            >
              <SheetHeader closeButton>
                <SheetTitle ref={picker.headingRef} tabIndex={-1}>
                  {t('admin.editor.insertImage')}
                </SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                <AdminMedia
                  ref={attachUploader}
                  assets={picker.assets}
                  total={picker.total}
                  onSelect={onSelect}
                />
              </div>
            </SheetContent>
          )}
        </Sheet>
      )}
    </>
  );
}

export const ImagePicker = { Root, Trigger, Panel } as const;

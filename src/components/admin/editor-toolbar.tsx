import { useEditorState, type Editor } from '@tiptap/react';
import {
  Code2Icon,
  Heading2Icon,
  Heading3Icon,
  ImagePlusIcon,
  PilcrowIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';

const t = getTranslations('es');
// Tiptap binds Mod to Command on macOS and Control elsewhere, so both are named.
const shortcut = (keys: string) => `Control+${keys} Meta+${keys}`;

/**
 * The editor's formatting toolbar, one tab stop moved by the arrows, Home and
 * End (WAI-ARIA APG toolbar pattern).
 */
type Props = {
  editor: Editor;
  imagePickerOpen: boolean;
  imagePickerDesktop: boolean;
  imagePickerButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleImagePicker(): void;
};

export function EditorToolbar({
  editor,
  imagePickerOpen,
  imagePickerDesktop,
  imagePickerButtonRef,
  onToggleImagePicker,
}: Props) {
  const [activeTool, setActiveTool] = useState(0);
  const toolbar = useRef<HTMLDivElement>(null);
  // Read through a selector, so the toolbar re-renders when what it shows
  // changes rather than on every transaction.
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      paragraph: instance.isActive('paragraph'),
      heading2: instance.isActive('heading', { level: 2 }),
      heading3: instance.isActive('heading', { level: 3 }),
      code: instance.isActive('codeBlock'),
      undo: instance.can().undo(),
      redo: instance.can().redo(),
    }),
  });
  // Block types are toggles and carry aria-pressed; history commands are
  // actions, unavailable rather than off.
  const tools = [
    {
      label: 'admin.editor.paragraph',
      Icon: PilcrowIcon,
      keys: shortcut('Alt+0'),
      pressed: state.paragraph,
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: 'admin.editor.heading2',
      Icon: Heading2Icon,
      keys: shortcut('Alt+2'),
      pressed: state.heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'admin.editor.heading3',
      Icon: Heading3Icon,
      keys: shortcut('Alt+3'),
      pressed: state.heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'admin.editor.code',
      Icon: Code2Icon,
      keys: shortcut('Alt+C'),
      pressed: state.code,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'admin.editor.insertImage',
      Icon: ImagePlusIcon,
      picker: true,
      run: onToggleImagePicker,
    },
    {
      label: 'admin.editor.undo',
      Icon: Undo2Icon,
      keys: shortcut('Z'),
      unavailable: !state.undo,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: 'admin.editor.redo',
      Icon: Redo2Icon,
      keys: `${shortcut('Shift+Z')} ${shortcut('Y')}`,
      unavailable: !state.redo,
      run: () => editor.chain().focus().redo().run(),
    },
  ] as const;
  // On the toolbar rather than each tool, because a disabled tool still takes
  // focus but drops its own key handlers.
  const moveTool = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = tools.length - 1;
    const next = {
      ArrowRight: activeTool === last ? 0 : activeTool + 1,
      ArrowLeft: activeTool === 0 ? last : activeTool - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActiveTool(next);
    toolbar.current?.querySelectorAll('button')[next]?.focus();
  };
  return (
    <div
      ref={toolbar}
      className="flex flex-wrap gap-2"
      role="toolbar"
      aria-label={t('admin.editor.toolbar')}
      onKeyDown={moveTool}
    >
      {tools.map((tool, index) => (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:inset-ring aria-pressed:inset-ring-foreground/20"
          aria-label={t(tool.label)}
          aria-keyshortcuts={'keys' in tool ? tool.keys || undefined : undefined}
          aria-pressed={'pressed' in tool ? tool.pressed : undefined}
          aria-expanded={'picker' in tool ? imagePickerOpen : undefined}
          aria-controls={'picker' in tool && imagePickerDesktop ? 'editor-image-picker' : undefined}
          aria-haspopup={'picker' in tool && !imagePickerDesktop ? 'dialog' : undefined}
          // An unavailable command stays reachable, so the arrows never skip it
          // and the roving stop is never stranded on a control that vanished.
          disabled={'unavailable' in tool && tool.unavailable}
          focusableWhenDisabled
          tabIndex={index === activeTool ? 0 : -1}
          ref={'picker' in tool ? imagePickerButtonRef : undefined}
          onFocus={() => setActiveTool(index)}
          onClick={tool.run}
          key={tool.label}
        >
          <tool.Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}

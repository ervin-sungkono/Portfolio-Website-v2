'use client';

import MDEditor, { commands } from '@uiw/react-md-editor/nohighlight';
import { useTheme } from 'next-themes';
import { BlogBody } from '@/components/blog/BlogBody';
import type { MarkdownEditorProps } from './type';
import './style.css';

const formatting = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.heading2,
  commands.link,
  commands.quote,
  commands.code,
  commands.codeBlock,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.checkedListCommand,
  commands.table,
];
const views = [commands.codeEdit, commands.codeLive, commands.codePreview];

export default function MarkdownEditor({
  value,
  onChange,
  onBlur,
  inputRef,
  invalid,
  describedBy,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();
  return (
    <div
      className="cms-markdown-editor"
      data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}
    >
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? '')}
        height={420}
        autoFocus={false}
        defaultTabEnable
        visibleDragbar={false}
        highlightEnable={false}
        commands={formatting}
        extraCommands={views}
        preview="live"
        ref={(instance) => inputRef(instance?.textarea ?? null)}
        textareaProps={{
          name: 'body',
          'aria-label': 'Markdown body',
          'aria-invalid': invalid,
          'aria-describedby': describedBy,
          onBlur,
          maxLength: 30000,
          spellCheck: true,
        }}
        components={{ preview: (source) => <BlogBody body={source} /> }}
      />
    </div>
  );
}

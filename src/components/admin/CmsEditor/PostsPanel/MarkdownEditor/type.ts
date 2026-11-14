export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: (element: HTMLTextAreaElement | null) => void;
  invalid: boolean;
  describedBy: string;
};

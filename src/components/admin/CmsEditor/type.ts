export type CmsSection =
  | 'projects'
  | 'posts'
  | 'site'
  | 'categories'
  | 'technologies'
  | 'designs'
  | 'images';

export type FieldErrorProps = { id: string; message?: string };

export type EditorMessage = {
  tone: 'success' | 'error' | 'conflict';
  text: string;
  commitUrl?: string;
};

export type LoadState = 'loading' | 'ready' | 'needs-initialization' | 'error';
export type BusySection = CmsSection | 'initialize' | 'submit' | null;

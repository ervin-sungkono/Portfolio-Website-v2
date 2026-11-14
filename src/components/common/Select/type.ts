import type { FocusEventHandler, Ref } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = {
  id?: string;
  name?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
  onValueChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
};

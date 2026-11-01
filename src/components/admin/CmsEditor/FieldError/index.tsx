import type { FieldErrorProps } from '../type';

export function FieldError({ id, message }: FieldErrorProps) {
  return message ? (
    <p className="cms-editor-field-error" id={id}>
      {message}
    </p>
  ) : null;
}

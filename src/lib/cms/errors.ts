export type CmsErrorCode =
  | 'configuration'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'unsupported_repository'
  | 'rate_limited'
  | 'unavailable'
  | 'github';

export class CmsError extends Error {
  readonly code: CmsErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CmsErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CmsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isCmsError(error: unknown): error is CmsError {
  return error instanceof CmsError;
}

export function validationError(message: string): CmsError {
  return new CmsError('validation', message, 400);
}

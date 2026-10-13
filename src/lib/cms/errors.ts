export class CmsSetupError extends Error {
  readonly status = 503;

  constructor(
    readonly missing: string[],
    message = 'The CMS is not configured.',
  ) {
    super(message);
    this.name = 'CmsSetupError';
  }
}

export class CmsUnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = 'Authentication is required.') {
    super(message);
    this.name = 'CmsUnauthorizedError';
  }
}

export class CmsForbiddenError extends Error {
  readonly status = 403;

  constructor(message = 'This account cannot manage CMS content.') {
    super(message);
    this.name = 'CmsForbiddenError';
  }
}

export class CmsNotFoundError extends Error {
  readonly status = 404;

  constructor(message = 'The requested CMS record was not found.') {
    super(message);
    this.name = 'CmsNotFoundError';
  }
}

export type CmsValidationIssue = { path: string; message: string };

export class CmsValidationError extends Error {
  readonly status = 400;

  constructor(
    message: string,
    readonly issues: CmsValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'CmsValidationError';
  }
}

export class CmsConflictError extends Error {
  readonly status = 409;

  constructor(message = 'This content changed. Reload it and try again.') {
    super(message);
    this.name = 'CmsConflictError';
  }
}

export class CmsInvariantError extends Error {
  readonly status = 500;

  constructor(message = 'The CMS data is inconsistent.') {
    super(message);
    this.name = 'CmsInvariantError';
  }
}

'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { refreshPublishedContent } from './cache';
import {
  CmsConflictError,
  CmsForbiddenError,
  CmsNotFoundError,
  CmsSetupError,
  CmsUnauthorizedError,
  CmsValidationError,
} from './errors';
import { publishMediaReferences } from './media';
import {
  getPayloadMediaReferences,
  isCmsKind,
  validatePayload,
  type CmsKind,
  type CmsPayload,
} from './model';
import {
  getPendingPublishEvents,
  publishEntry,
  readEntry,
  restoreEntry,
  saveEntry,
  unpublishEntry,
  type CmsActor,
} from './store';
import { requireOwner, requireRecentOwner } from './guards';

const MAX_FORM_BYTES = 128 * 1024;
const MAX_PAYLOAD_BYTES = 96 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EditorIssue = { path: string; message: string };

export type EditorActionState = {
  status: 'idle' | 'saved' | 'error' | 'conflict';
  message: string;
  issues?: EditorIssue[];
  reauthRequired?: boolean;
  entryId?: string;
  draftRevision?: number;
  requestId?: string;
};

export type MutationActionResult = {
  ok: boolean;
  conflict?: boolean;
  reauthRequired?: boolean;
  message: string;
  refreshed?: boolean;
  issues?: EditorIssue[];
  requestId?: string;
  restoredDraft?: { payload: CmsPayload; position: number; draftRevision: number };
};

function assertBoundedForm(formData: FormData): void {
  let bytes = 0;
  for (const [key, value] of formData.entries()) {
    bytes += new TextEncoder().encode(key).byteLength;
    if (typeof value === 'string') {
      bytes += new TextEncoder().encode(value).byteLength;
    } else {
      bytes += value.size;
      throw new CmsValidationError('This form accepts text fields only.');
    }
    if (bytes > MAX_FORM_BYTES)
      throw new CmsValidationError('The form is too large. Shorten the content and try again.');
  }
}

function stringField(formData: FormData, name: string, required = true): string {
  const values = formData.getAll(name);
  if (values.length === 0 && !required) return '';
  if (values.length !== 1 || typeof values[0] !== 'string') {
    throw new CmsValidationError(`The ${name} field is missing or invalid.`);
  }
  return values[0];
}

function integerField(formData: FormData, name: string, minimum = 0, maximum = 1_000_000): number {
  const value = stringField(formData, name);
  if (!/^(?:0|[1-9]\d{0,8})$/.test(value)) throw new CmsValidationError(`Enter a valid ${name}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CmsValidationError(`Enter a valid ${name}.`);
  }
  return parsed;
}

function requiredUuid(formData: FormData, name: string): string {
  const value = stringField(formData, name);
  if (!UUID_PATTERN.test(value)) throw new CmsValidationError(`Enter a valid ${name}.`);
  return value;
}

function safeActionError(error: unknown): MutationActionResult {
  if (error instanceof CmsValidationError) {
    return {
      ok: false,
      message: error.message,
      issues: error.issues.map(({ path, message }) => ({ path, message })),
    };
  }
  if (error instanceof CmsConflictError) {
    return { ok: false, conflict: true, message: error.message };
  }
  if (error instanceof CmsNotFoundError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof CmsUnauthorizedError) {
    const recentSignInRequired = error.message.includes('before this sensitive action');
    return {
      ok: false,
      reauthRequired: true,
      message: recentSignInRequired
        ? 'Publishing and unpublishing require a password and authenticator sign-in within the last 30 minutes.'
        : 'Your editing session ended. Sign in again with your password and authenticator code to continue.',
    };
  }
  if (error instanceof CmsForbiddenError) {
    return {
      ok: false,
      message: 'This account does not have permission to change portfolio content.',
    };
  }
  if (error instanceof CmsSetupError) {
    return {
      ok: false,
      message: 'The CMS service is unavailable. Check its setup status and try again.',
    };
  }
  return {
    ok: false,
    message:
      'The change could not be completed. Your draft is still on this page; try again shortly.',
  };
}

function saveErrorState(error: unknown): EditorActionState {
  const result = safeActionError(error);
  return {
    status: result.conflict ? 'conflict' : 'error',
    message: result.message,
    ...(result.issues ? { issues: result.issues } : {}),
    ...(result.reauthRequired ? { reauthRequired: true } : {}),
  };
}

export async function saveDraftAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  try {
    const owner = await requireOwner();
    assertBoundedForm(formData);

    const kindValue = stringField(formData, 'kind');
    if (!isCmsKind(kindValue)) throw new CmsValidationError('Choose a valid content type.');
    const kind: CmsKind = kindValue;
    const slug = stringField(formData, 'slug').trim();
    const position = integerField(formData, 'position');
    const idValue = stringField(formData, 'entryId', false);
    const revisionValue = stringField(formData, 'expectedRevision', false);
    const id = idValue || undefined;
    const expectedRevision = revisionValue ? Number(revisionValue) : undefined;
    if (
      id &&
      (!UUID_PATTERN.test(id) || !Number.isSafeInteger(expectedRevision) || expectedRevision! < 1)
    ) {
      throw new CmsValidationError('Reload the entry before saving it.');
    }
    if (!id && expectedRevision !== undefined)
      throw new CmsValidationError('This new draft needs to be saved again.');

    const requestId = requiredUuid(formData, 'requestId');
    const payloadText = stringField(formData, 'payload');
    if (new TextEncoder().encode(payloadText).byteLength > MAX_PAYLOAD_BYTES) {
      throw new CmsValidationError('The content is too large to save.');
    }
    let input: unknown;
    try {
      input = JSON.parse(payloadText);
    } catch {
      throw new CmsValidationError(
        'Some content fields could not be read. Check the form and try again.',
      );
    }
    const payload = validatePayload(kind, input);
    const actor: CmsActor = { userId: owner.userId };
    const saved = await saveEntry(
      { id, kind, slug, position, payload, expectedRevision, requestId },
      actor,
    );
    revalidatePath('/admin');
    revalidatePath(`/admin/content/${kind}`);
    revalidatePath(`/admin/editor/${saved.id}`);
    revalidatePath(`/admin/preview/${saved.id}`);
    return {
      status: 'saved',
      message: `Draft saved as revision ${saved.draftRevision}.`,
      entryId: saved.id,
      draftRevision: saved.draftRevision,
      requestId: randomUUID(),
    };
  } catch (error) {
    return saveErrorState(error);
  }
}

async function parseMutation(formData: FormData) {
  assertBoundedForm(formData);
  const id = requiredUuid(formData, 'entryId');
  const expectedRevision = integerField(formData, 'expectedRevision', 1, 2_000_000_000);
  return { id, expectedRevision };
}

export async function publishAction(formData: FormData): Promise<MutationActionResult> {
  try {
    const owner = await requireRecentOwner();
    const { id, expectedRevision } = await parseMutation(formData);
    const entry = await readEntry(id);
    if (!entry) throw new CmsNotFoundError('This content entry no longer exists.');
    if (entry.draftRevision !== expectedRevision) throw new CmsConflictError();

    const references = getPayloadMediaReferences(entry.payload);
    const preparedMedia = await publishMediaReferences(references, owner.userId);
    const result = await publishEntry(
      id,
      expectedRevision,
      { userId: owner.userId },
      preparedMedia,
    );
    const cache = await refreshPublishedContent(result.eventId, result.entry.slug);
    revalidatePath('/admin');
    revalidatePath(`/admin/content/${result.entry.kind}`);
    revalidatePath(`/admin/editor/${id}`);
    return {
      ok: true,
      refreshed: cache.refreshed,
      message: cache.refreshed
        ? 'The saved revision is published.'
        : 'The database publication succeeded, but public cache refresh is pending. Use the dashboard retry control.',
    };
  } catch (error) {
    return safeActionError(error);
  }
}

export async function unpublishAction(formData: FormData): Promise<MutationActionResult> {
  try {
    const owner = await requireRecentOwner();
    const { id, expectedRevision } = await parseMutation(formData);
    const result = await unpublishEntry(id, expectedRevision, { userId: owner.userId });
    const cache = await refreshPublishedContent(result.eventId, result.entry.slug);
    revalidatePath('/admin');
    revalidatePath(`/admin/content/${result.entry.kind}`);
    revalidatePath(`/admin/editor/${id}`);
    return {
      ok: true,
      refreshed: cache.refreshed,
      message: cache.refreshed
        ? 'This entry is no longer published.'
        : 'The entry was unpublished, but public cache refresh is pending. Use the dashboard retry control.',
    };
  } catch (error) {
    return safeActionError(error);
  }
}

export async function restoreAction(formData: FormData): Promise<MutationActionResult> {
  try {
    const owner = await requireOwner();
    assertBoundedForm(formData);
    const id = requiredUuid(formData, 'entryId');
    const expectedRevision = integerField(formData, 'expectedRevision', 1, 2_000_000_000);
    const version = integerField(formData, 'version', 1, 2_000_000_000);
    const restored = await restoreEntry(id, version, expectedRevision, { userId: owner.userId });
    revalidatePath('/admin');
    revalidatePath(`/admin/content/${restored.kind}`);
    revalidatePath(`/admin/editor/${id}`);
    revalidatePath(`/admin/preview/${id}`);
    return {
      ok: true,
      requestId: randomUUID(),
      restoredDraft: {
        payload: restored.payload,
        position: restored.position,
        draftRevision: restored.draftRevision,
      },
      message: `Revision ${version} is restored and ready to preview or publish as draft revision ${restored.draftRevision}.`,
    };
  } catch (error) {
    return safeActionError(error);
  }
}

export type RetryActionResult = {
  ok: boolean;
  refreshed: number;
  pending: number;
  message: string;
};

export async function retryPendingPublicationAction(): Promise<RetryActionResult> {
  try {
    await requireOwner();
    const pending = await getPendingPublishEvents();
    let refreshed = 0;
    for (const event of pending) {
      const result = await refreshPublishedContent(event.id, event.slug);
      if (result.refreshed) refreshed += 1;
    }
    const remaining = await getPendingPublishEvents();
    revalidatePath('/admin');
    return {
      ok: remaining.length === 0,
      refreshed,
      pending: remaining.length,
      message:
        remaining.length === 0
          ? `Public cache is current. ${refreshed} pending event${refreshed === 1 ? '' : 's'} processed.`
          : 'Some public cache events remain pending. Try again later.',
    };
  } catch (error) {
    const result = safeActionError(error);
    return { ok: false, refreshed: 0, pending: 0, message: result.message };
  }
}

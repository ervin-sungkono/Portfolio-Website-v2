import { redirect } from 'next/navigation';
import { getCmsSetupStatus } from '@/lib/cms/auth';
import {
  CmsForbiddenError,
  CmsSetupError,
  CmsUnauthorizedError,
  getOwnerSession,
  requireAuthenticatedOwner,
  requireOwner,
  type OwnerSession,
} from '@/lib/cms/guards';
import type { PublicSourceMode } from '@/components/admin/admin-frame';

export type SetupState = { ready: false; missing: string[]; message?: string };
export type OwnerAccess = { ready: true; session: OwnerSession };

export function getPublicSourceMode(): PublicSourceMode {
  return process.env.CMS_CONTENT_SOURCE === 'database' ? 'database' : 'static';
}

export async function getOwnerPageAccess(): Promise<OwnerAccess | SetupState> {
  const setup = await getCmsSetupStatus();
  if (!setup.ready) return { ready: false, missing: setup.missing };

  try {
    await requireOwner();
    const session = await getOwnerSession();
    if (!session) redirect('/admin/login');
    return { ready: true, session };
  } catch (error) {
    if (error instanceof CmsSetupError) {
      return {
        ready: false,
        missing: error.missing,
        message: 'The CMS service is not ready to connect.',
      };
    }
    if (error instanceof CmsUnauthorizedError) redirect('/admin/login');
    if (error instanceof CmsForbiddenError) {
      let session: OwnerSession;
      try {
        session = await requireAuthenticatedOwner();
      } catch (enrollmentError) {
        if (enrollmentError instanceof CmsSetupError) {
          return {
            ready: false,
            missing: enrollmentError.missing,
            message: 'The CMS service is not ready to connect.',
          };
        }
        if (enrollmentError instanceof CmsUnauthorizedError) redirect('/admin/login');
        if (enrollmentError instanceof CmsForbiddenError) redirect('/admin/login?access=denied');
        throw enrollmentError;
      }
      if (!session.twoFactorEnabled) redirect('/admin/security');
      redirect('/admin/login?access=denied');
    }
    throw error;
  }
}

export async function getEnrollmentPageAccess(): Promise<OwnerAccess | SetupState> {
  const setup = await getCmsSetupStatus();
  if (!setup.ready) return { ready: false, missing: setup.missing };

  try {
    return { ready: true, session: await requireAuthenticatedOwner() };
  } catch (error) {
    if (error instanceof CmsSetupError) {
      return {
        ready: false,
        missing: error.missing,
        message: 'The CMS service is not ready to connect.',
      };
    }
    if (error instanceof CmsUnauthorizedError) redirect('/admin/login');
    if (error instanceof CmsForbiddenError) redirect('/admin/login?access=denied');
    throw error;
  }
}

export function isSetupState(value: OwnerAccess | SetupState): value is SetupState {
  return !value.ready;
}

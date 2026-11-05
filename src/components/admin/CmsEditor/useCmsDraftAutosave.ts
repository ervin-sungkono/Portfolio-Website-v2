'use client';

import { useEffect, useRef } from 'react';
import type { Categories, ProjectDocument, SiteDocument, Technologies } from '@/lib/cms/schemas';
import type { CmsDraft } from '../CmsDraftProvider/type';
import { synchronizeDocument, synchronizeProject } from './draft';
import type { CmsSnapshot } from './type';

type UpdateDraft = (change: (current: CmsDraft) => CmsDraft) => Promise<boolean>;

type CmsDraftAutosaveOptions = {
  snapshot: CmsSnapshot | null;
  remoteSnapshotRef: { current: CmsSnapshot | null };
  draftReady: boolean;
  busyRef: { current: boolean };
  updateDraft: UpdateDraft;
  selectedProjectSlug: string;
  newProjectSlug: string;
  projectIsDirty: boolean;
  projectValues: ProjectDocument;
  siteIsDirty: boolean;
  siteValues: SiteDocument;
  categoriesAreDirty: boolean;
  categoryValues: Categories;
  technologiesAreDirty: boolean;
  technologyValues: Technologies;
};

export function useCmsDraftAutosave({
  snapshot,
  remoteSnapshotRef,
  draftReady,
  busyRef,
  updateDraft,
  selectedProjectSlug,
  newProjectSlug,
  projectIsDirty,
  projectValues,
  siteIsDirty,
  siteValues,
  categoriesAreDirty,
  categoryValues,
  technologiesAreDirty,
  technologyValues,
}: CmsDraftAutosaveOptions) {
  const projectTouched = useRef({ slug: selectedProjectSlug, dirty: false });
  const siteTouched = useRef(false);
  const categoriesTouched = useRef(false);
  const technologiesTouched = useRef(false);

  useEffect(() => {
    if (projectTouched.current.slug !== selectedProjectSlug) {
      projectTouched.current = { slug: selectedProjectSlug, dirty: false };
    }
    if (projectIsDirty) {
      projectTouched.current.dirty = true;
    }
    const wasDirty = projectTouched.current.dirty;
    if (
      !snapshot ||
      !draftReady ||
      busyRef.current ||
      (!projectIsDirty && !wasDirty && (selectedProjectSlug || !newProjectSlug.trim()))
    ) {
      return;
    }
    if (!projectIsDirty) {
      projectTouched.current.dirty = false;
    }
    if (selectedProjectSlug) {
      const baseline = remoteSnapshotRef.current?.projects.find(
        (project) => project.slug === selectedProjectSlug,
      );
      void updateDraft((value) =>
        synchronizeProject(value, selectedProjectSlug, baseline, projectValues),
      );
    } else {
      void updateDraft((value) => {
        const next = { slug: newProjectSlug, data: projectValues };
        return JSON.stringify(value.newProject) === JSON.stringify(next)
          ? value
          : { ...value, newProject: next };
      });
    }
  }, [
    snapshot,
    draftReady,
    busyRef,
    remoteSnapshotRef,
    projectIsDirty,
    selectedProjectSlug,
    newProjectSlug,
    projectValues,
    updateDraft,
  ]);

  useEffect(() => {
    if (siteIsDirty) {
      siteTouched.current = true;
    }
    const wasDirty = siteTouched.current;
    const baseline = remoteSnapshotRef.current?.site;
    if (!snapshot || !baseline || !draftReady || busyRef.current || (!siteIsDirty && !wasDirty)) {
      return;
    }
    if (!siteIsDirty) {
      siteTouched.current = false;
    }
    void updateDraft((value) => synchronizeDocument(value, 'site', baseline, siteValues));
  }, [snapshot, remoteSnapshotRef, draftReady, busyRef, siteIsDirty, siteValues, updateDraft]);

  useEffect(() => {
    if (categoriesAreDirty) {
      categoriesTouched.current = true;
    }
    const wasDirty = categoriesTouched.current;
    const baseline = remoteSnapshotRef.current?.categories;
    if (
      !snapshot ||
      !baseline ||
      !draftReady ||
      busyRef.current ||
      (!categoriesAreDirty && !wasDirty)
    ) {
      return;
    }
    if (!categoriesAreDirty) {
      categoriesTouched.current = false;
    }
    void updateDraft((value) => synchronizeDocument(value, 'categories', baseline, categoryValues));
  }, [
    snapshot,
    remoteSnapshotRef,
    draftReady,
    busyRef,
    categoriesAreDirty,
    categoryValues,
    updateDraft,
  ]);

  useEffect(() => {
    if (technologiesAreDirty) {
      technologiesTouched.current = true;
    }
    const wasDirty = technologiesTouched.current;
    const baseline = remoteSnapshotRef.current?.technologies;
    if (
      !snapshot ||
      !baseline ||
      !draftReady ||
      busyRef.current ||
      (!technologiesAreDirty && !wasDirty)
    ) {
      return;
    }
    if (!technologiesAreDirty) {
      technologiesTouched.current = false;
    }
    void updateDraft((value) =>
      synchronizeDocument(value, 'technologies', baseline, technologyValues),
    );
  }, [
    snapshot,
    remoteSnapshotRef,
    draftReady,
    busyRef,
    technologiesAreDirty,
    technologyValues,
    updateDraft,
  ]);
}

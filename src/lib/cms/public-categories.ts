type PublicCategorySource = {
  categories: { data: Record<string, { label: string; sortOrder: number }> };
  projects: readonly { data: { published: boolean; categories: readonly string[] } }[];
};

export function getPublishedCategoryLabels(snapshot: PublicCategorySource): readonly string[] {
  const referencedIds = new Set(
    snapshot.projects.flatMap(({ data }) => (data.published ? data.categories : [])),
  );
  return [
    ...new Set(
      [...referencedIds]
        .sort(
          (left, right) =>
            snapshot.categories.data[left].sortOrder - snapshot.categories.data[right].sortOrder ||
            left.localeCompare(right),
        )
        .map((id) => snapshot.categories.data[id].label),
    ),
  ];
}

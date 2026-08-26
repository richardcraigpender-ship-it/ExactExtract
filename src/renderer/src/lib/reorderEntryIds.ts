export function reorderEntryIds(
  entryIds: readonly string[],
  draggedEntryId: string,
  targetEntryId: string
): string[] {
  if (draggedEntryId === targetEntryId) {
    return [...entryIds]
  }

  const reorderedIds = [...entryIds]
  const draggedIndex = reorderedIds.indexOf(draggedEntryId)
  const targetIndex = reorderedIds.indexOf(targetEntryId)
  if (draggedIndex < 0 || targetIndex < 0) {
    return reorderedIds
  }

  reorderedIds.splice(draggedIndex, 1)
  const insertionIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex
  reorderedIds.splice(insertionIndex, 0, draggedEntryId)
  return reorderedIds
}

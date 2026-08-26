import type { ProjectEntry } from '../shared/contracts'

export interface EntryImageCrop {
  entryId: string
  documentId: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  fileName: string
}

function validPdfBox(
  entry: ProjectEntry
): NonNullable<ProjectEntry['regions'][number]['bbox']> | null {
  return (
    entry.regions.find(
      (region) =>
        region.bbox?.coordinateSpace === 'pdf-points' &&
        region.bbox.width > 0 &&
        region.bbox.height > 0
    )?.bbox ?? null
  )
}

function imageDateLabel(value: string | undefined): string {
  if (!value) return 'Undated'
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const date = calendarDate
    ? new Date(
        Date.UTC(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3]))
      )
    : new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Undated'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

export function buildEntryImageCrops(entries: readonly ProjectEntry[]): EntryImageCrop[] {
  const kept = entries.filter((entry) => entry.status === 'keep')
  const referenceBox = kept.map(validPdfBox).find((box) => box !== null)
  if (!referenceBox) throw new Error('A kept entry with a PDF-coordinate region is required.')

  const dateCounts = new Map<string, number>()
  const crops: EntryImageCrop[] = []
  for (const entry of kept) {
    const region = entry.regions.find(
      (candidate) =>
        candidate.bbox?.coordinateSpace === 'pdf-points' &&
        candidate.bbox.width > 0 &&
        candidate.bbox.height > 0
    )
    if (!region?.bbox) continue
    const label = imageDateLabel(entry.date)
    const count = (dateCounts.get(label) ?? 0) + 1
    dateCounts.set(label, count)
    crops.push({
      entryId: entry.id,
      documentId: region.documentId,
      pageNumber: region.pageNumber,
      x: region.bbox.x,
      y: region.bbox.y,
      width: referenceBox.width,
      height: referenceBox.height,
      fileName: `${label} (${count}).png`
    })
  }
  return crops
}

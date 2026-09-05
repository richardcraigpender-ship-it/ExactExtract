import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ProjectEntry, ProjectState } from '../shared/contracts'
import {
  applyPageForwardCarryover,
  buildCompactSourceRows,
  prepareCompactSourceRows
} from './compact'
import { buildExportSnapshot } from './snapshot'
import type { ExportEntry, PdfExportOptions } from './types'
import {
  applySourceMetadata,
  collectSourceMetadata,
  type CollectedSourceMetadata
} from './sourceMetadata'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 54
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

// Mirrors the viewer's source-status highlight colors (main.css) so review decisions stay visually consistent in exports.
const STATUS_BORDER_COLOR = {
  maybe: rgb(0.851, 0.604, 0.133),
  exclude: rgb(0.741, 0.294, 0.263)
} as const

function safeText(value: string, font: PDFFont): string {
  return [...value]
    .map((character) => {
      try {
        font.encodeText(character)
        return character
      } catch {
        return '?'
      }
    })
    .join('')
}

function wrapText(value: string, font: PDFFont, size: number, width: number): string[] {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((paragraph) => {
      const words = safeText(paragraph, font).split(/\s+/).filter(Boolean)
      if (words.length === 0) return ['']
      const lines: string[] = []
      let line = ''
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate
          continue
        }
        if (line) lines.push(line)
        if (font.widthOfTextAtSize(word, size) <= width) {
          line = word
          continue
        }
        let fragment = ''
        for (const character of word) {
          if (font.widthOfTextAtSize(fragment + character, size) > width && fragment) {
            lines.push(fragment)
            fragment = character
          } else fragment += character
        }
        line = fragment
      }
      if (line) lines.push(line)
      return lines
    })
}

function compactTextLayout(
  value: string,
  font: PDFFont,
  width: number,
  sourceHeight: number
): { lines: string[]; size: number; lineHeight: number; height: number } {
  const size = Math.max(6, Math.min(11, sourceHeight * 0.72))
  const lines = wrapText(value, font, size, Math.max(24, width))
  const lineHeight = size * 1.25
  return {
    lines,
    size,
    lineHeight,
    height: Math.max(sourceHeight, lines.length * lineHeight)
  }
}

function entryReference(entry: ExportEntry): string {
  return [...new Set(entry.regions.map((region) => `${region.documentId} p.${region.pageNumber}`))]
    .sort()
    .join(', ')
}

interface PdfCursor {
  page: PDFPage
  pageNumber: number
  y: number
}

export async function exportProjectPdf(
  project: ProjectState,
  options: PdfExportOptions = {}
): Promise<Uint8Array> {
  const snapshot = buildExportSnapshot(project, options)
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const projectDate = new Date(snapshot.project.updatedAt)
  if (!Number.isNaN(projectDate.valueOf())) {
    pdf.setCreationDate(projectDate)
    pdf.setModificationDate(projectDate)
  }
  pdf.setTitle(snapshot.project.name)
  pdf.setSubject('Reviewed PDF extraction with source traceability')
  pdf.setProducer('EXACT EXTRACT')
  pdf.setCreator('EXACT EXTRACT')

  const cursor: PdfCursor = { page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pageNumber: 0, y: 0 }
  const addPage = (): void => {
    if (cursor.pageNumber > 0) cursor.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    cursor.pageNumber += 1
    cursor.y = PAGE_HEIGHT - MARGIN
    cursor.page.drawText(safeText(snapshot.project.name, bold), {
      x: MARGIN,
      y: cursor.y,
      size: 9,
      font: bold,
      color: rgb(0.15, 0.3, 0.22)
    })
    cursor.page.drawText(`Page ${cursor.pageNumber}`, {
      x: PAGE_WIDTH - MARGIN - 45,
      y: cursor.y,
      size: 9,
      font: regular,
      color: rgb(0.38, 0.43, 0.39)
    })
    cursor.y -= 28
  }
  const ensure = (height: number): void => {
    if (cursor.y - height < MARGIN) addPage()
  }
  const drawLines = (
    lines: readonly string[],
    size: number,
    font: PDFFont,
    color = rgb(0.12, 0.15, 0.13)
  ): void => {
    const lineHeight = size * 1.35
    for (const line of lines) {
      ensure(lineHeight)
      cursor.page.drawText(line, { x: MARGIN, y: cursor.y, size, font, color })
      cursor.y -= lineHeight
    }
  }
  const heading = (text: string): void => {
    ensure(34)
    cursor.y -= 8
    drawLines([safeText(text, bold)], 15, bold, rgb(0.09, 0.34, 0.23))
    cursor.y -= 5
  }
  const drawEntry = (entry: ExportEntry): void => {
    const label = `${entry.category ?? 'Entry'} | ${Math.round(entry.confidence * 100)}% confidence`
    ensure(58)
    drawLines([safeText(label, bold)], 10, bold)
    drawLines(wrapText(entry.normalizedText, regular, 10, CONTENT_WIDTH), 10, regular)
    drawLines(
      wrapText(`Source: ${entryReference(entry)}`, regular, 8, CONTENT_WIDTH),
      8,
      regular,
      rgb(0.38, 0.43, 0.39)
    )
    cursor.y -= 8
  }

  addPage()
  drawLines([safeText(snapshot.project.name, bold)], 24, bold, rgb(0.09, 0.34, 0.23))
  cursor.y -= 8
  drawLines(
    [
      `Sources: ${snapshot.summary.documentCount}`,
      `Kept entries: ${snapshot.summary.keptCount}`,
      `Maybe entries: ${snapshot.summary.maybeCount}`,
      `Excluded entries: ${snapshot.summary.excludedCount}`,
      `Project updated: ${snapshot.project.updatedAt}`
    ],
    10,
    regular
  )

  heading('Source documents')
  if (snapshot.documents.length === 0) drawLines(['No source documents.'], 10, regular)
  for (const document of snapshot.documents) {
    const metadata = document.metadata
    const styleMetadata = metadata?.styleProfile
    drawLines(
      wrapText(
        `${document.name}${document.pageCount ? ` | ${document.pageCount} pages` : ''}${document.kind ? ` | ${document.kind}` : ''} | imported ${document.importedAt} | ${document.size} bytes`,
        regular,
        10,
        CONTENT_WIDTH
      ),
      10,
      regular
    )
    if (metadata) {
      drawLines(
        wrapText(
          `Source metadata: text ${metadata.textPageCount}, image ${metadata.imagePageCount}, mixed ${metadata.mixedPageCount}, rotated ${metadata.rotatedPageCount}, avg chars/page ${metadata.averageCharactersPerPage}${document.removedPages?.length ? `, removed pages ${document.removedPages.join('/')}` : ''}`,
          regular,
          8,
          CONTENT_WIDTH
        ),
        8,
        regular,
        rgb(0.38, 0.43, 0.39)
      )
    }
    if (styleMetadata) {
      drawLines(
        wrapText(
          `Style profile: ${styleMetadata.textStyleCount} text styles, ${styleMetadata.dividerStyleCount} rules, ${styleMetadata.colourCount} colours, ${styleMetadata.confidence} confidence, ${styleMetadata.warningCount} warnings`,
          regular,
          8,
          CONTENT_WIDTH
        ),
        8,
        regular,
        rgb(0.38, 0.43, 0.39)
      )
    }
  }

  if ((options.metrics ?? []).length > 0) {
    heading('Analysis metrics')
    for (const metric of options.metrics ?? []) {
      const value = metric.value === null ? 'Unavailable' : String(metric.value)
      drawLines(
        wrapText(
          `${metric.label}${metric.group ? ` (${metric.group})` : ''}: ${value} | ${metric.contributorCount} contributors`,
          regular,
          10,
          CONTENT_WIDTH
        ),
        10,
        regular
      )
    }
  }

  heading('Kept entries')
  if (snapshot.sections.kept.length === 0) drawLines(['No kept entries.'], 10, regular)
  snapshot.sections.kept.forEach(drawEntry)

  heading('Maybe - requires review')
  if (snapshot.sections.maybe.length === 0) drawLines(['No Maybe entries.'], 10, regular)
  snapshot.sections.maybe.forEach(drawEntry)

  if (snapshot.sections.excluded) {
    heading('Excluded entries')
    if (snapshot.sections.excluded.length === 0) drawLines(['No excluded entries.'], 10, regular)
    snapshot.sections.excluded.forEach(drawEntry)
  }

  return pdf.save({ useObjectStreams: false })
}

export async function exportProjectSourceLayoutPdf(
  project: ProjectState,
  sourceFiles: ReadonlyMap<string, Uint8Array>
): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  const pageBySource = new Map<string, PDFPage>()
  const pageHeights = new Map<string, number>()
  let sourceMetadata: CollectedSourceMetadata = {}

  for (const document of project.documents) {
    const sourceData = sourceFiles.get(document.path)
    if (!sourceData) throw new Error(`Source PDF is not loaded: ${document.name}`)
    const source = await PDFDocument.load(sourceData)
    sourceMetadata = collectSourceMetadata(sourceMetadata, source)
    const sourcePages = source.getPages()
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach((page, index) => {
      output.addPage(page)
      const key = `${document.id}:${index + 1}`
      pageBySource.set(key, page)
      pageHeights.set(key, sourcePages[index]!.getHeight())
    })
  }

  // Outline maybe/excluded rows with the viewer's status color; kept rows are left untouched.
  for (const entry of project.entries) {
    if (entry.status !== 'maybe' && entry.status !== 'exclude') continue
    const borderColor = STATUS_BORDER_COLOR[entry.status]
    for (const region of entry.regions) {
      const box = region.bbox
      if (!box || box.coordinateSpace !== 'pdf-points') continue
      const key = `${region.documentId}:${region.pageNumber}`
      const page = pageBySource.get(key)
      if (!page) continue

      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        borderColor,
        borderWidth: 1.5
      })
    }
  }

  output.setTitle(project.name)
  output.setSubject('Source-layout PDF with maybe/excluded rows outlined')
  output.setProducer('EXACT EXTRACT')
  output.setCreator('EXACT EXTRACT')
  applySourceMetadata(output, sourceMetadata)
  return output.save({ useObjectStreams: false })
}

export async function exportProjectCompactedSourceLayoutPdf(
  project: ProjectState,
  sourceFiles: ReadonlyMap<string, Uint8Array>
): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  const regular = await output.embedFont(StandardFonts.Helvetica)
  const pageBySource = new Map<string, PDFPage>()
  const pageHeights = new Map<string, number>()
  let sourceMetadata: CollectedSourceMetadata = {}

  for (const document of project.documents) {
    const sourceData = sourceFiles.get(document.path)
    if (!sourceData) throw new Error(`Source PDF is not loaded: ${document.name}`)
    const source = await PDFDocument.load(sourceData)
    sourceMetadata = collectSourceMetadata(sourceMetadata, source)
    const copiedPages = await output.copyPages(source, source.getPageIndices())
    copiedPages.forEach((outputPage, index) => {
      output.addPage(outputPage)
      const key = `${document.id}:${index + 1}`
      pageBySource.set(key, outputPage)
      pageHeights.set(key, outputPage.getHeight())
    })
  }

  // Clear source rows before redrawing retained content at its compacted position.
  for (const entry of project.entries) {
    for (const region of entry.regions) {
      const box = region.bbox
      if (!box || box.coordinateSpace !== 'pdf-points') continue
      const key = `${region.documentId}:${region.pageNumber}`
      const page = pageBySource.get(key)
      if (!page) continue
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1)
      })
    }
  }

  const plannedRows = applyPageForwardCarryover(
    buildCompactSourceRows(
      project.entries,
      18,
      pageHeights,
      (row) => compactTextLayout(row.entry.normalizedText, regular, row.width, row.height).height
    ),
    pageHeights
  )
  for (const row of plannedRows) {
    const page = pageBySource.get(`${row.documentId}:${row.pageNumber}`)
    if (!page) continue
    const layout = compactTextLayout(row.entry.normalizedText, regular, row.width, row.sourceHeight)
    for (const [index, line] of layout.lines.entries()) {
      page.drawText(line, {
        x: row.x,
        y: row.targetY + row.height - layout.size - index * layout.lineHeight,
        size: layout.size,
        font: regular,
        color: rgb(0, 0, 0)
      })
    }
  }

  output.setTitle(project.name)
  output.setSubject('Compacted source-layout PDF with excluded entries hidden')
  output.setProducer('EXACT EXTRACT')
  output.setCreator('EXACT EXTRACT')
  applySourceMetadata(output, sourceMetadata)
  return output.save({ useObjectStreams: false })
}

export async function exportProjectKeptLayoutPdf(
  project: ProjectState,
  sourceFiles: ReadonlyMap<string, Uint8Array>
): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  const regular = await output.embedFont(StandardFonts.Helvetica)
  const bold = await output.embedFont(StandardFonts.HelveticaBold)
  const pageBySource = new Map<string, PDFPage>()
  const sourcePageByKey = new Map<string, PDFPage>()
  const pageHeights = new Map<string, number>()
  let sourceMetadata: CollectedSourceMetadata = {}

  for (const document of project.documents) {
    const sourceData = sourceFiles.get(document.path)
    if (!sourceData) throw new Error(`Source PDF is not loaded: ${document.name}`)
    const source = await PDFDocument.load(sourceData)
    sourceMetadata = collectSourceMetadata(sourceMetadata, source)
    source.getPages().forEach((sourcePage, index) => {
      sourcePageByKey.set(`${document.id}:${index + 1}`, sourcePage)
    })
    const copiedPages = await output.copyPages(source, source.getPageIndices())
    copiedPages.forEach((outputPage, index) => {
      output.addPage(outputPage)
      const key = `${document.id}:${index + 1}`
      pageBySource.set(key, outputPage)
      pageHeights.set(key, outputPage.getHeight())
    })
  }

  // Mask each complete tracked row before restoring kept source crops. Using the unioned row box
  // avoids leaving fragments behind when extraction represented one row with several regions.
  for (const row of prepareCompactSourceRows(project.entries, pageHeights, () => false)) {
    const page = pageBySource.get(`${row.documentId}:${row.pageNumber}`)
    if (!page) continue
    page.drawRectangle({
      x: row.x,
      y: row.sourceY,
      width: row.width,
      height: row.height,
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1)
    })
  }

  // Only 'keep' rows survive compaction; maybe/excluded rows free their space like excluded rows do above.
  const isRemoved = (entry: ProjectEntry): boolean => entry.status !== 'keep'
  const plannedRows = applyPageForwardCarryover(
    buildCompactSourceRows(project.entries, 18, pageHeights, (row) => row.height, isRemoved),
    pageHeights
  )
  const rowsByEntryId = new Map<string, typeof plannedRows>()
  for (const row of plannedRows) {
    const page = pageBySource.get(`${row.documentId}:${row.pageNumber}`)
    const rowsForEntry = rowsByEntryId.get(row.entry.id) ?? []
    rowsForEntry.push(row)
    rowsByEntryId.set(row.entry.id, rowsForEntry)
    if (!page) continue
    const sourceBox = keptEntryBoxes(row.entry).find(
      (box) =>
        box.documentId === row.documentId &&
        box.pageNumber === row.sourcePageNumber &&
        box.x === row.x &&
        box.y === row.sourceY &&
        box.width === row.width
    )
    if (!sourceBox) continue
    const sourcePage = sourcePageByKey.get(`${sourceBox.documentId}:${sourceBox.pageNumber}`)
    if (!sourcePage) continue
    const embedded = await output.embedPage(sourcePage, {
      left: sourceBox.x,
      bottom: sourceBox.y,
      right: sourceBox.x + sourceBox.width,
      top: sourceBox.y + sourceBox.height
    })
    page.drawPage(embedded, {
      x: row.x,
      y: row.targetY,
      width: row.width,
      height: row.height
    })
  }

  // Append one consolidated plain-text & styling summary section after all compacted pages, in date order.
  const keptEntries = project.entries
    .filter((entry) => entry.status === 'keep')
    .map((entry) => {
      const parsed = Date.parse(entry.createdAt)
      return { entry, sortKey: Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed }
    })
    .sort(
      (left, right) => left.sortKey - right.sortKey || left.entry.id.localeCompare(right.entry.id)
    )
    .map(({ entry }) => entry)

  const cursor: PdfCursor = { page: output.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pageNumber: 0, y: 0 }
  const addPage = (): void => {
    if (cursor.pageNumber > 0) cursor.page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    cursor.pageNumber += 1
    cursor.y = PAGE_HEIGHT - MARGIN
    cursor.page.drawText(safeText(project.name, bold), {
      x: MARGIN,
      y: cursor.y,
      size: 9,
      font: bold,
      color: rgb(0.15, 0.3, 0.22)
    })
    cursor.page.drawText(`Page ${cursor.pageNumber}`, {
      x: PAGE_WIDTH - MARGIN - 45,
      y: cursor.y,
      size: 9,
      font: regular,
      color: rgb(0.38, 0.43, 0.39)
    })
    cursor.y -= 28
  }
  const ensure = (height: number): void => {
    if (cursor.y - height < MARGIN) addPage()
  }
  const drawSummaryLine = (
    text: string,
    options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}
  ): void => {
    const size = options.size ?? 9
    const font = options.bold ? bold : regular
    const color = options.color ?? rgb(0.12, 0.15, 0.13)
    const lineHeight = size * 1.35
    const lines = wrapText(text, font, size, CONTENT_WIDTH)
    ensure(lines.length * lineHeight)
    for (const line of lines) {
      cursor.page.drawText(line, { x: MARGIN, y: cursor.y, size, font, color })
      cursor.y -= lineHeight
    }
  }

  addPage()
  cursor.page.drawText(safeText('Kept entries (date order) & styling summary', bold), {
    x: MARGIN,
    y: cursor.y,
    size: 15,
    font: bold,
    color: rgb(0.09, 0.34, 0.23)
  })
  cursor.y -= 22
  drawSummaryLine(
    'The pages above keep every kept row in its original table position and column width, with ' +
      'maybe/excluded rows removed and later rows shifted up to fill the gap. Each kept row is ' +
      'copied from the source PDF, preserving its original glyphs rather than redrawing it in ' +
      "this export's font. Exact source and target positions are reported below for traceability.",
    { size: 8, color: rgb(0.38, 0.43, 0.39) }
  )
  cursor.y -= 10

  if (keptEntries.length === 0) drawSummaryLine('No kept entries.')

  for (const entry of keptEntries) {
    drawSummaryLine(entry.normalizedText, { bold: true, size: 10 })
    const rows = rowsByEntryId.get(entry.id) ?? []
    if (rows.length === 0) {
      drawSummaryLine(
        'Position: unavailable (no pdf-points source region recorded for this entry).',
        { size: 8, color: rgb(0.38, 0.43, 0.39) }
      )
    } else {
      for (const row of rows) {
        drawSummaryLine(
          `document=${row.documentId} page=${row.pageNumber} x=${row.x.toFixed(1)}pt ` +
            `y=${row.targetY.toFixed(1)}pt w=${row.width.toFixed(1)}pt h=${row.height.toFixed(1)}pt ` +
            'font=source-preserved',
          { size: 8, color: rgb(0.38, 0.43, 0.39) }
        )
      }
    }
    cursor.y -= 6
  }

  output.setTitle(project.name)
  output.setSubject('Kept-only compacted layout PDF with a trailing styling summary')
  output.setProducer('EXACT EXTRACT')
  output.setCreator('EXACT EXTRACT')
  applySourceMetadata(output, sourceMetadata)
  return output.save({ useObjectStreams: false })
}

interface KeptEntryBox {
  documentId: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

// Unions same-page pdf-points regions per entry so multi-region rows crop as a single block.
function keptEntryBoxes(entry: ProjectEntry): KeptEntryBox[] {
  const byPage = new Map<
    string,
    {
      documentId: string
      pageNumber: number
      boxes: NonNullable<ProjectEntry['regions'][number]['bbox']>[]
    }
  >()
  for (const region of entry.regions) {
    const box = region.bbox
    if (!box || box.coordinateSpace !== 'pdf-points') continue
    const key = `${region.documentId}:${region.pageNumber}`
    const bucket = byPage.get(key) ?? {
      documentId: region.documentId,
      pageNumber: region.pageNumber,
      boxes: []
    }
    bucket.boxes.push(box)
    byPage.set(key, bucket)
  }
  return [...byPage.values()]
    .sort(
      (left, right) =>
        left.documentId.localeCompare(right.documentId) || left.pageNumber - right.pageNumber
    )
    .map(({ documentId, pageNumber, boxes }) => {
      const left = Math.min(...boxes.map((box) => box.x))
      const bottom = Math.min(...boxes.map((box) => box.y))
      const right = Math.max(...boxes.map((box) => box.x + box.width))
      const top = Math.max(...boxes.map((box) => box.y + box.height))
      return {
        documentId,
        pageNumber,
        x: left,
        y: bottom,
        width: right - left,
        height: top - bottom
      }
    })
}

export async function exportProjectKeptEntriesPdf(
  project: ProjectState,
  sourceFiles: ReadonlyMap<string, Uint8Array>
): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  const regular = await output.embedFont(StandardFonts.Helvetica)
  const bold = await output.embedFont(StandardFonts.HelveticaBold)
  const sourcePages = new Map<string, PDFPage>()
  const loadedDocumentIds = new Set<string>()
  let sourceMetadata: CollectedSourceMetadata = {}

  const loadSourcePages = async (documentId: string): Promise<void> => {
    if (loadedDocumentIds.has(documentId)) return
    loadedDocumentIds.add(documentId)
    const document = project.documents.find((candidate) => candidate.id === documentId)
    const sourceData = document && sourceFiles.get(document.path)
    if (!sourceData) return
    const source = await PDFDocument.load(sourceData)
    sourceMetadata = collectSourceMetadata(sourceMetadata, source)
    source.getPages().forEach((page, index) => {
      sourcePages.set(`${documentId}:${index + 1}`, page)
    })
  }

  const keptEntries = project.entries
    .filter((entry) => entry.status === 'keep')
    .map((entry) => {
      const parsed = Date.parse(entry.createdAt)
      return { entry, sortKey: Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed }
    })
    .sort(
      (left, right) => left.sortKey - right.sortKey || left.entry.id.localeCompare(right.entry.id)
    )
    .map(({ entry }) => entry)

  for (const entry of keptEntries) {
    for (const region of entry.regions) {
      if (region.bbox?.coordinateSpace === 'pdf-points') await loadSourcePages(region.documentId)
    }
  }

  const cursor: PdfCursor = { page: output.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pageNumber: 0, y: 0 }
  const addPage = (): void => {
    if (cursor.pageNumber > 0) cursor.page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    cursor.pageNumber += 1
    cursor.y = PAGE_HEIGHT - MARGIN
    cursor.page.drawText(safeText(project.name, bold), {
      x: MARGIN,
      y: cursor.y,
      size: 9,
      font: bold,
      color: rgb(0.15, 0.3, 0.22)
    })
    cursor.page.drawText(`Page ${cursor.pageNumber}`, {
      x: PAGE_WIDTH - MARGIN - 45,
      y: cursor.y,
      size: 9,
      font: regular,
      color: rgb(0.38, 0.43, 0.39)
    })
    cursor.y -= 28
  }
  const ensure = (height: number): void => {
    if (cursor.y - height < MARGIN) addPage()
  }
  const drawFallbackText = (text: string): void => {
    const size = 10
    const lineHeight = size * 1.35
    const lines = wrapText(text, regular, size, CONTENT_WIDTH)
    ensure(lines.length * lineHeight + 8)
    for (const line of lines) {
      cursor.page.drawText(line, {
        x: MARGIN,
        y: cursor.y,
        size,
        font: regular,
        color: rgb(0.12, 0.15, 0.13)
      })
      cursor.y -= lineHeight
    }
    cursor.y -= 8
  }

  addPage()
  cursor.page.drawText(safeText('Kept entries (date order)', bold), {
    x: MARGIN,
    y: cursor.y,
    size: 15,
    font: bold,
    color: rgb(0.09, 0.34, 0.23)
  })
  cursor.y -= 26

  if (keptEntries.length === 0) drawFallbackText('No kept entries.')

  for (const entry of keptEntries) {
    const boxes = keptEntryBoxes(entry)
    if (boxes.length === 0) {
      drawFallbackText(entry.normalizedText)
      continue
    }
    for (const box of boxes) {
      const sourcePage = sourcePages.get(`${box.documentId}:${box.pageNumber}`)
      if (!sourcePage || box.width <= 0 || box.height <= 0) {
        drawFallbackText(entry.normalizedText)
        continue
      }
      const embedded = await output.embedPage(sourcePage, {
        left: box.x,
        bottom: box.y,
        right: box.x + box.width,
        top: box.y + box.height
      })
      const scale = Math.min(1, CONTENT_WIDTH / box.width)
      const drawWidth = box.width * scale
      const drawHeight = box.height * scale
      ensure(drawHeight + 10)
      cursor.page.drawPage(embedded, {
        x: MARGIN,
        y: cursor.y - drawHeight,
        width: drawWidth,
        height: drawHeight
      })
      cursor.y -= drawHeight + 10
    }
  }

  // Plain-text listing with layout metadata, since the visual crop above can be hard to read for some sources.
  const drawSummaryLine = (
    text: string,
    options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}
  ): void => {
    const size = options.size ?? 9
    const font = options.bold ? bold : regular
    const color = options.color ?? rgb(0.12, 0.15, 0.13)
    const lineHeight = size * 1.35
    const lines = wrapText(text, font, size, CONTENT_WIDTH)
    ensure(lines.length * lineHeight)
    for (const line of lines) {
      cursor.page.drawText(line, { x: MARGIN, y: cursor.y, size, font, color })
      cursor.y -= lineHeight
    }
  }

  addPage()
  cursor.page.drawText(safeText('Plain text & styling summary', bold), {
    x: MARGIN,
    y: cursor.y,
    size: 15,
    font: bold,
    color: rgb(0.09, 0.34, 0.23)
  })
  cursor.y -= 22
  drawSummaryLine(
    "Font notes: the crops above reuse each source page's own embedded glyphs exactly as shown in " +
      'the previewer. Per-character font family/weight/size is not extracted by this app, so it cannot be ' +
      'reported below. Position (x, y) is bottom-left, in pdf-points, relative to the source page; ' +
      'w/h is the source region size; scale is how much this export shrank it to fit the page width.',
    { size: 8, color: rgb(0.38, 0.43, 0.39) }
  )
  cursor.y -= 10

  if (keptEntries.length === 0) drawSummaryLine('No kept entries.')

  for (const entry of keptEntries) {
    drawSummaryLine(entry.normalizedText, { bold: true, size: 10 })
    const boxes = keptEntryBoxes(entry)
    if (boxes.length === 0) {
      drawSummaryLine(
        'Position: unavailable (no pdf-points source region recorded for this entry).',
        { size: 8, color: rgb(0.38, 0.43, 0.39) }
      )
    } else {
      for (const box of boxes) {
        const scale = Math.min(1, CONTENT_WIDTH / box.width)
        const scalePercent = Math.round(scale * 1000) / 10
        drawSummaryLine(
          `document=${box.documentId} page=${box.pageNumber} x=${box.x.toFixed(1)}pt y=${box.y.toFixed(1)}pt ` +
            `w=${box.width.toFixed(1)}pt h=${box.height.toFixed(1)}pt scale=${scalePercent}%`,
          { size: 8, color: rgb(0.38, 0.43, 0.39) }
        )
      }
    }
    cursor.y -= 6
  }

  output.setTitle(project.name)
  output.setSubject('Kept entries in date order, reproduced from the original source pages')
  output.setProducer('EXACT EXTRACT')
  output.setCreator('EXACT EXTRACT')
  applySourceMetadata(output, sourceMetadata)
  return output.save({ useObjectStreams: false })
}

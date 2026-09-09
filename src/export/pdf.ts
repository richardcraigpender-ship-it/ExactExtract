import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ProjectState } from '../shared/contracts'
import { buildExportSnapshot } from './snapshot'
import type { ExportEntry, PdfExportOptions } from './types'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 54
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

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

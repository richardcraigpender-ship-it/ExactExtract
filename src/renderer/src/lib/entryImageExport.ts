import { pdfjs } from 'react-pdf'
import { buildEntryImageCrops } from '../../../export'
import type { ProjectState } from '../../../shared/contracts'

export interface EntryPngFile {
  name: string
  content: string
  entryId?: string
}

export async function generateEntryPngFiles(
  project: ProjectState,
  readPdf: (path: string) => Promise<Uint8Array>,
  scale = 2
): Promise<EntryPngFile[]> {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Image export scale must be positive.')
  const crops = buildEntryImageCrops(project.entries)
  const documentsById = new Map(project.documents.map((document) => [document.id, document]))
  type LoadedPdf = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  const loadedPdfs = new Map<string, LoadedPdf>()
  const renderedPages = new Map<string, HTMLCanvasElement>()

  const loadPdf = async (documentId: string): Promise<LoadedPdf> => {
    const cached = loadedPdfs.get(documentId)
    if (cached) return cached
    const document = documentsById.get(documentId)
    if (!document)
      throw new Error(`Source document is unavailable for entry image export: ${documentId}`)
    const data = await readPdf(document.path)
    const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
    loadedPdfs.set(documentId, pdf)
    return pdf
  }

  try {
    const files: EntryPngFile[] = []
    for (const crop of crops) {
      const pageKey = `${crop.documentId}:${crop.pageNumber}`
      const pdf = await loadPdf(crop.documentId)
      const page = await pdf.getPage(crop.pageNumber)
      const viewport = page.getViewport({ scale })
      let sourceCanvas = renderedPages.get(pageKey)
      if (!sourceCanvas) {
        sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = Math.ceil(viewport.width)
        sourceCanvas.height = Math.ceil(viewport.height)
        const sourceContext = sourceCanvas.getContext('2d')
        if (!sourceContext) throw new Error('A 2D canvas context is required for image export.')
        await page.render({ canvas: sourceCanvas, canvasContext: sourceContext, viewport }).promise
        renderedPages.set(pageKey, sourceCanvas)
      }

      const [firstX, firstY, secondX, secondY] = viewport.convertToViewportRectangle([
        crop.x,
        crop.y,
        crop.x + crop.width,
        crop.y + crop.height
      ])
      const sourceX = Math.min(firstX, secondX)
      const sourceY = Math.min(firstY, secondY)
      const sourceWidth = Math.abs(secondX - firstX)
      const sourceHeight = Math.abs(secondY - firstY)
      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = Math.max(1, Math.round(sourceWidth))
      outputCanvas.height = Math.max(1, Math.round(sourceHeight))
      const outputContext = outputCanvas.getContext('2d')
      if (!outputContext) throw new Error('A 2D canvas context is required for image export.')
      outputContext.fillStyle = '#fff'
      outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height)
      outputContext.drawImage(
        sourceCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height
      )
      files.push({
        name: crop.fileName,
        entryId: crop.entryId,
        content: outputCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
      })
    }
    return files
  } finally {
    await Promise.all([...loadedPdfs.values()].map((pdf) => pdf.destroy()))
  }
}

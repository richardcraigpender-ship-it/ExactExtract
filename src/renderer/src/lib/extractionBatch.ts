import type { OcrOrchestrationProgress } from '../../../ocr'

export interface ExtractionBatchDocument {
  id: string
  name: string
  path: string
}

export interface ExtractionBatchProgress {
  document: ExtractionBatchDocument
  documentIndex: number
  documentCount: number
  documentProgress: number
  overallProgress: number
  ocr?: OcrOrchestrationProgress
}

interface ExtractionBatchOptions<Result> {
  signal?: AbortSignal
  extract: (
    document: ExtractionBatchDocument,
    onProgress: (progress: OcrOrchestrationProgress) => void
  ) => Promise<Result>
  onDocumentStart?: (document: ExtractionBatchDocument, index: number) => void
  onProgress?: (progress: ExtractionBatchProgress) => void
}

export class ExtractionBatchError<Result> extends Error {
  readonly completedResults: readonly Result[]
  readonly failedDocument: ExtractionBatchDocument

  constructor(
    failedDocument: ExtractionBatchDocument,
    completedResults: readonly Result[],
    cause: unknown
  ) {
    const detail = cause instanceof Error ? cause.message : 'Unknown extraction failure.'
    super(`Extraction failed for ${failedDocument.name}: ${detail}`, { cause })
    this.name = 'ExtractionBatchError'
    this.failedDocument = failedDocument
    this.completedResults = [...completedResults]
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Extraction cancelled.', 'AbortError')
}

export async function runExtractionBatch<Result>(
  documents: readonly ExtractionBatchDocument[],
  options: ExtractionBatchOptions<Result>
): Promise<Result[]> {
  const completedResults: Result[] = []
  for (const [documentIndex, document] of documents.entries()) {
    throwIfCancelled(options.signal)
    options.onDocumentStart?.(document, documentIndex)
    try {
      const result = await options.extract(document, (ocr) => {
        const documentProgress = Math.max(0, Math.min(1, ocr.progress))
        options.onProgress?.({
          document,
          documentIndex,
          documentCount: documents.length,
          documentProgress,
          overallProgress:
            documents.length === 0 ? 1 : (documentIndex + documentProgress) / documents.length,
          ocr
        })
      })
      throwIfCancelled(options.signal)
      completedResults.push(result)
      options.onProgress?.({
        document,
        documentIndex,
        documentCount: documents.length,
        documentProgress: 1,
        overallProgress: (documentIndex + 1) / documents.length
      })
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw error
      }
      throw new ExtractionBatchError(document, completedResults, error)
    }
  }
  return completedResults
}

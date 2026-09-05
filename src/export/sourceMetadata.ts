import { PDFDocument } from 'pdf-lib'
import type { ProjectDocument } from '../shared/contracts'

export interface CollectedSourceMetadata {
  author?: string
  keywords?: string
  creationDate?: Date
}

/** First non-empty value wins, so metadata from the earliest source document takes precedence. */
export function collectSourceMetadata(
  current: CollectedSourceMetadata,
  source: PDFDocument
): CollectedSourceMetadata {
  return {
    author: current.author ?? source.getAuthor(),
    keywords: current.keywords ?? source.getKeywords(),
    creationDate: current.creationDate ?? source.getCreationDate()
  }
}

export function applySourceMetadata(output: PDFDocument, metadata: CollectedSourceMetadata): void {
  if (metadata.author) output.setAuthor(metadata.author)
  if (metadata.keywords) output.setKeywords([metadata.keywords])
  if (metadata.creationDate) output.setCreationDate(metadata.creationDate)
}

/**
 * Reads Author/Keywords/CreationDate only, for exports that never load full source page content.
 * Missing/unreadable source bytes are skipped rather than failing the export.
 */
export async function loadSourceMetadata(
  documents: readonly Pick<ProjectDocument, 'path'>[],
  sourceFiles: ReadonlyMap<string, Uint8Array>
): Promise<CollectedSourceMetadata> {
  let metadata: CollectedSourceMetadata = {}
  for (const document of documents) {
    const sourceData = sourceFiles.get(document.path)
    if (!sourceData) continue
    try {
      const source = await PDFDocument.load(sourceData, { updateMetadata: false })
      metadata = collectSourceMetadata(metadata, source)
    } catch {
      continue
    }
  }
  return metadata
}

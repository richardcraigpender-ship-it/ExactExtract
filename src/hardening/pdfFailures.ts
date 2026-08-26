export const DEFAULT_PDF_LIMITS = {
  maxFileBytes: 250 * 1024 * 1024,
  maxPageCount: 2_000,
  maxDocumentsPerProject: 50
} as const

export type PdfFailureCode =
  | 'encrypted'
  | 'corrupt'
  | 'oversized'
  | 'too-many-pages'
  | 'too-many-documents'
  | 'missing-source'
  | 'unsupported'
  | 'unknown'

export interface PdfFailure {
  code: PdfFailureCode
  title: string
  message: string
  recoverable: boolean
}

export function validatePdfLimits(
  size: number,
  pageCount?: number,
  limits = DEFAULT_PDF_LIMITS
): PdfFailure | null {
  if (!Number.isFinite(size) || size < 0) return failure('corrupt')
  if (size > limits.maxFileBytes) return failure('oversized')
  if (pageCount !== undefined && pageCount > limits.maxPageCount) return failure('too-many-pages')
  return null
}

export interface PdfImportCandidate {
  path: string
  size: number
}

export function validatePdfImportBatch(
  existingPaths: readonly string[],
  incoming: readonly PdfImportCandidate[],
  limits = DEFAULT_PDF_LIMITS
): PdfFailure | null {
  const knownPaths = new Set(existingPaths)
  let uniqueDocumentCount = knownPaths.size

  for (const document of incoming) {
    const fileFailure = validatePdfLimits(document.size, undefined, limits)
    if (fileFailure) return fileFailure
    if (knownPaths.has(document.path)) continue
    knownPaths.add(document.path)
    uniqueDocumentCount += 1
  }

  if (uniqueDocumentCount > limits.maxDocumentsPerProject) {
    return failure('too-many-documents')
  }
  return null
}

export function classifyPdfFailure(error: unknown): PdfFailure {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  const normalized = text.toLocaleLowerCase()
  if (/password|encrypted|passwordexception/.test(normalized)) return failure('encrypted')
  if (/enoent|not found|missing source|no such file/.test(normalized))
    return failure('missing-source')
  if (/invalid pdf|corrupt|malformed|unexpected response/.test(normalized))
    return failure('corrupt')
  if (/unsupported|not implemented|format/.test(normalized)) return failure('unsupported')
  return failure('unknown', error instanceof Error ? error.message : undefined)
}

function failure(code: PdfFailureCode, detail?: string): PdfFailure {
  const messages: Record<PdfFailureCode, Omit<PdfFailure, 'code'>> = {
    encrypted: {
      title: 'Password-protected PDF',
      message:
        'Unlock this PDF in another application, save an unprotected copy, and import it again.',
      recoverable: true
    },
    corrupt: {
      title: 'Unreadable PDF',
      message: 'The PDF is damaged or incomplete. Try downloading or exporting a fresh copy.',
      recoverable: true
    },
    oversized: {
      title: 'PDF is too large',
      message:
        'This beta supports PDF files up to 250 MB. Split or compress the document before importing.',
      recoverable: true
    },
    'too-many-pages': {
      title: 'PDF has too many pages',
      message: 'This beta supports up to 2,000 pages per PDF. Split the document before importing.',
      recoverable: true
    },
    'too-many-documents': {
      title: 'Project has too many PDFs',
      message:
        'This beta supports up to 50 source PDFs per project. Remove a source or import these PDFs into another project.',
      recoverable: true
    },
    'missing-source': {
      title: 'Source PDF is unavailable',
      message: 'Locate the moved file or restore it to its original path before continuing.',
      recoverable: true
    },
    unsupported: {
      title: 'Unsupported PDF',
      message: 'This PDF uses features the current extraction engine cannot process.',
      recoverable: false
    },
    unknown: {
      title: 'PDF processing failed',
      message:
        detail?.trim() || 'The PDF could not be processed. Retry or inspect the application logs.',
      recoverable: true
    }
  }
  return { code, ...messages[code] }
}

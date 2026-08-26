import { basename, extname } from 'path'

export type ExportFormat =
  | 'csv'
  | 'json'
  | 'pdf'
  | 'pdf-layout'
  | 'pdf-compact'
  | 'pdf-kept'
  | 'pdf-kept-layout'
  | 'pdf-kept-canvas'

export interface ExportSaveRequest {
  format: ExportFormat
  suggestedName: string
  content: string
}

export interface ExportDialogOptions {
  title: string
  defaultPath: string
  filterName: string
  extension: 'csv' | 'json' | 'pdf'
  showOverwriteConfirmation: true
}

export type ExportSaveResult = { status: 'cancelled' } | { status: 'saved'; path: string }

const MAX_EXPORT_BYTES = 50 * 1024 * 1024

function sanitizeFileStem(value: string): string {
  return [...value]
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character
    )
    .join('')
    .trim()
}

export function validateExportRequest(value: unknown): ExportSaveRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Export request is required.')
  const request = value as Record<string, unknown>
  if (
    request.format !== 'csv' &&
    request.format !== 'json' &&
    request.format !== 'pdf' &&
    request.format !== 'pdf-layout' &&
    request.format !== 'pdf-compact' &&
    request.format !== 'pdf-kept' &&
    request.format !== 'pdf-kept-layout' &&
    request.format !== 'pdf-kept-canvas'
  ) {
    throw new Error('Export format must be csv, json, or pdf.')
  }
  if (typeof request.suggestedName !== 'string' || request.suggestedName.trim().length === 0) {
    throw new Error('Export filename is required.')
  }
  if (typeof request.content !== 'string') throw new Error('Export content must be text.')
  if (Buffer.byteLength(request.content, 'utf8') > MAX_EXPORT_BYTES) {
    throw new Error('Export content exceeds the 50 MB limit.')
  }
  const safeStem = sanitizeFileStem(basename(request.suggestedName, extname(request.suggestedName)))
  if (!safeStem) throw new Error('Export filename is invalid.')
  return {
    format: request.format,
    suggestedName: `${safeStem}.${request.format === 'pdf' || request.format.startsWith('pdf-') ? 'pdf' : request.format}`,
    content: request.content
  }
}

export async function saveExportRequest(
  value: unknown,
  showDialog: (options: ExportDialogOptions) => Promise<{ canceled: boolean; filePath?: string }>,
  write: (path: string, content: string | Uint8Array) => Promise<void>
): Promise<ExportSaveResult> {
  const request = validateExportRequest(value)
  const pdfBuffer =
    request.format === 'pdf' || request.format.startsWith('pdf-')
      ? Buffer.from(request.content, 'base64')
      : undefined
  if (pdfBuffer && !pdfBuffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error('PDF export content is invalid.')
  }
  const filterName =
    request.format === 'csv'
      ? 'CSV document'
      : request.format === 'json'
        ? 'JSON document'
        : 'PDF document'
  const extension: 'csv' | 'json' | 'pdf' =
    request.format === 'csv' ? 'csv' : request.format === 'json' ? 'json' : 'pdf'
  const result = await showDialog({
    title: `Export ${request.format.toUpperCase()}`,
    defaultPath: request.suggestedName,
    filterName,
    extension,
    showOverwriteConfirmation: true
  })
  if (result.canceled || !result.filePath) return { status: 'cancelled' }
  const path =
    extname(result.filePath).toLowerCase() === `.${extension}`
      ? result.filePath
      : `${result.filePath}.${extension}`
  await write(path, pdfBuffer ?? request.content)
  return { status: 'saved', path }
}

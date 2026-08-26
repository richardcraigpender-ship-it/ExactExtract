import { basename, join } from 'node:path'

export interface EntryImageSaveRequest {
  suggestedFolderName: string
  files: Array<{ name: string; content: string }>
}

export type EntryImageSaveResult =
  { status: 'cancelled' } | { status: 'saved'; path: string; fileCount: number }

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_FILE_COUNT = 2_000
const MAX_TOTAL_BYTES = 250 * 1024 * 1024

function safeStem(value: string): string {
  return [...value]
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character
    )
    .join('')
    .trim()
}

export function validateEntryImageSaveRequest(value: unknown): EntryImageSaveRequest {
  if (typeof value !== 'object' || value === null)
    throw new Error('Image export request is required.')
  const request = value as Record<string, unknown>
  if (typeof request.suggestedFolderName !== 'string')
    throw new Error('Export folder name is required.')
  const suggestedFolderName = safeStem(request.suggestedFolderName)
  if (!suggestedFolderName) throw new Error('Export folder name is invalid.')
  if (!Array.isArray(request.files) || request.files.length === 0) {
    throw new Error('At least one PNG entry image is required.')
  }
  if (request.files.length > MAX_FILE_COUNT)
    throw new Error('Image export contains too many files.')

  const names = new Set<string>()
  let totalBytes = 0
  const files = request.files.map((value) => {
    if (typeof value !== 'object' || value === null) throw new Error('Entry image is invalid.')
    const file = value as Record<string, unknown>
    if (
      typeof file.name !== 'string' ||
      basename(file.name) !== file.name ||
      !file.name.toLowerCase().endsWith('.png')
    ) {
      throw new Error('Entry image filename must be a local PNG filename.')
    }
    if (names.has(file.name.toLowerCase())) throw new Error('Entry image filenames must be unique.')
    names.add(file.name.toLowerCase())
    if (typeof file.content !== 'string') throw new Error('Entry image content must be base64.')
    const content = Buffer.from(file.content, 'base64')
    if (!content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error('Entry image content is not a PNG.')
    }
    totalBytes += content.byteLength
    return { name: file.name, content: file.content }
  })
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Image export exceeds the 250 MB limit.')
  return { suggestedFolderName, files }
}

export async function saveEntryImageRequest(
  value: unknown,
  chooseParent: () => Promise<{ canceled: boolean; filePaths: string[] }>,
  createDirectory: (path: string) => Promise<void>,
  write: (path: string, content: Uint8Array) => Promise<void>
): Promise<EntryImageSaveResult> {
  const request = validateEntryImageSaveRequest(value)
  const selected = await chooseParent()
  if (selected.canceled || !selected.filePaths[0]) return { status: 'cancelled' }

  let folderPath = join(selected.filePaths[0], request.suggestedFolderName)
  for (let suffix = 2; ; suffix += 1) {
    try {
      await createDirectory(folderPath)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || suffix > 999) throw error
      folderPath = join(selected.filePaths[0], `${request.suggestedFolderName} (${suffix})`)
    }
  }
  await Promise.all(
    request.files.map((file) =>
      write(join(folderPath, file.name), Buffer.from(file.content, 'base64'))
    )
  )
  return { status: 'saved', path: folderPath, fileCount: request.files.length }
}

import { resolve, relative, isAbsolute } from 'path'

import { OCR_ASSET_HOST, OCR_ASSET_SCHEME } from '../shared/ocrAssets'

export function resolveOcrAssetPath(assetRoot: string, requestUrl: string): string {
  const url = new URL(requestUrl)
  if (url.protocol !== `${OCR_ASSET_SCHEME}:` || url.hostname !== OCR_ASSET_HOST) {
    throw new Error('Invalid OCR asset URL.')
  }

  const requestedPath = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '')
  const resolvedRoot = resolve(assetRoot)
  const resolvedPath = resolve(resolvedRoot, requestedPath)
  const relativePath = relative(resolvedRoot, resolvedPath)
  if (relativePath.length === 0 || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Invalid OCR asset path.')
  }
  return resolvedPath
}

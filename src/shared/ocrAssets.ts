export const OCR_ASSET_SCHEME = 'exact-extract-ocr'
export const OCR_ASSET_HOST = 'assets'
export const OCR_ASSET_BASE_URL = `${OCR_ASSET_SCHEME}://${OCR_ASSET_HOST}`

export const OCR_WORKER_URL = `${OCR_ASSET_BASE_URL}/worker.min.js`
export const OCR_CORE_URL = `${OCR_ASSET_BASE_URL}/core`
export const OCR_LANGUAGE_DATA_URL = `${OCR_ASSET_BASE_URL}/tessdata`

export function getOcrLanguageAssetUrl(language: string): string {
  return `${OCR_LANGUAGE_DATA_URL}/${language}.traineddata.gz`
}

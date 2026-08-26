import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createWorker } from 'tesseract.js'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const languageDataPath = join(projectRoot, 'src', 'renderer', 'public', 'ocr', 'tessdata')
const languages = ['eng', 'spa', 'fra', 'deu']
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

for (const language of languages) {
  await access(join(languageDataPath, `${language}.traineddata.gz`))
  const statuses = new Set()
  const worker = await createWorker(language, undefined, {
    langPath: languageDataPath,
    cacheMethod: 'none',
    logger: ({ status }) => statuses.add(status)
  })

  try {
    if (!statuses.has('loading language traineddata') || !statuses.has('initializing api')) {
      throw new Error(`Unexpected ${language} worker startup stages: ${[...statuses].join(', ')}`)
    }
    if (language === 'eng') await worker.recognize(onePixelPng)
    console.log(`Offline OCR worker initialized from bundled ${language} data.`)
  } finally {
    await worker.terminate()
  }
}

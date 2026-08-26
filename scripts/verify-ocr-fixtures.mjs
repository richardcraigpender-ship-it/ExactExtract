import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCanvas } from '@napi-rs/canvas'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createWorker } from 'tesseract.js'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureRoot = join(projectRoot, 'test-data', 'fixtures')
const manifestPath = join(projectRoot, 'test-data', 'manifests', 'pdf-acceptance.json')
const languageDataPath = join(projectRoot, 'src', 'renderer', 'public', 'ocr', 'tessdata')
const standardFontDataUrl = `${join(
  projectRoot,
  'node_modules',
  'pdfjs-dist',
  'standard_fonts'
).replaceAll('\\', '/')}/`
const imageOperators = new Set([
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask
])

const cases = [
  {
    id: 'scanned-invoice',
    fileName: 'ocr-scanned-invoice.pdf',
    expectedRotation: 0,
    expectedDigitalText: false,
    expectedOcr: [/SCANNED INVOICE/i, /TOTAL DUE/i]
  },
  {
    id: 'mixed-statement',
    fileName: 'ocr-mixed-statement.pdf',
    expectedRotation: 0,
    expectedDigitalText: true,
    expectedOcr: [/SCANNED STATEMENT/i, /BALANCE DUE/i]
  },
  {
    id: 'rotated-form',
    fileName: 'ocr-rotated-form.pdf',
    expectedRotation: 90,
    expectedDigitalText: false,
    expectedOcr: [/ROTATED FORM/i, /REFERENCE GAMMA/i]
  }
]

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
for (const fixture of cases) {
  const manifestCase = manifest.cases?.find((candidate) => candidate.id === fixture.id)
  if (manifestCase?.fixture !== `../fixtures/${fixture.fileName}`) {
    throw new Error(`Acceptance manifest does not map ${fixture.id} to ${fixture.fileName}.`)
  }
}

const worker = await createWorker('eng', undefined, {
  langPath: languageDataPath,
  cacheMethod: 'none'
})

try {
  for (const fixture of cases) {
    const bytes = new Uint8Array(await readFile(join(fixtureRoot, fixture.fileName)))
    const pdf = await getDocument({ data: bytes, disableWorker: true, standardFontDataUrl }).promise
    try {
      const page = await pdf.getPage(1)
      const content = await page.getTextContent()
      const digitalText = content.items
        .flatMap((item) => ('str' in item ? [item.str] : []))
        .join(' ')
        .trim()
      const operators = await page.getOperatorList()
      const imageCount = operators.fnArray.filter((operator) => imageOperators.has(operator)).length
      if (Boolean(digitalText) !== fixture.expectedDigitalText) {
        throw new Error(
          `${fixture.fileName} has unexpected digital text: ${digitalText || '<none>'}`
        )
      }
      if (imageCount === 0) throw new Error(`${fixture.fileName} contains no raster image.`)
      if (page.rotate !== fixture.expectedRotation) {
        throw new Error(
          `${fixture.fileName} rotation is ${page.rotate}; expected ${fixture.expectedRotation}.`
        )
      }

      const viewport = page.getViewport({ scale: 2, rotation: page.rotate })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const result = await worker.recognize(canvas.toBuffer('image/png'))
      const recognizedText = result.data.text.replace(/\s+/g, ' ').trim()
      for (const expectation of fixture.expectedOcr) {
        if (!expectation.test(recognizedText)) {
          throw new Error(
            `${fixture.fileName} did not match ${expectation}: ${recognizedText || '<none>'}`
          )
        }
      }
      console.log(
        `${fixture.fileName}: ${imageCount} image(s), rotation ${page.rotate}, OCR accepted.`
      )
    } finally {
      await pdf.destroy()
    }
  }
} finally {
  await worker.terminate()
}

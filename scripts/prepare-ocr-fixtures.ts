import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCanvas } from '@napi-rs/canvas'
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureRoot = join(projectRoot, 'test-data', 'fixtures')
const pageWidth = 612
const pageHeight = 792

interface InvoiceImageLines {
  title: string
  reference: string
  customer: string
  item: string
  total: string
}

function invoiceImage(lines: InvoiceImageLines): Buffer {
  const canvas = createCanvas(1224, 1584)
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#111111'
  context.textBaseline = 'top'
  context.font = 'bold 64px Arial'
  context.fillText(lines.title, 96, 110)
  context.font = '38px Arial'
  context.fillText(lines.reference, 96, 250)
  context.fillText(lines.customer, 96, 330)
  context.strokeStyle = '#111111'
  context.lineWidth = 4
  context.strokeRect(88, 450, 1048, 430)
  context.font = 'bold 42px Arial'
  context.fillText(lines.item, 120, 510)
  context.font = '40px Arial'
  context.fillText('Consulting services', 120, 610)
  context.fillText('Quantity 1', 120, 700)
  context.font = 'bold 48px Arial'
  context.fillText(lines.total, 120, 790)
  context.font = '34px Arial'
  context.fillText('Thank you for your business', 96, 1030)
  return canvas.toBuffer('image/png')
}

async function imageOnlyPdf(imageBytes: Uint8Array, rotation = 0): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const page = document.addPage([pageWidth, pageHeight])
  const image = await document.embedPng(imageBytes)
  if (rotation === 90) {
    page.setRotation(degrees(90))
    page.drawImage(image, {
      x: pageWidth,
      y: 0,
      width: pageHeight,
      height: pageWidth,
      rotate: degrees(90)
    })
  } else {
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
  }
  return document.save()
}

async function mixedPdf(imageBytes: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const page = document.addPage([pageWidth, pageHeight])
  const font = await document.embedFont(StandardFonts.HelveticaBold)
  page.drawText('ACCOUNT STATEMENT AUGUST 2026', { x: 54, y: 742, size: 18, font })
  const image = await document.embedPng(imageBytes)
  page.drawImage(image, { x: 54, y: 70, width: 504, height: 640 })
  return document.save()
}

async function main(): Promise<void> {
  await mkdir(fixtureRoot, { recursive: true })

  const scanned = invoiceImage({
    title: 'SCANNED INVOICE',
    reference: 'REFERENCE ALPHA 2048',
    customer: 'CUSTOMER NORTH STREET',
    item: 'LINE ITEM ALPHA',
    total: 'TOTAL DUE 42.50'
  })
  const mixed = invoiceImage({
    title: 'SCANNED STATEMENT BODY',
    reference: 'REFERENCE BETA 4096',
    customer: 'CUSTOMER WEST AVENUE',
    item: 'LINE ITEM BETA',
    total: 'BALANCE DUE 84.25'
  })
  const rotated = invoiceImage({
    title: 'ROTATED FORM',
    reference: 'REFERENCE GAMMA 8192',
    customer: 'CUSTOMER EAST ROAD',
    item: 'FORM FIELD GAMMA',
    total: 'FORM TOTAL 21.75'
  })

  const outputs: Array<readonly [string, Uint8Array]> = [
    ['ocr-scanned-invoice.pdf', await imageOnlyPdf(scanned)],
    ['ocr-mixed-statement.pdf', await mixedPdf(mixed)],
    ['ocr-rotated-form.pdf', await imageOnlyPdf(rotated, 90)]
  ]

  for (const [fileName, bytes] of outputs) {
    await writeFile(join(fixtureRoot, fileName), bytes)
  }

  console.log(`Prepared ${outputs.length} deterministic OCR PDF fixtures.`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

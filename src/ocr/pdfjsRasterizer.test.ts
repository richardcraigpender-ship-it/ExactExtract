import assert from 'node:assert/strict'
import test from 'node:test'

import { rasterizePdfPages, type PdfJsRasterDocumentLike } from './pdfjsRasterizer'

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
  return {
    width,
    height,
    getContext: () => ({}) as CanvasRenderingContext2D
  } as unknown as HTMLCanvasElement
}

function preprocessingCanvas(events: string[]): HTMLCanvasElement {
  const source = {
    data: new Uint8ClampedArray([200, 200, 200, 255]),
    width: 1,
    height: 1
  } as ImageData
  return {
    width: 1,
    height: 1,
    getContext: () =>
      ({
        getImageData: () => source,
        putImageData: (value: ImageData) => events.push(`pixel:${value.data[0]}`)
      }) as unknown as CanvasRenderingContext2D
  } as unknown as HTMLCanvasElement
}

test('rasterizes sorted unique selected pages at the configured scale', async () => {
  const rendered: number[] = []
  const progress: string[] = []
  const pdf: PdfJsRasterDocumentLike = {
    numPages: 3,
    async getPage(pageNumber) {
      return {
        getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }),
        render: () => ({ promise: Promise.resolve().then(() => rendered.push(pageNumber)) })
      }
    }
  }

  const pages = await rasterizePdfPages('document-1', pdf, [3, 1, 3], {
    scale: 1.5,
    createCanvas: fakeCanvas,
    onPageComplete: (page, complete, total) => progress.push(`${page}:${complete}/${total}`)
  })

  assert.deepEqual(
    pages.map((page) => page.pageNumber),
    [1, 3]
  )
  assert.deepEqual(
    pages.map((page) => [page.width, page.height]),
    [
      [150, 300],
      [150, 300]
    ]
  )
  assert.deepEqual(rendered, [1, 3])
  assert.deepEqual(progress, ['1:1/2', '3:2/2'])
})

test('adapts the default scale for oversized pages', async () => {
  const pdf: PdfJsRasterDocumentLike = {
    numPages: 1,
    async getPage() {
      return {
        getViewport: ({ scale }) => ({ width: 10_000 * scale, height: 10_000 * scale }),
        render: () => ({ promise: Promise.resolve() })
      }
    }
  }

  const [page] = await rasterizePdfPages('document-1', pdf, [1], { createCanvas: fakeCanvas })

  assert.ok(page!.width * page!.height <= 20_000_000)
  assert.ok(page!.width < 20_000)
})

test('rejects invalid pages and excessive raster dimensions', async () => {
  const pdf: PdfJsRasterDocumentLike = {
    numPages: 1,
    async getPage() {
      return {
        getViewport: () => ({ width: 10_000, height: 10_000 }),
        render: () => ({ promise: Promise.resolve() })
      }
    }
  }

  await assert.rejects(
    rasterizePdfPages('document-1', pdf, [2], { createCanvas: fakeCanvas }),
    /exist/
  )
  await assert.rejects(
    rasterizePdfPages('document-1', pdf, [1], { maxPixels: 1_000, createCanvas: fakeCanvas }),
    /pixel limit/
  )
})

test('cancels an active PDF.js render task', async () => {
  const controller = new AbortController()
  let cancelled = false
  const pdf: PdfJsRasterDocumentLike = {
    numPages: 1,
    async getPage() {
      return {
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({
          promise: new Promise<void>((resolve) => {
            queueMicrotask(() => {
              controller.abort()
              resolve()
            })
          }),
          cancel: () => {
            cancelled = true
          }
        })
      }
    }
  }

  await assert.rejects(
    rasterizePdfPages('document-1', pdf, [1], {
      signal: controller.signal,
      createCanvas: fakeCanvas
    }),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
  )
  assert.equal(cancelled, true)
})

test('applies optional preprocessing after PDF.js rendering', async () => {
  const events: string[] = []
  const pdf: PdfJsRasterDocumentLike = {
    numPages: 1,
    async getPage() {
      return {
        getViewport: () => ({ width: 1, height: 1 }),
        render: () => ({ promise: Promise.resolve().then(() => events.push('rendered')) })
      }
    }
  }

  await rasterizePdfPages('document-1', pdf, [1], {
    createCanvas: () => preprocessingCanvas(events),
    preprocessing: { threshold: 128 }
  })
  assert.deepEqual(events, ['rendered', 'pixel:255'])
})

test('passes PDF rotation into the viewport and preserves rotated dimensions', async () => {
  let receivedRotation: number | undefined
  const pdf: PdfJsRasterDocumentLike = {
    numPages: 1,
    async getPage() {
      return {
        rotate: 90,
        getViewport: ({ rotation }) => {
          receivedRotation = rotation
          return rotation === 90 ? { width: 200, height: 100 } : { width: 100, height: 200 }
        },
        render: () => ({ promise: Promise.resolve() })
      }
    }
  }

  const [page] = await rasterizePdfPages('document-1', pdf, [1], { createCanvas: fakeCanvas })
  assert.equal(receivedRotation, 90)
  assert.deepEqual([page?.width, page?.height], [200, 100])
})

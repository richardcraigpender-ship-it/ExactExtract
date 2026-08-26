import assert from 'node:assert/strict'
import test from 'node:test'

import { getCanvasDropPoint, KEPT_ENTRY_DRAG_TYPE, setKeptEntryDragData } from './canvasDrop'

test('converts canvas-relative drop pixels to clamped PDF points', () => {
  const canvas = { left: 100, top: 50, width: 306 }
  const page = { width: 612, height: 792 }

  assert.deepEqual(getCanvasDropPoint(172, 122, canvas, page), { x: 144, y: 144 })
  assert.deepEqual(getCanvasDropPoint(0, 0, canvas, page), { x: 0, y: 0 })
  assert.deepEqual(getCanvasDropPoint(1000, 1000, canvas, page), { x: 612, y: 792 })
})

test('publishes kept entry ids using the canvas MIME type and text fallback', () => {
  const payloads = new Map<string, string>()
  const dataTransfer = {
    effectAllowed: 'none',
    setData: (format: string, data: string) => payloads.set(format, data)
  }

  setKeptEntryDragData(dataTransfer, 'entry-42')

  assert.equal(dataTransfer.effectAllowed, 'copyMove')
  assert.equal(payloads.get(KEPT_ENTRY_DRAG_TYPE), 'entry-42')
  assert.equal(payloads.get('text/plain'), 'entry-42')
})

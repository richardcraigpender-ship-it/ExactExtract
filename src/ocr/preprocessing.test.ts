import assert from 'node:assert/strict'
import test from 'node:test'

import { preprocessImageData } from './preprocessing'

function image(data: number[]): ImageData {
  return {
    data: new Uint8ClampedArray(data),
    width: data.length / 4,
    height: 1
  } as ImageData
}

test('creates a copy and converts pixels to grayscale', () => {
  const source = image([255, 0, 0, 255, 0, 255, 0, 128])
  const result = preprocessImageData(source, { grayscale: true })

  assert.deepEqual([...result.data], [76, 76, 76, 255, 150, 150, 150, 128])
  assert.deepEqual([...source.data], [255, 0, 0, 255, 0, 255, 0, 128])
})

test('applies binary threshold and preserves alpha', () => {
  const result = preprocessImageData(image([100, 100, 100, 64, 200, 200, 200, 32]), {
    threshold: 128
  })
  assert.deepEqual([...result.data], [0, 0, 0, 64, 255, 255, 255, 32])
})

test('rejects invalid threshold values', () => {
  assert.throws(() => preprocessImageData(image([0, 0, 0, 255]), { threshold: 256 }), /threshold/)
})

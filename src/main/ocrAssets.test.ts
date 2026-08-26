import assert from 'node:assert/strict'
import test from 'node:test'
import { join, resolve } from 'node:path'

import { resolveOcrAssetPath } from './ocrAssets'

test('resolves OCR assets within the configured asset root', () => {
  const root = resolve('renderer-assets', 'ocr')
  assert.equal(
    resolveOcrAssetPath(root, 'exact-extract-ocr://assets/tessdata/eng.traineddata.gz'),
    join(root, 'tessdata', 'eng.traineddata.gz')
  )
})

test('rejects unrelated hosts and traversal outside the OCR asset root', () => {
  const root = resolve('renderer-assets', 'ocr')
  assert.throws(
    () => resolveOcrAssetPath(root, 'exact-extract-ocr://other/worker.min.js'),
    /Invalid OCR asset URL/
  )
  assert.throws(
    () => resolveOcrAssetPath(root, 'exact-extract-ocr://assets/%2e%2e%2fsecret.txt'),
    /Invalid OCR asset path/
  )
})

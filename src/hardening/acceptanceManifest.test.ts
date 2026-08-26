import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

test('PDF acceptance manifest covers every required representative class', async () => {
  const manifest = JSON.parse(
    await readFile(join(process.cwd(), 'test-data/manifests/pdf-acceptance.json'), 'utf8')
  ) as { cases: Array<{ kind: string }> }
  const kinds = new Set(manifest.cases.map((item) => item.kind))
  assert.deepEqual(
    kinds,
    new Set([
      'digital',
      'scanned',
      'mixed',
      'rotated',
      'sparse',
      'tabular',
      'encrypted',
      'malformed',
      'large'
    ])
  )
})

test('workflow manifest covers happy path, failures, and kept-only invariants', async () => {
  const manifest = JSON.parse(
    await readFile(join(process.cwd(), 'test-data/manifests/workflow-acceptance.json'), 'utf8')
  ) as {
    happyPath: string[]
    failurePaths: string[]
    accessibilityPaths: string[]
    responsiveContracts: string[]
    requiredInvariants: string[]
  }
  assert.ok(manifest.happyPath.includes('verify-persistence'))
  assert.ok(manifest.failurePaths.includes('ocr-failure'))
  assert.ok(manifest.failurePaths.includes('save-failure-retry'))
  assert.ok(manifest.failurePaths.includes('too-many-pages-message'))
  assert.ok(manifest.failurePaths.includes('too-many-documents-message'))
  assert.ok(manifest.failurePaths.includes('close-guard-extraction'))
  assert.ok(manifest.failurePaths.includes('close-guard-export'))
  assert.ok(manifest.accessibilityPaths.includes('entry-editor-focus-restoration'))
  assert.ok(manifest.accessibilityPaths.includes('dialog-escape-close'))
  assert.ok(manifest.accessibilityPaths.includes('export-status-announcement'))
  assert.ok(manifest.responsiveContracts.includes('reduced-motion'))
  assert.ok(manifest.responsiveContracts.includes('narrow-window-fallback'))
  assert.ok(manifest.requiredInvariants.includes('maybe-excluded-from-default-analysis'))
  assert.ok(manifest.requiredInvariants.includes('pdf-document-destroyed'))
  assert.ok(manifest.requiredInvariants.includes('ocr-worker-terminated'))
})

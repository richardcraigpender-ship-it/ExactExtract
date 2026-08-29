import assert from 'node:assert/strict'
import test from 'node:test'

import { describeImageResolutionFailure } from './imageResolutionMessage'

const GUIDANCE = 'Placed images stay listed as placeholders and text layout is unaffected.'

test('reports nothing when there is no failure', () => {
  assert.equal(describeImageResolutionFailure(undefined), undefined)
  assert.equal(describeImageResolutionFailure(''), undefined)
  assert.equal(describeImageResolutionFailure('   '), undefined)
})

test('introduces a raw error message and terminates it before the guidance', () => {
  const message = describeImageResolutionFailure('Source PDF is unavailable: doc-1')

  assert.equal(
    message,
    `Entry images could not be generated: Source PDF is unavailable: doc-1. ${GUIDANCE}`
  )
})

test('does not repeat the lead-in when the reason already opens with it', () => {
  const message = describeImageResolutionFailure('Entry images could not be generated.')

  assert.equal(message, `Entry images could not be generated. ${GUIDANCE}`)
  assert.equal(message?.match(/Entry images could not be generated/g)?.length, 1)
})

test('keeps punctuation the reason already supplies', () => {
  assert.match(
    describeImageResolutionFailure('Is the source PDF still there?') ?? '',
    /still there\? Placed images/
  )
  assert.doesNotMatch(describeImageResolutionFailure('Rendering failed!') ?? '', /failed!\./)
})

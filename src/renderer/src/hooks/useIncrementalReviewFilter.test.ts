import assert from 'node:assert/strict'
import test from 'node:test'
import { filterInChunks, preserveIdentityIfUnchanged } from './useIncrementalReviewFilter'

test('filters every item in chunks without changing order', async () => {
  const yielded: number[] = []
  const result = await filterInChunks(
    Array.from({ length: 7 }, (_, index) => index + 1),
    (value) => value % 2 === 1,
    2
  )

  yielded.push(...result)
  assert.deepEqual(yielded, [1, 3, 5, 7])
})

test('stops publishing work when cancelled between chunks', async () => {
  const controller = new AbortController()
  let evaluations = 0
  const resultPromise = filterInChunks(
    [1, 2, 3, 4, 5],
    (value) => {
      evaluations += 1
      if (value === 2) controller.abort()
      return true
    },
    2,
    controller.signal
  )

  assert.deepEqual(await resultPromise, [])
  assert.equal(evaluations, 2)
})

test('keeps the previous array identity when the filtered result is unchanged', () => {
  const current = [{ id: 'a' }, { id: 'b' }]
  const next = [current[0]!, current[1]!]

  // Identity must be preserved, otherwise consumers re-render and re-trigger the
  // filter effect in an endless loop that locks up the renderer thread.
  assert.equal(preserveIdentityIfUnchanged(current, next), current)
})

test('publishes the new array when the filtered result changed', () => {
  const current = [{ id: 'a' }, { id: 'b' }]
  const next = [current[0]!]

  assert.equal(preserveIdentityIfUnchanged(current, next), next)
})

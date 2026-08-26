import assert from 'node:assert/strict'
import test from 'node:test'
import { filterInChunks } from './useIncrementalReviewFilter'

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

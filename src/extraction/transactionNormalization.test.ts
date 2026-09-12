import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeTransactionDescription, shouldReplaceStalePayee } from './transactionNormalization'

test('normalizes direction labels without changing the transaction meaning', () => {
  assert.deepEqual(normalizeTransactionDescription('Payment from Northwind money in'), {
    description: 'Payment from Northwind',
    direction: 'in'
  })
  assert.deepEqual(normalizeTransactionDescription('Transfer to Utilities debit'), {
    description: 'Transfer to Utilities',
    direction: 'out'
  })
})

test('does not infer direction from arbitrary descriptions', () => {
  assert.deepEqual(normalizeTransactionDescription('Transfer review completed'), {
    description: 'Transfer review completed'
  })
})

test('identifies stale persisted payees conservatively', () => {
  assert.equal(shouldReplaceStalePayee('Northwind', 'Payment from Northwind 10.00'), false)
  assert.equal(shouldReplaceStalePayee('Old merchant', 'Payment from New merchant 10.00'), true)
  assert.equal(shouldReplaceStalePayee(undefined, 'Payment from New merchant 10.00'), true)
})

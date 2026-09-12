import assert from 'node:assert/strict'
import test from 'node:test'

import { PROJECT_SCHEMA_VERSION } from './contracts'
import { migrateProjectState } from './projectSchema'

test('keeps the current project schema unchanged', () => {
  const project = { schemaVersion: PROJECT_SCHEMA_VERSION, id: 'project-1' }
  assert.equal(migrateProjectState(project), project)
})

test('rejects future project schemas before validation can discard unknown fields', () => {
  assert.throws(
    () => migrateProjectState({ schemaVersion: PROJECT_SCHEMA_VERSION + 1 }),
    /Unsupported project schema version/
  )
})

test('rejects an older schema until an explicit migration is registered', () => {
  assert.throws(
    () => migrateProjectState({ schemaVersion: PROJECT_SCHEMA_VERSION - 1 }),
    /No migration for project schema version/
  )
})
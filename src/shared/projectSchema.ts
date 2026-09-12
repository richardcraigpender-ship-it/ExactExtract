import { PROJECT_SCHEMA_VERSION } from './contracts'

export type ProjectSchemaObject = Record<string, unknown>
export type ProjectSchemaMigration = (project: ProjectSchemaObject) => ProjectSchemaObject

// Add migrations here as persisted project fields evolve. Each migration must advance exactly one
// schema version and leave source-linked data intact.
const PROJECT_SCHEMA_MIGRATIONS = new Map<number, ProjectSchemaMigration>()

export function migrateProjectState(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const project = value as ProjectSchemaObject
  const rawVersion = project.schemaVersion
  if (typeof rawVersion !== 'number' || !Number.isInteger(rawVersion)) {
    throw new Error(`Unsupported project schema version: ${String(rawVersion)}`)
  }
  if (rawVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema version: ${String(rawVersion)}`)
  }

  let migrated = project
  let version = rawVersion
  while (version < PROJECT_SCHEMA_VERSION) {
    const migration = PROJECT_SCHEMA_MIGRATIONS.get(version)
    if (!migration) throw new Error(`No migration for project schema version: ${String(version)}`)
    migrated = migration(migrated)
    version += 1
    if (migrated.schemaVersion !== version) {
      throw new Error(`Project migration did not advance to schema version: ${String(version)}`)
    }
  }
  return migrated
}

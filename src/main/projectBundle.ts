import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import type { ProjectState } from '../shared/contracts'
import { assertProjectState } from './projectStore'

export const PROJECT_BUNDLE_SCHEMA_VERSION = 1 as const

export interface ProjectBundleSource {
  documentId: string
  originalPath: string
  bundledPath?: string
  sha256?: string
  size?: number
  included: boolean
}

export interface ProjectBundleManifest {
  schemaVersion: typeof PROJECT_BUNDLE_SCHEMA_VERSION
  createdAt: string
  projectId: string
  projectName: string
  includesSources: boolean
  includesOcrAssets: false
  encrypted: false
  compressed: false
  sources: ProjectBundleSource[]
}

export interface CreateProjectBundleOptions {
  includeSources: boolean
  now?: string
}

export interface ImportProjectBundleResult {
  project: ProjectState
  manifest: ProjectBundleManifest
  verifiedSources: number
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function assertManifest(value: unknown): asserts value is ProjectBundleManifest {
  if (typeof value !== 'object' || value === null)
    throw new Error('Invalid project bundle manifest.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== PROJECT_BUNDLE_SCHEMA_VERSION) {
    throw new Error('Unsupported project bundle schema version.')
  }
  for (const field of ['createdAt', 'projectId', 'projectName']) {
    if (typeof manifest[field] !== 'string' || !manifest[field]) {
      throw new Error(`Invalid project bundle manifest field: ${field}.`)
    }
  }
  if (
    manifest.includesOcrAssets !== false ||
    manifest.encrypted !== false ||
    manifest.compressed !== false
  ) {
    throw new Error('Unsupported project bundle features.')
  }
  if (!Array.isArray(manifest.sources)) throw new Error('Invalid project bundle sources.')
}

export async function createProjectBundle(
  project: ProjectState,
  bundleDirectory: string,
  options: CreateProjectBundleOptions
): Promise<ProjectBundleManifest> {
  assertProjectState(project)
  if (!options || typeof options.includeSources !== 'boolean') {
    throw new Error('Bundle source inclusion must be explicit.')
  }
  const createdAt = options.now ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Bundle timestamp must be an ISO date.')

  await mkdir(join(bundleDirectory, 'sources'), { recursive: true })
  const sources: ProjectBundleSource[] = []
  for (const document of project.documents) {
    if (!options.includeSources) {
      sources.push({ documentId: document.id, originalPath: document.path, included: false })
      continue
    }
    const bundledName = `${document.id}-${basename(document.path)}`
    const bundledPath = join('sources', bundledName)
    const destination = join(bundleDirectory, bundledPath)
    let bytes: Uint8Array
    try {
      bytes = await readFile(document.path)
    } catch (error) {
      throw new Error(
        `Unable to include source PDF ${document.name}: ${error instanceof Error ? error.message : 'read failed'}`
      )
    }
    await copyFile(document.path, destination)
    sources.push({
      documentId: document.id,
      originalPath: document.path,
      bundledPath,
      sha256: sha256(bytes),
      size: bytes.byteLength,
      included: true
    })
  }

  const manifest: ProjectBundleManifest = {
    schemaVersion: PROJECT_BUNDLE_SCHEMA_VERSION,
    createdAt,
    projectId: project.id,
    projectName: project.name,
    includesSources: options.includeSources,
    includesOcrAssets: false,
    encrypted: false,
    compressed: false,
    sources
  }
  await writeFile(
    join(bundleDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    join(bundleDirectory, 'project.json'),
    `${JSON.stringify(project, null, 2)}\n`,
    'utf8'
  )
  return manifest
}

export async function importProjectBundle(
  bundleDirectory: string,
  destinationDirectory: string
): Promise<ImportProjectBundleResult> {
  const manifest = JSON.parse(
    await readFile(join(bundleDirectory, 'manifest.json'), 'utf8')
  ) as unknown
  assertManifest(manifest)
  const project = JSON.parse(
    await readFile(join(bundleDirectory, 'project.json'), 'utf8')
  ) as unknown
  assertProjectState(project)
  await mkdir(destinationDirectory, { recursive: true })

  let verifiedSources = 0
  const documents = project.documents.map((document) => {
    const source = manifest.sources.find((candidate) => candidate.documentId === document.id)
    if (!source?.included) return document
    if (!source.bundledPath || !source.sha256 || source.size === undefined) {
      throw new Error(`Bundle source metadata is incomplete for ${document.id}.`)
    }
    const sourcePath = join(bundleDirectory, source.bundledPath)
    return { ...document, path: sourcePath }
  })

  for (const source of manifest.sources.filter((candidate) => candidate.included)) {
    const sourcePath = join(bundleDirectory, source.bundledPath!)
    const bytes = await readFile(sourcePath)
    if (bytes.byteLength !== source.size || sha256(bytes) !== source.sha256) {
      throw new Error(`Bundle source verification failed for ${source.documentId}.`)
    }
    verifiedSources += 1
  }

  const imported = { ...project, documents }
  assertProjectState(imported)
  await writeFile(
    join(destinationDirectory, 'project.json'),
    `${JSON.stringify(imported, null, 2)}\n`,
    'utf8'
  )
  return { project: imported, manifest, verifiedSources }
}

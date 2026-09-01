import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import { PROJECT_SCHEMA_VERSION, type ProjectState, type RecentProject } from '../shared/contracts'
import { isCurrencyCode } from '../shared/currencies'
import { isLengthUnit } from '../shared/units'

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/
const EXTRACTION_MODES = new Set(['fast', 'balanced', 'maximum', 'custom'])
const REVIEW_STATUSES = new Set(['keep', 'exclude', 'maybe'])
const EXTRACTION_SOURCES = new Set(['parser', 'ocr', 'merged'])
const ROTATIONS = new Set([0, 90, 180, 270])

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid project field: ${field}`)
  }
}

function requireFiniteNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid project field: ${field}`)
  }
}

function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid project field: ${field}`)
  }
}

function requireStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid project field: ${field}`)
  }
}

function requireArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid project field: ${field}`)
}

function requireExtractionSettings(value: unknown, field: string): void {
  requireRecord(value, field)
  if (!EXTRACTION_MODES.has(String(value.mode)))
    throw new Error(`Invalid project field: ${field}.mode`)
  requireStringArray(value.ocrLanguages, `${field}.ocrLanguages`)
  if (
    value.selectedPages !== undefined &&
    (!Array.isArray(value.selectedPages) ||
      value.selectedPages.some((page) => !Number.isInteger(page) || Number(page) < 1))
  ) {
    throw new Error(`Invalid project field: ${field}.selectedPages`)
  }
}

function requireStyleProfile(value: unknown, field: string): void {
  requireRecord(value, field)
  requireString(value.id, `${field}.id`)
  requireString(value.documentId, `${field}.documentId`)
  requireString(value.generatedAt, `${field}.generatedAt`)
  if (value.detectorVersion !== 1) {
    throw new Error(`Invalid project field: ${field}.detectorVersion`)
  }
  if (!['pdf-text', 'ocr-image', 'mixed'].includes(String(value.source))) {
    throw new Error(`Invalid project field: ${field}.source`)
  }
  if (!['high', 'medium', 'low'].includes(String(value.confidence))) {
    throw new Error(`Invalid project field: ${field}.confidence`)
  }
  requireArray(value.textStyles, `${field}.textStyles`)
  requireArray(value.dividerStyles, `${field}.dividerStyles`)
  requireArray(value.colourPalette, `${field}.colourPalette`)
  requireArray(value.pageSummaries, `${field}.pageSummaries`)
  requireArray(value.warnings, `${field}.warnings`)
}

function requireSourceRegion(value: unknown, field: string): void {
  requireRecord(value, field)
  requireString(value.documentId, `${field}.documentId`)
  requireFiniteNumber(value.pageNumber, `${field}.pageNumber`)
  if (!Number.isInteger(value.pageNumber) || value.pageNumber < 1) {
    throw new Error(`Invalid project field: ${field}.pageNumber`)
  }
  if (value.bbox !== undefined) {
    requireRecord(value.bbox, `${field}.bbox`)
    for (const dimension of ['x', 'y', 'width', 'height']) {
      requireFiniteNumber(value.bbox[dimension], `${field}.bbox.${dimension}`)
    }
    if (!['pdf-points', 'normalized'].includes(String(value.bbox.coordinateSpace))) {
      throw new Error(`Invalid project field: ${field}.bbox.coordinateSpace`)
    }
  }
}

export function assertProjectState(value: unknown): asserts value is ProjectState {
  requireRecord(value, 'project')
  const project = value
  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema version: ${String(project.schemaVersion)}`)
  }

  requireString(project.id, 'id')
  requireString(project.name, 'name')
  requireString(project.createdAt, 'createdAt')
  requireString(project.updatedAt, 'updatedAt')

  if (!PROJECT_ID_PATTERN.test(project.id)) throw new Error('Invalid project field: id')

  requireArray(project.documents, 'documents')
  requireArray(project.pages, 'pages')
  requireArray(project.entries, 'entries')
  requireArray(project.preflight, 'preflight')
  requireArray(project.extractionJobs, 'extractionJobs')
  requireArray(project.auditTrail, 'auditTrail')

  for (const [index, document] of project.documents.entries()) {
    const field = `documents[${index}]`
    requireRecord(document, field)
    for (const key of ['id', 'path', 'name', 'importedAt'])
      requireString(document[key], `${field}.${key}`)
    requireFiniteNumber(document.size, `${field}.size`)
    if (
      document.removedPages !== undefined &&
      (!Array.isArray(document.removedPages) ||
        document.removedPages.some((page) => !Number.isInteger(page) || Number(page) < 1))
    ) {
      throw new Error(`Invalid project field: ${field}.removedPages`)
    }
    if (document.styleProfile !== undefined) {
      requireStyleProfile(document.styleProfile, `${field}.styleProfile`)
    }
  }

  for (const [index, page] of project.pages.entries()) {
    const field = `pages[${index}]`
    requireRecord(page, field)
    requireString(page.documentId, `${field}.documentId`)
    for (const key of ['pageNumber', 'width', 'height'])
      requireFiniteNumber(page[key], `${field}.${key}`)
    if (!ROTATIONS.has(Number(page.rotation)))
      throw new Error(`Invalid project field: ${field}.rotation`)
    requireString(page.kind, `${field}.kind`)
  }

  for (const [index, entry] of project.entries.entries()) {
    const field = `entries[${index}]`
    requireRecord(entry, field)
    for (const key of ['id', 'rawText', 'normalizedText', 'createdAt', 'updatedAt']) {
      requireString(entry[key], `${field}.${key}`)
    }
    if (entry.payee !== undefined) requireString(entry.payee, `${field}.payee`)
    if (!EXTRACTION_SOURCES.has(String(entry.source)))
      throw new Error(`Invalid project field: ${field}.source`)
    if (!REVIEW_STATUSES.has(String(entry.status)))
      throw new Error(`Invalid project field: ${field}.status`)
    requireFiniteNumber(entry.confidence, `${field}.confidence`)
    requireStringArray(entry.tags, `${field}.tags`)
    if (!Array.isArray(entry.regions)) throw new Error(`Invalid project field: ${field}.regions`)
    entry.regions.forEach((region, regionIndex) =>
      requireSourceRegion(region, `${field}.regions[${regionIndex}]`)
    )
  }

  for (const [index, preflight] of project.preflight.entries()) {
    const field = `preflight[${index}]`
    requireRecord(preflight, field)
    requireString(preflight.documentId, `${field}.documentId`)
    requireString(preflight.kind, `${field}.kind`)
    requireFiniteNumber(preflight.confidence, `${field}.confidence`)
    requireString(preflight.completedAt, `${field}.completedAt`)
    if (!Array.isArray(preflight.pages)) throw new Error(`Invalid project field: ${field}.pages`)
  }

  for (const [index, job] of project.extractionJobs.entries()) {
    const field = `extractionJobs[${index}]`
    requireRecord(job, field)
    requireString(job.id, `${field}.id`)
    requireStringArray(job.documentIds, `${field}.documentIds`)
    requireExtractionSettings(job.settings, `${field}.settings`)
    requireString(job.status, `${field}.status`)
    requireFiniteNumber(job.progress, `${field}.progress`)
  }

  for (const [index, event] of project.auditTrail.entries()) {
    const field = `auditTrail[${index}]`
    requireRecord(event, field)
    for (const key of ['id', 'occurredAt', 'action', 'entityType', 'entityId']) {
      requireString(event[key], `${field}.${key}`)
    }
  }

  requireRecord(project.settings, 'settings')
  if (!['light', 'dark', 'system'].includes(String(project.settings.theme))) {
    throw new Error('Invalid project field: settings.theme')
  }
  requireExtractionSettings(project.settings.extraction, 'settings.extraction')
  requireFiniteNumber(project.settings.splitPanePercent, 'settings.splitPanePercent')
  if (
    project.settings.currencyCode !== undefined &&
    !isCurrencyCode(project.settings.currencyCode)
  ) {
    throw new Error('Invalid project field: settings.currencyCode')
  }
  if (project.settings.lengthUnit !== undefined && !isLengthUnit(project.settings.lengthUnit)) {
    throw new Error('Invalid project field: settings.lengthUnit')
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`)

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export class ProjectStore {
  private readonly projectsDirectory: string
  private readonly recentsPath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(rootDirectory: string) {
    this.projectsDirectory = join(rootDirectory, 'projects')
    this.recentsPath = join(rootDirectory, 'recent-projects.json')
  }

  create(name: string, id: string = randomUUID()): ProjectState {
    if (name.trim().length === 0) throw new Error('A project name is required.')
    this.assertProjectId(id)

    const now = new Date().toISOString()
    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      documents: [],
      pages: [],
      entries: [],
      preflight: [],
      extractionJobs: [],
      auditTrail: [],
      settings: {
        theme: 'system',
        extraction: { mode: 'balanced', ocrLanguages: ['eng'] },
        splitPanePercent: 50,
        currencyCode: 'GBP'
      }
    }
  }

  save(project: ProjectState): Promise<void> {
    assertProjectState(project)
    const snapshot = structuredClone(project)

    return this.enqueueWrite(async () => {
      await this.ensureDirectories()
      snapshot.updatedAt = new Date().toISOString()
      const path = this.projectPath(snapshot.id)
      await atomicWriteJson(path, snapshot)

      const recents = await this.readRecents()
      const nextRecent: RecentProject = {
        id: snapshot.id,
        name: snapshot.name,
        path,
        updatedAt: snapshot.updatedAt
      }
      const updatedRecents = [nextRecent, ...recents.filter((item) => item.id !== snapshot.id)]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 20)
      await atomicWriteJson(this.recentsPath, updatedRecents)
    })
  }

  async load(projectId: string): Promise<ProjectState> {
    await this.writeQueue
    const value = await readJson(this.projectPath(projectId))
    assertProjectState(value)
    return value
  }

  async listRecent(): Promise<RecentProject[]> {
    await this.writeQueue
    return this.readRecents()
  }

  removeRecent(projectId: string): Promise<void> {
    this.assertProjectId(projectId)
    return this.enqueueWrite(async () => {
      await this.ensureDirectories()
      const recents = await this.readRecents()
      await atomicWriteJson(
        this.recentsPath,
        recents.filter((item) => item.id !== projectId)
      )
    })
  }

  private projectPath(projectId: string): string {
    this.assertProjectId(projectId)
    return join(this.projectsDirectory, `${projectId}.json`)
  }

  private assertProjectId(projectId: string): void {
    if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Invalid project ID.')
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(this.projectsDirectory, { recursive: true })
  }

  private async readRecents(): Promise<RecentProject[]> {
    try {
      const value = await readJson(this.recentsPath)
      if (!Array.isArray(value)) throw new Error('Invalid recent-project index.')
      return value.filter((item): item is RecentProject => {
        if (typeof item !== 'object' || item === null) return false
        const record = item as Record<string, unknown>
        return ['id', 'name', 'path', 'updatedAt'].every(
          (field) => typeof record[field] === 'string'
        )
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  private enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const result = this.writeQueue.then(operation)
    this.writeQueue = result.catch(() => undefined)
    return result
  }
}

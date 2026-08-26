import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import type { ProjectEntry } from '../shared/contracts'
import {
  PAYEE_LIBRARY_SCHEMA_VERSION,
  type PayeeObservation,
  type PayeeProvenanceReference,
  type PayeeRecord
} from '../shared/payees'

interface PayeeFile {
  schemaVersion: typeof PAYEE_LIBRARY_SCHEMA_VERSION
  records: PayeeRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function normalizePayeeKey(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u2010-\u2015-]+/g, ' ')
    .replace(/[.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isProvenanceReference(value: unknown): value is PayeeProvenanceReference {
  return (
    isRecord(value) &&
    typeof value.projectId === 'string' &&
    value.projectId.length > 0 &&
    typeof value.entryId === 'string' &&
    value.entryId.length > 0 &&
    isIsoDate(value.seenAt)
  )
}

function isPayeeRecord(value: unknown): value is PayeeRecord {
  if (!isRecord(value)) return false
  const provenance = value.provenance
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.canonicalDisplayName === 'string' &&
    value.canonicalDisplayName.trim().length > 0 &&
    typeof value.normalizedKey === 'string' &&
    value.normalizedKey === normalizePayeeKey(value.canonicalDisplayName) &&
    Number.isInteger(value.occurrenceCount) &&
    Number(value.occurrenceCount) > 0 &&
    Array.isArray(provenance) &&
    provenance.length === value.occurrenceCount &&
    provenance.every(isProvenanceReference) &&
    new Set(provenance.map((source) => `${source.projectId}\0${source.entryId}`)).size ===
      provenance.length &&
    isIsoDate(value.firstSeenAt) &&
    isIsoDate(value.lastSeenAt) &&
    value.firstSeenAt <= value.lastSeenAt
  )
}

function assertObservation(value: PayeeObservation): void {
  if (typeof value.description !== 'string' || !normalizePayeeKey(value.description)) {
    throw new Error('Payee description is required.')
  }
  if (
    typeof value.projectId !== 'string' ||
    !value.projectId.trim() ||
    typeof value.entryId !== 'string' ||
    !value.entryId.trim()
  ) {
    throw new Error('Payee provenance is required.')
  }
  if (!isIsoDate(value.seenAt)) throw new Error('Payee seenAt must be an ISO date.')
}

function upsertRecord(records: PayeeRecord[], observation: PayeeObservation): PayeeRecord {
  assertObservation(observation)
  const normalizedKey = normalizePayeeKey(observation.description)
  const existing = records.find((record) => record.normalizedKey === normalizedKey)
  const source: PayeeProvenanceReference = {
    projectId: observation.projectId,
    entryId: observation.entryId,
    seenAt: observation.seenAt
  }

  if (!existing) {
    const record: PayeeRecord = {
      id: randomUUID(),
      canonicalDisplayName: observation.description.replace(/\s+/g, ' ').trim(),
      normalizedKey,
      occurrenceCount: 1,
      provenance: [source],
      firstSeenAt: observation.seenAt,
      lastSeenAt: observation.seenAt
    }
    records.push(record)
    return record
  }

  const previousSource = existing.provenance.find(
    (candidate) =>
      candidate.projectId === observation.projectId && candidate.entryId === observation.entryId
  )
  if (previousSource) {
    previousSource.seenAt = observation.seenAt
  } else {
    existing.provenance.push(source)
    existing.occurrenceCount = existing.provenance.length
  }
  existing.firstSeenAt =
    existing.firstSeenAt < observation.seenAt ? existing.firstSeenAt : observation.seenAt
  existing.lastSeenAt =
    existing.lastSeenAt > observation.seenAt ? existing.lastSeenAt : observation.seenAt
  return existing
}

export class PayeeStore {
  private readonly filePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(rootDirectory: string) {
    this.filePath = join(rootDirectory, 'payees.json')
  }

  async list(): Promise<PayeeRecord[]> {
    await this.writeQueue
    return (await this.readRecords())
      .sort((left, right) => left.canonicalDisplayName.localeCompare(right.canonicalDisplayName))
      .map((record) => structuredClone(record))
  }

  async search(search: string): Promise<PayeeRecord[]> {
    await this.writeQueue
    const key = normalizePayeeKey(search)
    return (await this.readRecords())
      .filter((record) => !key || record.normalizedKey.includes(key))
      .sort((left, right) => left.canonicalDisplayName.localeCompare(right.canonicalDisplayName))
      .map((record) => structuredClone(record))
  }

  upsert(observation: PayeeObservation): Promise<PayeeRecord> {
    assertObservation(observation)
    return this.enqueueWrite(async () => {
      const records = await this.readRecords()
      const result = upsertRecord(records, observation)
      await this.writeRecords(records)
      return structuredClone(result)
    })
  }

  upsertEntries(projectId: string, entries: readonly ProjectEntry[]): Promise<void> {
    if (!projectId.trim()) return Promise.reject(new Error('Project ID is required.'))
    const observations = entries.flatMap((entry): PayeeObservation[] => {
      if (!entry.payee?.trim()) return []
      return [
        {
          description: entry.payee,
          projectId,
          entryId: entry.id,
          seenAt: entry.updatedAt
        }
      ]
    })
    observations.forEach(assertObservation)
    if (observations.length === 0) return Promise.resolve()

    return this.enqueueWrite(async () => {
      const records = await this.readRecords()
      observations.forEach((observation) => upsertRecord(records, observation))
      await this.writeRecords(records)
    })
  }

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation)
    this.writeQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async readRecords(): Promise<PayeeRecord[]> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown
      if (
        !isRecord(parsed) ||
        parsed.schemaVersion !== PAYEE_LIBRARY_SCHEMA_VERSION ||
        !Array.isArray(parsed.records) ||
        !parsed.records.every(isPayeeRecord)
      ) {
        throw new Error('Invalid payee library schema.')
      }
      return parsed.records.map((record) => structuredClone(record))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      await this.quarantineMalformedFile()
      return []
    }
  }

  private async writeRecords(records: PayeeRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = join(
      dirname(this.filePath),
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`
    )
    const file: PayeeFile = { schemaVersion: PAYEE_LIBRARY_SCHEMA_VERSION, records }
    try {
      await writeFile(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }

  private async quarantineMalformedFile(): Promise<void> {
    const backupPath = join(
      dirname(this.filePath),
      `payees.corrupt.${Date.now()}.${randomUUID()}.json`
    )
    try {
      await rename(this.filePath, backupPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

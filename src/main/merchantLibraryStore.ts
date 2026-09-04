import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import type { ProjectEntry } from '../shared/contracts'
import {
  MERCHANT_LIBRARY_SCHEMA_VERSION,
  classifyMerchantCandidate,
  normalizeMerchantKey,
  type MerchantCreate,
  type MerchantObservation,
  type MerchantRecord,
  type MerchantUpdate
} from '../shared/merchants'

interface MerchantFile {
  schemaVersion: typeof MERCHANT_LIBRARY_SCHEMA_VERSION
  records: MerchantRecord[]
}

function assertText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
}

function assertIsoDate(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date.`)
  }
}

function assertObservation(value: MerchantObservation): void {
  assertText(value.description, 'Merchant description')
  assertText(value.projectId, 'Merchant project ID')
  assertText(value.entryId, 'Merchant entry ID')
  assertIsoDate(value.seenAt, 'Merchant seenAt')
}

function displayName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function entryObservation(projectId: string, entry: ProjectEntry): MerchantObservation | undefined {
  if (!entry.payee?.trim()) return undefined
  const region = entry.regions[0]
  return {
    description: entry.payee,
    projectId,
    entryId: entry.id,
    documentId: region?.documentId,
    pageNumber: region?.pageNumber,
    amount: entry.numericValue,
    transactionDate: entry.date,
    seenAt: entry.updatedAt
  }
}

export class MerchantStore {
  private readonly filePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(rootDirectory: string) {
    this.filePath = join(rootDirectory, 'merchants.json')
  }

  async list(): Promise<MerchantRecord[]> {
    await this.writeQueue
    return this.cloneSorted(await this.readRecords())
  }

  async search(query: string): Promise<MerchantRecord[]> {
    await this.writeQueue
    const key = normalizeMerchantKey(query)
    return this.cloneSorted(
      (await this.readRecords()).filter((record) => !key || record.normalizedKey.includes(key))
    )
  }

  create(input: MerchantCreate, now = new Date().toISOString()): Promise<MerchantRecord> {
    assertText(input.displayName, 'Merchant display name')
    assertIsoDate(now, 'Merchant createdAt')
    return this.enqueueWrite(async () => {
      const records = await this.readRecords()
      const name = displayName(input.displayName)
      const normalizedKey = normalizeMerchantKey(name)
      if (records.some((record) => record.normalizedKey === normalizedKey)) {
        throw new Error('A merchant with this normalized name already exists.')
      }
      const record: MerchantRecord = {
        id: randomUUID(),
        canonicalDisplayName: name,
        normalizedKey,
        aliases: [...new Set((input.aliases ?? []).map(displayName).filter(Boolean))],
        classification: 'merchant-candidate',
        classificationReasons: [],
        userOverride: true,
        ...(input.category?.trim() ? { category: input.category.trim() } : {}),
        recurring: input.recurring ?? false,
        forecastIncluded: input.forecastIncluded ?? true,
        ...(input.direction ? { direction: input.direction } : {}),
        ...(Number.isFinite(input.defaultAmount) ? { defaultAmount: input.defaultAmount } : {}),
        ...(input.defaultCadence?.trim() ? { defaultCadence: input.defaultCadence.trim() } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        occurrenceCount: 0,
        provenance: [],
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now
      }
      records.push(record)
      await this.writeRecords(records)
      return structuredClone(record)
    })
  }

  update(
    id: string,
    input: MerchantUpdate,
    now = new Date().toISOString()
  ): Promise<MerchantRecord> {
    assertText(id, 'Merchant ID')
    assertIsoDate(now, 'Merchant updatedAt')
    return this.enqueueWrite(async () => {
      const records = await this.readRecords()
      const record = records.find((candidate) => candidate.id === id)
      if (!record) throw new Error('Merchant record was not found.')
      if (input.displayName !== undefined) {
        assertText(input.displayName, 'Merchant display name')
        record.canonicalDisplayName = displayName(input.displayName)
        record.normalizedKey = normalizeMerchantKey(record.canonicalDisplayName)
      }
      if (input.aliases !== undefined)
        record.aliases = [...new Set(input.aliases.map(displayName).filter(Boolean))]
      if (input.category !== undefined) record.category = input.category.trim() || undefined
      if (input.notes !== undefined) record.notes = input.notes.trim() || undefined
      if (input.recurring !== undefined) record.recurring = input.recurring
      if (input.forecastIncluded !== undefined) record.forecastIncluded = input.forecastIncluded
      if (input.direction !== undefined) record.direction = input.direction
      if (input.defaultAmount !== undefined) record.defaultAmount = input.defaultAmount
      if (input.defaultCadence !== undefined)
        record.defaultCadence = input.defaultCadence.trim() || undefined
      if (input.classification !== undefined) record.classification = input.classification
      record.userOverride = true
      record.updatedAt = now
      await this.writeRecords(records)
      return structuredClone(record)
    })
  }

  remove(id: string): Promise<void> {
    assertText(id, 'Merchant ID')
    return this.enqueueWrite(async () => {
      const records = await this.readRecords()
      await this.writeRecords(records.filter((record) => record.id !== id))
    })
  }

  upsertEntries(
    projectId: string,
    entries: readonly ProjectEntry[]
  ): Promise<{ added: number; flaggedPersonal: number }> {
    assertText(projectId, 'Merchant project ID')
    const observations = entries.flatMap((entry) => {
      const observation = entryObservation(projectId, entry)
      return observation ? [observation] : []
    })
    observations.forEach(assertObservation)
    return this.enqueueWrite(async () => {
      const records = await this.readRecords()
      let added = 0
      let flaggedPersonal = 0
      for (const observation of observations) {
        const candidate = classifyMerchantCandidate(observation.description)
        if (candidate.classification === 'likely-personal') {
          flaggedPersonal += 1
          continue
        }
        if (candidate.classification !== 'merchant-candidate') continue
        const existing = records.find((record) => record.normalizedKey === candidate.normalizedKey)
        const provenance = { ...observation, description: undefined }
        if (!existing) {
          records.push({
            id: randomUUID(),
            canonicalDisplayName: candidate.description,
            normalizedKey: candidate.normalizedKey,
            aliases: [],
            classification: 'merchant-candidate',
            classificationReasons: [],
            userOverride: false,
            recurring: false,
            forecastIncluded: true,
            occurrenceCount: 1,
            provenance: [provenance],
            firstSeenAt: observation.seenAt,
            lastSeenAt: observation.seenAt,
            createdAt: observation.seenAt,
            updatedAt: observation.seenAt
          })
          added += 1
          continue
        }
        const prior = existing.provenance.find(
          (source) => source.projectId === projectId && source.entryId === observation.entryId
        )
        if (prior) Object.assign(prior, provenance)
        else {
          existing.provenance.push(provenance)
          existing.occurrenceCount = existing.provenance.length
        }
        existing.firstSeenAt =
          existing.firstSeenAt < observation.seenAt ? existing.firstSeenAt : observation.seenAt
        existing.lastSeenAt =
          existing.lastSeenAt > observation.seenAt ? existing.lastSeenAt : observation.seenAt
        existing.updatedAt = observation.seenAt
      }
      if (observations.length) await this.writeRecords(records)
      return { added, flaggedPersonal }
    })
  }

  private cloneSorted(records: MerchantRecord[]): MerchantRecord[] {
    return records
      .sort((left, right) => left.canonicalDisplayName.localeCompare(right.canonicalDisplayName))
      .map((record) => structuredClone(record))
  }

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation)
    this.writeQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async readRecords(): Promise<MerchantRecord[]> {
    try {
      const value = JSON.parse(await readFile(this.filePath, 'utf8')) as MerchantFile
      if (value.schemaVersion !== MERCHANT_LIBRARY_SCHEMA_VERSION || !Array.isArray(value.records))
        throw new Error('Invalid merchant library schema.')
      return structuredClone(value.records)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      await this.quarantineMalformedFile()
      return []
    }
  }

  private async writeRecords(records: MerchantRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = join(
      dirname(this.filePath),
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`
    )
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify({ schemaVersion: MERCHANT_LIBRARY_SCHEMA_VERSION, records }, null, 2)}\n`,
        'utf8'
      )
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }

  private async quarantineMalformedFile(): Promise<void> {
    try {
      await rename(
        this.filePath,
        join(dirname(this.filePath), `merchants.corrupt.${Date.now()}.${randomUUID()}.json`)
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

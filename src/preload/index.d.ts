import type { ProjectState, RecentProject } from '../shared/contracts'
import type { PayeeObservation, PayeeRecord } from '../shared/payees'
import type {
  MerchantCandidate,
  MerchantCreate,
  MerchantRecord,
  MerchantUpdate
} from '../shared/merchants'
import type { ProjectImageDescriptor } from '../shared/projectImages'
import type { CloseGuardState, RecentProjectRecoveryItem } from '../recovery'
import type { RemovedPdfPages } from '../renderer/src/lib/removePdfPages'

export interface PdfFileDescriptor {
  path: string
  name: string
  size: number
}

export interface StudioBridge {
  app: {
    setCloseGuard: (state: CloseGuardState) => Promise<void>
  }
  documents: {
    choosePdfs: () => Promise<PdfFileDescriptor[]>
    importDroppedPdfs: (files: File[]) => Promise<PdfFileDescriptor[]>
    readPdf: (path: string) => Promise<Uint8Array>
    removePdfPages: (sourceBytes: Uint8Array, pagesToRemove: number[]) => Promise<RemovedPdfPages>
  }
  projects: {
    create: (name: string) => Promise<ProjectState>
    save: (project: ProjectState) => Promise<void>
    load: (projectId: string) => Promise<ProjectState>
    listRecent: () => Promise<RecentProject[]>
    listRecovery: () => Promise<RecentProjectRecoveryItem[]>
    removeRecent: (projectId: string) => Promise<void>
    locateSources: (projectId: string) => Promise<{
      project: ProjectState
      cancelled: boolean
      recoveredSourceCount: number
      remainingMissingSourceCount: number
    }>
  }
  payees: {
    list: () => Promise<PayeeRecord[]>
    search: (query: string) => Promise<PayeeRecord[]>
    upsert: (observation: PayeeObservation) => Promise<PayeeRecord>
  }
  merchants: {
    list: () => Promise<MerchantRecord[]>
    search: (query: string) => Promise<MerchantRecord[]>
    classify: (description: string) => Promise<MerchantCandidate>
    create: (input: MerchantCreate) => Promise<MerchantRecord>
    update: (id: string, input: MerchantUpdate) => Promise<MerchantRecord>
    remove: (id: string) => Promise<void>
    rescanProject: (projectId: string) => Promise<{ added: number; flaggedPersonal: number }>
  }
  exports: {
    save: (request: {
      format:
        | 'csv'
        | 'json'
        | 'pdf'
        | 'pdf-layout'
        | 'pdf-compact'
        | 'pdf-kept'
        | 'pdf-kept-layout'
        | 'pdf-kept-canvas'
      suggestedName: string
      content: string
    }) => Promise<{ status: 'cancelled' } | { status: 'saved'; path: string }>
    saveEntryImages: (request: {
      suggestedFolderName: string
      files: Array<{ name: string; content: string }>
    }) => Promise<{ status: 'cancelled' } | { status: 'saved'; path: string; fileCount: number }>
  }
  projectImages: {
    save: (files: Array<{ name: string; content: string }>) => Promise<ProjectImageDescriptor[]>
    saveBackground: (content: string) => Promise<{ ref: string; byteLength: number }>
    readDataUrls: (refs: string[]) => Promise<Record<string, string>>
  }
}

declare global {
  interface Window {
    studio: StudioBridge
  }
}

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CloseGuardState } from '../recovery'

const studio = {
  app: {
    setCloseGuard: (state: CloseGuardState) =>
      ipcRenderer.invoke('studio:app:set-close-guard', state)
  },
  documents: {
    choosePdfs: () => ipcRenderer.invoke('studio:documents:choose-pdfs'),
    importDroppedPdfs: (files: File[]) =>
      ipcRenderer.invoke('studio:documents:register-pdfs', files.map(webUtils.getPathForFile)),
    readPdf: (path: string) => ipcRenderer.invoke('studio:documents:read-pdf', path),
    removePdfPages: async (sourceBytes: Uint8Array, pagesToRemove: number[]) => {
      const result = (await ipcRenderer.invoke('studio:documents:remove-pdf-pages', {
        sourceBase64: Buffer.from(sourceBytes).toString('base64'),
        pagesToRemove
      })) as {
        bytesBase64: string
        pageCount: number
        removedPages: number[]
      }
      return {
        bytes: new Uint8Array(Buffer.from(result.bytesBase64, 'base64')),
        pageCount: result.pageCount,
        removedPages: result.removedPages
      }
    }
  },
  projects: {
    create: (name: string) => ipcRenderer.invoke('studio:projects:create', name),
    save: (project: unknown) => ipcRenderer.invoke('studio:projects:save', project),
    load: (projectId: string) => ipcRenderer.invoke('studio:projects:load', projectId),
    listRecent: () => ipcRenderer.invoke('studio:projects:list-recent'),
    listRecovery: () => ipcRenderer.invoke('studio:projects:list-recovery'),
    removeRecent: (projectId: string) =>
      ipcRenderer.invoke('studio:projects:remove-recent', projectId),
    locateSources: (projectId: string) =>
      ipcRenderer.invoke('studio:projects:locate-sources', projectId)
  },
  payees: {
    list: () => ipcRenderer.invoke('studio:payees:list'),
    search: (query: string) => ipcRenderer.invoke('studio:payees:search', query),
    upsert: (observation: {
      description: string
      projectId: string
      entryId: string
      seenAt: string
    }) => ipcRenderer.invoke('studio:payees:upsert', observation)
  },
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
    }) => ipcRenderer.invoke('studio:exports:save', request),
    saveEntryImages: (request: {
      suggestedFolderName: string
      files: Array<{ name: string; content: string }>
    }) => ipcRenderer.invoke('studio:exports:save-entry-images', request)
  }
}

contextBridge.exposeInMainWorld('studio', studio)

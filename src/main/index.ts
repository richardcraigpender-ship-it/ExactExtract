import { app, shell, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, extname, join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { saveExportRequest } from './exportSave'
import { saveEntryImageRequest } from './entryImageSave'
import { MerchantStore } from './merchantLibraryStore'
import { PayeeStore } from './payeeLibraryStore'
import { ProjectStore } from './projectStore'
import { resolveOcrAssetPath } from './ocrAssets'
import { ProjectImageStore } from './projectImageStore'
import { pruneProjectImages } from './projectImageRetention'
import type { ProjectState } from '../shared/contracts'
import { OCR_ASSET_SCHEME } from '../shared/ocrAssets'
import { PROJECT_IMAGE_SCHEME } from '../shared/projectImages'
import type { PayeeObservation } from '../shared/payees'
import {
  classifyMerchantCandidate,
  type MerchantCreate,
  type MerchantUpdate
} from '../shared/merchants'
import { removePdfPages } from '../renderer/src/lib/removePdfPages'
import {
  closeGuardMessage,
  matchReplacementSources,
  shouldBlockClose,
  type CloseGuardState,
  type RecentProjectRecoveryItem
} from '../recovery'

const selectedPdfPaths = new Set<string>()
const closeGuardStates = new Map<number, CloseGuardState>()

protocol.registerSchemesAsPrivileged([
  {
    scheme: OCR_ASSET_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  },
  {
    scheme: PROJECT_IMAGE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

app.setName('EXACT EXTRACT')
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'pdf-extract-review-studio'))
}

// Keep Chromium disk cache out of the shared profile during dev to prevent lock contention
// when multiple local runs overlap.
if (is.dev) {
  app.setPath('sessionData', join(app.getPath('temp'), 'pdf-extract-review-studio-session'))
}

// Multiple dev launches can race over Chromium cache files under the same user-data directory.
// Keep a single app instance and focus it when a second launch is attempted.
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.focus()
})

interface PdfFileDescriptor {
  path: string
  name: string
  size: number
}

async function describePdf(filePath: string): Promise<PdfFileDescriptor> {
  const normalizedPath = resolve(filePath)
  if (extname(normalizedPath).toLowerCase() !== '.pdf') {
    throw new Error('Only PDF files can be imported.')
  }

  const fileStat = await stat(normalizedPath)
  if (!fileStat.isFile()) {
    throw new Error('The selected path is not a file.')
  }

  return { path: normalizedPath, name: basename(normalizedPath), size: fileStat.size }
}

async function sourceExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function listRecoveryProjects(
  projectStore: ProjectStore
): Promise<RecentProjectRecoveryItem[]> {
  return Promise.all(
    (await projectStore.listRecent()).map(async (recent) => {
      try {
        const project = await projectStore.load(recent.id)
        const availability = await Promise.all(
          project.documents.map((document) => sourceExists(document.path))
        )
        const missingSourceCount = availability.filter((exists) => !exists).length
        return {
          ...recent,
          availability: missingSourceCount > 0 ? ('missing' as const) : ('available' as const),
          missingSourceCount
        }
      } catch {
        return { ...recent, availability: 'unknown' as const, missingSourceCount: 0 }
      }
    })
  )
}

function registerDocumentHandlers(
  projectStore: ProjectStore,
  payeeStore: PayeeStore,
  merchantStore: MerchantStore
): void {
  ipcMain.handle('studio:app:set-close-guard', (event, value: unknown) => {
    const state = value as Partial<CloseGuardState> | null
    if (
      typeof value !== 'object' ||
      value === null ||
      typeof state?.hasUnsavedChanges !== 'boolean' ||
      typeof state.saveInProgress !== 'boolean' ||
      (state.extractionInProgress !== undefined &&
        typeof state.extractionInProgress !== 'boolean') ||
      (state.exportInProgress !== undefined && typeof state.exportInProgress !== 'boolean')
    ) {
      throw new Error('A valid close guard state is required.')
    }
    closeGuardStates.set(event.sender.id, state as CloseGuardState)
  })

  ipcMain.handle('studio:documents:choose-pdfs', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Import PDF documents',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
    } satisfies Electron.OpenDialogOptions
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled) return []

    const documents = await Promise.all(result.filePaths.map(describePdf))
    documents.forEach((document) => selectedPdfPaths.add(document.path))
    return documents
  })

  ipcMain.handle('studio:documents:register-pdfs', async (_event, filePaths: unknown) => {
    if (!Array.isArray(filePaths) || !filePaths.every((path) => typeof path === 'string')) {
      throw new Error('A list of PDF paths is required.')
    }

    const documents = await Promise.all(filePaths.map(describePdf))
    documents.forEach((document) => selectedPdfPaths.add(document.path))
    return documents
  })

  ipcMain.handle('studio:documents:read-pdf', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') throw new Error('A PDF path is required.')

    const document = await describePdf(filePath)
    if (!selectedPdfPaths.has(document.path)) {
      throw new Error('The PDF must be selected through the import dialog first.')
    }

    return readFile(document.path)
  })

  ipcMain.handle('studio:documents:remove-pdf-pages', async (_event, value: unknown) => {
    const request = value as { sourceBase64?: unknown; pagesToRemove?: unknown } | null
    if (
      typeof request !== 'object' ||
      request === null ||
      typeof request.sourceBase64 !== 'string' ||
      !Array.isArray(request.pagesToRemove) ||
      !request.pagesToRemove.every((page) => typeof page === 'number')
    ) {
      throw new Error('Valid PDF bytes and page numbers are required.')
    }

    const result = await removePdfPages(
      new Uint8Array(Buffer.from(request.sourceBase64, 'base64')),
      request.pagesToRemove
    )
    return {
      ...result,
      bytesBase64: Buffer.from(result.bytes).toString('base64'),
      bytes: undefined
    }
  })

  ipcMain.handle('studio:projects:create', (_event, name: unknown) => {
    if (typeof name !== 'string') throw new Error('A project name is required.')
    return projectStore.create(name)
  })

  ipcMain.handle('studio:projects:save', async (_event, project: unknown) => {
    await projectStore.save(project as ProjectState)
    const savedProject = project as ProjectState
    await payeeStore.upsertEntries(savedProject.id, savedProject.entries)
    await merchantStore.upsertEntries(savedProject.id, savedProject.entries)
  })

  ipcMain.handle('studio:payees:list', () => payeeStore.list())

  ipcMain.handle('studio:payees:search', (_event, search: unknown) => {
    if (typeof search !== 'string') throw new Error('A payee search query is required.')
    return payeeStore.search(search)
  })

  ipcMain.handle('studio:payees:upsert', (_event, observation: unknown) => {
    if (typeof observation !== 'object' || observation === null) {
      throw new Error('A payee observation is required.')
    }
    return payeeStore.upsert(observation as PayeeObservation)
  })

  ipcMain.handle('studio:merchants:list', () => merchantStore.list())

  ipcMain.handle('studio:merchants:search', (_event, query: unknown) => {
    if (typeof query !== 'string') throw new Error('A merchant search query is required.')
    return merchantStore.search(query)
  })

  ipcMain.handle('studio:merchants:classify', (_event, description: unknown) => {
    if (typeof description !== 'string') throw new Error('A merchant description is required.')
    return classifyMerchantCandidate(description)
  })

  ipcMain.handle('studio:merchants:create', (_event, input: unknown) => {
    if (typeof input !== 'object' || input === null)
      throw new Error('Merchant details are required.')
    return merchantStore.create(input as MerchantCreate)
  })

  ipcMain.handle('studio:merchants:update', (_event, id: unknown, input: unknown) => {
    if (typeof id !== 'string' || typeof input !== 'object' || input === null) {
      throw new Error('Merchant ID and update details are required.')
    }
    return merchantStore.update(id, input as MerchantUpdate)
  })

  ipcMain.handle('studio:merchants:remove', (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('A merchant ID is required.')
    return merchantStore.remove(id)
  })

  ipcMain.handle('studio:merchants:rescan-project', async (_event, projectId: unknown) => {
    if (typeof projectId !== 'string') throw new Error('A project ID is required.')
    const project = await projectStore.load(projectId)
    return merchantStore.upsertEntries(project.id, project.entries)
  })

  ipcMain.handle('studio:projects:load', async (_event, projectId: unknown) => {
    if (typeof projectId !== 'string') throw new Error('A project ID is required.')
    const project = await projectStore.load(projectId)
    project.documents.forEach((document) => selectedPdfPaths.add(resolve(document.path)))
    return project
  })

  ipcMain.handle('studio:projects:list-recent', () => projectStore.listRecent())

  ipcMain.handle('studio:projects:list-recovery', () => listRecoveryProjects(projectStore))

  ipcMain.handle('studio:projects:remove-recent', async (_event, projectId: unknown) => {
    if (typeof projectId !== 'string') throw new Error('A project ID is required.')
    await projectStore.removeRecent(projectId)
  })

  ipcMain.handle('studio:projects:locate-sources', async (event, projectId: unknown) => {
    if (typeof projectId !== 'string') throw new Error('A project ID is required.')
    const project = await projectStore.load(projectId)
    const missingDocuments = (
      await Promise.all(
        project.documents.map(async (document) => ({
          document,
          exists: await sourceExists(document.path)
        }))
      )
    ).filter(({ exists }) => !exists)
    if (missingDocuments.length === 0) {
      return {
        project,
        cancelled: false,
        recoveredSourceCount: 0,
        remainingMissingSourceCount: 0
      }
    }

    const owner = BrowserWindow.fromWebContents(event.sender)
    const locateOptions = {
      title: 'Locate missing PDF sources',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
    } satisfies Electron.OpenDialogOptions
    const result = owner
      ? await dialog.showOpenDialog(owner, locateOptions)
      : await dialog.showOpenDialog(locateOptions)
    if (result.canceled) {
      return {
        project,
        cancelled: true,
        recoveredSourceCount: 0,
        remainingMissingSourceCount: missingDocuments.length
      }
    }

    const replacements = await Promise.all(result.filePaths.map(describePdf))
    const matches = matchReplacementSources(
      missingDocuments.map(({ document }) => ({ id: document.id, name: document.name })),
      replacements
    )
    const documents = project.documents.map((document) => {
      const replacement = matches.get(document.id)
      if (!replacement) return document
      selectedPdfPaths.add(replacement.path)
      return { ...document, path: replacement.path, name: replacement.name, size: replacement.size }
    })
    const recovered = { ...project, documents, updatedAt: new Date().toISOString() }
    await projectStore.save(recovered)
    return {
      project: recovered,
      cancelled: false,
      recoveredSourceCount: matches.size,
      remainingMissingSourceCount: missingDocuments.length - matches.size
    }
  })

  ipcMain.handle('studio:exports:save', async (event, value: unknown) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    return saveExportRequest(
      value,
      async (options) => {
        const dialogOptions = {
          title: options.title,
          defaultPath: options.defaultPath,
          filters: [{ name: options.filterName, extensions: [options.extension] }],
          properties: ['showOverwriteConfirmation']
        } satisfies Electron.SaveDialogOptions
        return owner
          ? dialog.showSaveDialog(owner, dialogOptions)
          : dialog.showSaveDialog(dialogOptions)
      },
      async (path, content) => writeFile(path, content)
    )
  })

  ipcMain.handle('studio:exports:save-entry-images', async (event, value: unknown) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    return saveEntryImageRequest(
      value,
      () => {
        const options = {
          title: 'Choose where to create the entry image folder',
          properties: ['openDirectory', 'createDirectory']
        } satisfies Electron.OpenDialogOptions
        return owner ? dialog.showOpenDialog(owner, options) : dialog.showOpenDialog(options)
      },
      async (path) => mkdir(path),
      async (path, content) => writeFile(path, content)
    )
  })
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 520,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  const webContentsId = mainWindow.webContents.id

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  let forceClose = false
  mainWindow.on('close', (event) => {
    if (forceClose) return
    const state = closeGuardStates.get(webContentsId)
    if (!state || !shouldBlockClose(state)) return
    event.preventDefault()
    void dialog
      .showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Close EXACT EXTRACT?',
        message: closeGuardMessage(state) ?? 'The project has not finished saving.',
        buttons: ['Keep working', 'Close without saving'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      .then(({ response }) => {
        if (response !== 1) return
        forceClose = true
        closeGuardStates.delete(webContentsId)
        mainWindow.close()
      })
  })

  mainWindow.on('closed', () => {
    closeGuardStates.delete(webContentsId)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.exactextract.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const projectStore = new ProjectStore(join(app.getPath('userData'), 'pdf-extract-review-studio'))
  const payeeStore = new PayeeStore(join(app.getPath('userData'), 'pdf-extract-review-studio'))
  const merchantStore = new MerchantStore(
    join(app.getPath('userData'), 'pdf-extract-review-studio')
  )
  const projectImageStore = new ProjectImageStore(
    join(app.getPath('userData'), 'pdf-extract-review-studio', 'project-images')
  )
  registerDocumentHandlers(projectStore, payeeStore, merchantStore)

  void pruneProjectImages(
    join(app.getPath('userData'), 'pdf-extract-review-studio', 'project-images'),
    join(app.getPath('userData'), 'pdf-extract-review-studio', 'projects')
  ).catch(() => undefined)

  ipcMain.handle('studio:project-images:save', (_event, value: unknown) =>
    projectImageStore.save(value)
  )
  ipcMain.handle('studio:project-images:read-data-urls', (_event, refs: unknown) =>
    projectImageStore.readDataUrls(
      Array.isArray(refs) ? refs.filter((ref) => typeof ref === 'string') : []
    )
  )

  protocol.handle(PROJECT_IMAGE_SCHEME, (request) => {
    try {
      const ref = decodeURIComponent(new URL(request.url).pathname).replace(/^[/\\]+/, '')
      return net.fetch(pathToFileURL(projectImageStore.resolvePath(ref)).toString(), {
        method: request.method
      })
    } catch {
      return new Response('Project image not found.', { status: 404 })
    }
  })

  const ocrAssetRoot = is.dev
    ? join(app.getAppPath(), 'src', 'renderer', 'public', 'ocr')
    : join(__dirname, '..', 'renderer', 'ocr')
  protocol.handle(OCR_ASSET_SCHEME, (request) => {
    try {
      return net.fetch(pathToFileURL(resolveOcrAssetPath(ocrAssetRoot, request.url)).toString(), {
        method: request.method
      })
    } catch {
      return new Response('OCR asset not found.', { status: 404 })
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileSearch,
  FileText,
  FolderOpen,
  GripVertical,
  Plus,
  Redo2,
  Search,
  Undo2,
  Upload,
  X
} from 'lucide-react'
import { PdfViewer, type PdfViewerHandle } from './components/PdfViewer'
import { EntryEditor, type EntryEditPatch } from './components/EntryEditor'
import { EntriesList } from './components/EntriesList'
import { AnalysisWorkspace } from './components/AnalysisWorkspace'
import { ExportPanel, type PdfExportFormat } from './components/ExportPanel'
import { HeaderBar } from './components/HeaderBar'
import { SourcePdfPanel } from './components/SourcePdfPanel'
import { PagePreviewStrip } from './components/PagePreviewStrip'
import { PageThumbnail } from './components/PageThumbnail'
import { RecentProjectsPanel } from './components/RecentProjectsPanel'
import { ProductUpdatesPanel } from './components/ProductUpdatesPanel'
import { RemovePagesPanel } from './components/RemovePagesPanel'
import { HighlightToolPanel } from './components/HighlightToolPanel'
import { StyleProfilePanel } from './components/StyleProfilePanel'
import { ReferenceToolsPanel, type ReferenceToolResult } from './components/ReferenceToolsPanel'
import { MerchantLibraryPanel } from './components/MerchantLibraryPanel'
import { useMerchantLibrary } from './lib/useMerchantLibrary'
import {
  applyHighlightGeometry,
  measureHighlight,
  resolveHighlightTargets,
  type HighlightGeometryField,
  type HighlightScope,
  type HighlightStyleMode
} from './lib/highlightGeometry'
import {
  DEFAULT_KEPT_ENTRIES_LAYOUT,
  createDefaultKeptEntriesLayout
} from './components/keptEntriesLayout'
import { ReviewMergeSplitControls } from './components/ReviewMergeSplitControls'
import { KeptPngCanvasWorkspace } from './components/KeptPngCanvasWorkspace'
import { KeptTextCanvasWorkspace } from './components/KeptTextCanvasWorkspace'
import {
  RightWorkspace,
  type RightWorkspaceCommand,
  type RightWorkspaceMode
} from './components/RightWorkspace'
import {
  DEFAULT_ANALYSIS_CONFIGURATION,
  deriveAnalysisState,
  parseAnalysisState,
  serializeAnalysisState,
  type AnalysisConfiguration
} from './analysisPersistence'
import {
  analyzePdf,
  detectSourcePageNumberStyle,
  extractPdfLocally,
  scanPdfReferenceCandidates,
  scanPdfTextReferenceCandidates,
  type LocalParserResult,
  type PdfPreflightResult
} from './lib/pdf'
import { ExtractionBatchError, runExtractionBatch } from './lib/extractionBatch'
import { generateEntryPngFiles } from './lib/entryImageExport'
import {
  collectKeptImageRefs,
  loadKeptSessionImageUrls,
  resolveKeptImageDataUrls,
  resolveKeptImageUrl
} from './lib/keptImageResolution'
import {
  migrateLegacyBackground,
  resolveTemplateBackgroundDataUrls,
  type LegacyKeptEntriesBackground
} from './lib/canvasBackgroundStorage'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useIncrementalReviewFilter } from './hooks/useIncrementalReviewFilter'
import { normalizeReviewQuery } from './hooks/reviewFiltering'
import { classifyPdfFailure, validatePdfImportBatch, validatePdfLimits } from '../../hardening'
import { hasPdfHeader, remapPageNumber, restoreOriginalPageNumber } from './lib/removePdfPages'
import { detectDocumentStyleProfile } from './lib/documentStyle'
import type {
  DocumentStyleProfile,
  ExtractionSettings,
  ProjectDocument,
  ProjectEntry,
  ReviewStatus,
  ProjectState
} from '../../shared/contracts'
import {
  currencySymbol,
  POPULAR_CURRENCIES,
  resolveCurrencyCode,
  type CurrencyCode
} from '../../shared/currencies'
import type {
  KeptEntriesCanvasLayout,
  KeptImagePlacementOptions,
  KeptImageSourceDescriptor
} from '../../shared/keptEntriesLayout'
import type { KeptImageSourceRef } from '../../shared/keptEntriesLayout'
import type { KeptExportTemplate } from '../../shared/keptExportTemplate'
import {
  dividerStyleToKeptExportDivider,
  textStyleToKeptExportTextStyle,
  type TextStyleCluster
} from '../../shared/documentStyle'
import {
  createKeptExportTemplateDraft,
  toKeptExportTemplate
} from './components/keptExportTemplateDraft'
import { LengthField } from './components/LengthField'
import { LengthUnitSelect } from './components/LengthUnitSelect'
import { CANONICAL_LENGTH_UNIT, isLengthUnit, type LengthUnit } from '../../shared/units'
import { setLengthUnit as setStoredLengthUnit } from './lib/lengthUnitStore'
import type { TableColumnDefinition, TableTemplate } from '../../extraction'
import {
  saveFailureMessage,
  type RecentProjectRecoveryItem,
  type SaveRecoveryState
} from '../../recovery'
import {
  clearScannedReferenceNotes,
  copyKeptEntryReferencesToNotes,
  copySourceReferencesToKeptEntryNotes,
  detectReviewIssues,
  findEntryDirectlyAbove,
  findPreferredSourceRegion,
  mergeReviewEntries,
  reconcileReviewSelection,
  splitReviewEntry,
  type ReviewIssueCode
} from '../../review'
import {
  buildSessionKeptImageSources,
  buildExportSnapshot,
  buildKeptExportRenderPlan,
  buildKeptExportSourceRows,
  exportProjectCsv,
  exportProjectJson,
  exportProjectKeptEntriesCanvasPdf,
  exportProjectKeptEntriesTemplatePdf,
  exportProjectPdf,
  planKeptEntryImagePlacements,
  withKeptImagePlacements,
  type KeptImagePlan
} from '../../export'

type Screen = 'onboarding' | 'import' | 'preflight' | 'workspace'
type Theme = 'light' | 'dark'
type ExtractionMode = 'fast' | 'balanced' | 'maximum' | 'custom'
type CustomPageMode = 'recommended' | 'all' | 'range'

interface PageRemovalHistorySnapshot {
  project: ProjectState
  documents: ImportedDocument[]
  preflight: Record<string, PdfPreflightResult>
  pdfData: Uint8Array
  activePath: string
  reviewPage: number
}

interface ImportedDocument extends ProjectDocument {
  path: string
  name: string
  size: number
}

interface IncomingDocument {
  path: string
  name: string
  size: number
}

type StyledLocalParserResult = LocalParserResult & { styleProfile?: DocumentStyleProfile }

const modeOptions: Array<{ id: ExtractionMode; label: string; description: string }> = [
  { id: 'fast', label: 'Fast', description: 'Use embedded PDF text where available.' },
  { id: 'balanced', label: 'Balanced', description: 'OCR only pages that appear to need it.' },
  { id: 'maximum', label: 'Maximum', description: 'Run parser and OCR for highest coverage.' },
  { id: 'custom', label: 'Custom', description: 'Choose OCR languages and pages manually.' }
]

const ocrLanguageOptions = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' }
] as const

const TABLE_TEMPLATES_STORAGE_KEY = 'studio-table-templates'
const DEFAULT_REVIEW_PAGE_SPAN = 1

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function parsePageRange(value: string, maximumPage: number): number[] {
  const pages = new Set<number>()
  for (const part of value.split(',')) {
    const [startValue, endValue] = part.trim().split('-')
    const start = Number(startValue)
    const end = endValue === undefined ? start : Number(endValue)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue
    for (let page = start; page <= Math.min(end, maximumPage); page += 1) pages.add(page)
  }
  return [...pages].sort((left, right) => left - right)
}

function restorePreflight(project: ProjectState): Record<string, PdfPreflightResult> {
  return Object.fromEntries(
    project.documents.flatMap((document) => {
      const result = project.preflight.find((candidate) => candidate.documentId === document.id)
      if (!result) return []
      const dimensions = project.pages.filter((page) => page.documentId === document.id)
      const pages = result.pages.map((page) => {
        const sourcePage = dimensions.find((candidate) => candidate.pageNumber === page.pageNumber)
        const kind =
          page.kind === 'mixed' || page.kind === 'unknown'
            ? page.characterCount >= 24
              ? ('text' as const)
              : ('sparse' as const)
            : page.kind
        return {
          ...page,
          kind,
          width: sourcePage?.width ?? 0,
          height: sourcePage?.height ?? 0
        }
      })
      const textPageCount = pages.filter((page) => page.characterCount >= 24).length
      return [
        [
          document.path,
          {
            pageCount: pages.length,
            textPageCount,
            imagePageCount: pages.length - textPageCount,
            averageCharactersPerPage:
              pages.length === 0
                ? 0
                : Math.round(
                    pages.reduce((sum, page) => sum + page.characterCount, 0) / pages.length
                  ),
            recommendation: pages.some((page) => page.ocrRecommended)
              ? ('Selective OCR' as const)
              : ('Parser only' as const),
            pages,
            completedAt: result.completedAt
          }
        ]
      ]
    })
  )
}

const INTERACTIVE_SHORTCUT_SELECTOR =
  'button, input, textarea, select, [role="button"], [role="dialog"], [role="tab"], [role="menu"], [contenteditable="true"], .command-popup, .shortcuts-help'

/** Shortcuts are suppressed while focus sits on an interactive control. */
function isFocusableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest(INTERACTIVE_SHORTCUT_SELECTOR) !== null
}

function App(): React.JSX.Element {
  const screenHeadingRef = useRef<HTMLHeadingElement>(null)
  const undoStackRef = useRef<ProjectState['entries'][]>([])
  const redoStackRef = useRef<ProjectState['entries'][]>([])
  const pageRemovalUndoRef = useRef<PageRemovalHistorySnapshot[]>([])
  const pageRemovalRedoRef = useRef<PageRemovalHistorySnapshot[]>([])
  const extractionAbortRef = useRef<AbortController | null>(null)
  const referenceScanAbortRef = useRef<AbortController | null>(null)
  const lastOcrProgressAtRef = useRef(0)
  const lastSavedSnapshotRef = useRef<ProjectState | null>(null)
  const pdfViewerRef = useRef<PdfViewerHandle>(null)
  const entryEditorOpenerRef = useRef<HTMLElement | null>(null)
  const lastPointerRef = useRef({ x: 200, y: 200 })
  const editedPdfDataRef = useRef(new Map<string, Uint8Array>())
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [documents, setDocuments] = useState<ImportedDocument[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [mode, setMode] = useState<ExtractionMode>('balanced')
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('studio-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [panePercent, setPanePercent] = useState(() => {
    const saved = Number(localStorage.getItem('studio-pane-percent'))
    return saved >= 35 && saved <= 70 ? saved : 52
  })
  // Seeded from the last unit the user chose, then owned by the project once one is open.
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>(() => {
    const saved = localStorage.getItem('studio-length-unit')
    return isLengthUnit(saved) ? saved : CANONICAL_LENGTH_UNIT
  })
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(() =>
    resolveCurrencyCode(localStorage.getItem('studio-currency-code'))
  )
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<Record<string, PdfPreflightResult>>({})
  const [ocrLanguages, setOcrLanguages] = useState<string[]>(['eng'])
  const [customPageMode, setCustomPageMode] = useState<CustomPageMode>('recommended')
  const [pageRange, setPageRange] = useState('')
  const [tableTemplateEnabled, setTableTemplateEnabled] = useState(false)
  const [tableTemplateName, setTableTemplateName] = useState('Table template')
  const [tableHeaderLabels, setTableHeaderLabels] = useState('Description, Amount')
  const [tableTopY, setTableTopY] = useState('')
  const [tableBottomY, setTableBottomY] = useState('')
  const [tableTemplateStatus, setTableTemplateStatus] = useState<string | null>(null)
  const [styleDetectionStatus, setStyleDetectionStatus] = useState<string | null>(null)
  const [tableColumns, setTableColumns] = useState<TableColumnDefinition[]>([
    { name: 'Description', type: 'text', xStart: 36, xEnd: 300, required: true },
    { name: 'Amount', type: 'currency', xStart: 300, xEnd: 576, required: true }
  ])
  const [savedTableTemplates, setSavedTableTemplates] = useState<TableTemplate[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(TABLE_TEMPLATES_STORAGE_KEY) ?? '[]')
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (template): template is TableTemplate =>
          typeof template === 'object' &&
          template !== null &&
          typeof (template as TableTemplate).name === 'string' &&
          Array.isArray((template as TableTemplate).columns)
      )
    } catch {
      return []
    }
  })
  const [project, setProject] = useState<ProjectState | null>(null)
  const [recentProjects, setRecentProjects] = useState<RecentProjectRecoveryItem[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null)
  const [extractionProgress, setExtractionProgress] = useState<number | null>(null)
  const [extractionStage, setExtractionStage] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [reviewQuery, setReviewQuery] = useState('')
  const debouncedReviewQuery = useDebouncedValue(reviewQuery, 120)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | 'all'>('all')
  const [reviewSource, setReviewSource] = useState<'all' | 'parser' | 'ocr' | 'merged'>('all')
  const [reviewCategory, setReviewCategory] = useState('all')
  const [reviewIssueFilter, setReviewIssueFilter] = useState<ReviewIssueCode | 'all'>('all')
  const [requestedReviewSourcePage, setReviewSourcePage] = useState(1)
  const [viewAllReviewEntries, setViewAllReviewEntries] = useState(false)
  const [reviewPageSpan, setReviewPageSpan] = useState(String(DEFAULT_REVIEW_PAGE_SPAN))
  const [requestedPdfPage, setRequestedPdfPage] = useState<number | undefined>(undefined)
  const [historyState, setHistoryState] = useState({ undoCount: 0, redoCount: 0 })
  const [pageRemovalHistory, setPageRemovalHistory] = useState({ undoCount: 0, redoCount: 0 })
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(() => new Set())
  const [bulkTag, setBulkTag] = useState('')
  const [referenceCopyStatus, setReferenceCopyStatus] = useState('')
  const [referenceToolResults, setReferenceToolResults] = useState<
    Partial<Record<ReferenceToolResult['action'], ReferenceToolResult>>
  >({})
  const [isScanningSourceReferences, setIsScanningSourceReferences] = useState(false)
  const merchantLibrary = useMerchantLibrary()
  const addScenarioRows = useCallback((rows: readonly ProjectEntry[]): void => {
    if (rows.length === 0) return
    const occurredAt = new Date().toISOString()
    setProject((current) => {
      if (!current) return current
      undoStackRef.current = [...undoStackRef.current, current.entries]
      redoStackRef.current = []
      setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
      return {
        ...current,
        entries: [...current.entries, ...rows],
        auditTrail: [
          ...current.auditTrail,
          {
            id: crypto.randomUUID(),
            occurredAt,
            action: 'scenario-rows-added',
            entityType: 'project',
            entityId: current.id,
            details: {
              rows: rows.length,
              seed: (rows[0] as { scenarioSeed?: number }).scenarioSeed ?? 0
            }
          }
        ],
        updatedAt: occurredAt
      }
    })
  }, [])
  const [workspaceMode, setWorkspaceMode] = useState<RightWorkspaceMode>('source-pdf')
  const [analysisConfiguration, setAnalysisConfiguration] = useState<AnalysisConfiguration>(
    DEFAULT_ANALYSIS_CONFIGURATION
  )
  const [exportState, setExportState] = useState({ isSaving: false, status: 'Ready to export' })
  const [exportRowHeight, setExportRowHeight] = useState('18')
  const [commandPopup, setCommandPopup] = useState<{
    kind: 'search' | 'goto' | 'currency'
    x: number
    y: number
    value: string
  } | null>(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [isRemovingPages, setIsRemovingPages] = useState(false)
  const [pageRemovalStatus, setPageRemovalStatus] = useState('')
  const [keptEntriesLayout, setKeptEntriesLayout] = useState<KeptEntriesCanvasLayout>(
    DEFAULT_KEPT_ENTRIES_LAYOUT
  )
  const [keptExportTemplate, setKeptExportTemplate] = useState<KeptExportTemplate | undefined>()
  const [showKeptCanvas, setShowKeptCanvas] = useState<'png' | 'text' | null>(null)
  const [openKeptConfig, setOpenKeptConfig] = useState<'png' | 'text' | null>(null)
  // Session crops are regenerated for display only and dropped when the canvas closes.
  const [sessionImageUrls, setSessionImageUrls] = useState<ReadonlyMap<string, string>>(new Map())
  const [sessionImageError, setSessionImageError] = useState<string | null>(null)
  const [sessionImageRefreshToken, setSessionImageRefreshToken] = useState(0)
  const [isRefreshingSessionImages, setIsRefreshingSessionImages] = useState(false)

  const activeDocument = useMemo(
    () => documents.find((document) => document.path === activePath) ?? documents[0],
    [activePath, documents]
  )
  const activeStyleProfile = activeDocument?.styleProfile

  const projectRef = useRef(project)
  const documentsRef = useRef(documents)
  const activePathRef = useRef(activePath)
  const activeDocumentIdRef = useRef(activeDocument?.id)
  const reviewSourcePageRef = useRef(requestedReviewSourcePage)
  const selectedReviewIdsRef = useRef(selectedReviewIds)
  const pagedEntriesRef = useRef<readonly ProjectEntry[]>([])
  const sourcePageEntriesRef = useRef<readonly ProjectEntry[]>([])
  const filteredEntriesRef = useRef<readonly ProjectEntry[]>([])
  const isAnalyzing =
    screen === 'preflight' && documents.some((document) => !preflight[document.path])
  const maximumPage = Math.max(0, ...Object.values(preflight).map((result) => result.pageCount))
  const selectedPages = useMemo(
    () =>
      mode !== 'custom'
        ? undefined
        : customPageMode === 'recommended'
          ? [
              ...new Set(
                Object.values(preflight).flatMap((result) =>
                  result.pages.filter((page) => page.ocrRecommended).map((page) => page.pageNumber)
                )
              )
            ].sort((left, right) => left - right)
          : customPageMode === 'range'
            ? parsePageRange(pageRange, maximumPage)
            : undefined,
    [customPageMode, maximumPage, mode, pageRange, preflight]
  )
  const extractionSettings = useMemo<ExtractionSettings>(
    () => ({ mode, ocrLanguages, selectedPages }),
    [mode, ocrLanguages, selectedPages]
  )
  const tableTemplate = useMemo<TableTemplate | undefined>(() => {
    if (!tableTemplateEnabled) return undefined
    const topY = tableTopY.trim() === '' ? undefined : Number(tableTopY)
    const bottomY = tableBottomY.trim() === '' ? undefined : Number(tableBottomY)
    return {
      name: tableTemplateName.trim() || 'Table template',
      columns: tableColumns,
      ...(tableHeaderLabels.trim()
        ? {
            headerLabels: tableHeaderLabels
              .split(',')
              .map((label) => label.trim())
              .filter(Boolean)
          }
        : {}),
      ...(topY === undefined || !Number.isFinite(topY) ? {} : { topY }),
      ...(bottomY === undefined || !Number.isFinite(bottomY) ? {} : { bottomY })
    }
  }, [
    tableBottomY,
    tableColumns,
    tableHeaderLabels,
    tableTemplateEnabled,
    tableTemplateName,
    tableTopY
  ])
  const tableTemplateInvalid =
    tableTemplateEnabled &&
    (tableColumns.length === 0 ||
      tableColumns.some(
        (column) =>
          !column.name.trim() ||
          !Number.isFinite(column.xStart) ||
          !Number.isFinite(column.xEnd) ||
          column.xEnd <= column.xStart
      ) ||
      (tableTopY.trim() !== '' && !Number.isFinite(Number(tableTopY))) ||
      (tableBottomY.trim() !== '' && !Number.isFinite(Number(tableBottomY))) ||
      (tableTopY.trim() !== '' &&
        tableBottomY.trim() !== '' &&
        Number(tableTopY) <= Number(tableBottomY)))

  const saveTableTemplate = (): void => {
    if (tableTemplateInvalid || !tableTemplate) {
      setTableTemplateStatus('Fix the template fields before saving.')
      return
    }

    const nextTemplate = structuredClone(tableTemplate)
    setSavedTableTemplates((current) => {
      const next = [
        ...current.filter((template) => template.name !== nextTemplate.name),
        nextTemplate
      ].sort((left, right) => left.name.localeCompare(right.name))
      try {
        localStorage.setItem(TABLE_TEMPLATES_STORAGE_KEY, JSON.stringify(next))
        setTableTemplateStatus(`Saved “${nextTemplate.name}”.`)
      } catch {
        setTableTemplateStatus('Could not save the template in this app session.')
        return current
      }
      return next
    })
  }

  const loadTableTemplate = (name: string): void => {
    const template = savedTableTemplates.find((candidate) => candidate.name === name)
    if (!template) return
    setTableTemplateEnabled(true)
    setTableTemplateName(template.name)
    setTableHeaderLabels(template.headerLabels?.join(', ') ?? '')
    setTableTopY(template.topY === undefined ? '' : String(template.topY))
    setTableBottomY(template.bottomY === undefined ? '' : String(template.bottomY))
    setTableColumns(template.columns.map((column) => ({ ...column })))
  }

  const deleteTableTemplate = (): void => {
    const name = tableTemplateName.trim()
    if (!name) return
    setSavedTableTemplates((current) => {
      const next = current.filter((template) => template.name !== name)
      localStorage.setItem(TABLE_TEMPLATES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }
  const selectedEntry = useMemo(
    () => project?.entries.find((entry) => entry.id === selectedEntryId),
    [project?.entries, selectedEntryId]
  )
  const reviewIssues = useMemo(
    () =>
      detectReviewIssues(project?.entries ?? [], {
        pages: project?.pages,
        expectedRowHeight: Number(exportRowHeight)
      }),
    [exportRowHeight, project?.entries, project?.pages]
  )
  const issuesByEntry = useMemo(() => {
    const index = new Map<string, typeof reviewIssues>()
    for (const issue of reviewIssues) {
      for (const entryId of issue.entryIds)
        index.set(entryId, [...(index.get(entryId) ?? []), issue])
    }
    return index
  }, [reviewIssues])
  const normalizedDebouncedReviewQuery = normalizeReviewQuery(debouncedReviewQuery)
  const debouncedReviewFilterKey = [
    normalizedDebouncedReviewQuery,
    reviewStatus,
    reviewSource,
    reviewCategory,
    reviewIssueFilter
  ].join('|')
  const matchesReviewEntry = useCallback(
    (entry: ProjectEntry): boolean => {
      const matchesStatus = reviewStatus === 'all' || entry.status === reviewStatus
      const matchesSource = reviewSource === 'all' || entry.source === reviewSource
      const matchesCategory = reviewCategory === 'all' || entry.category === reviewCategory
      const matchesIssue = Boolean(
        reviewIssueFilter === 'all' ||
        issuesByEntry.get(entry.id)?.some((issue) => issue.code === reviewIssueFilter)
      )
      const matchesQuery =
        normalizedDebouncedReviewQuery.length === 0 ||
        entry.normalizedText.toLocaleLowerCase().includes(normalizedDebouncedReviewQuery) ||
        entry.tags.some((tag) =>
          tag.toLocaleLowerCase().includes(normalizedDebouncedReviewQuery)
        ) ||
        Boolean(entry.category?.toLocaleLowerCase().includes(normalizedDebouncedReviewQuery))
      return matchesStatus && matchesSource && matchesCategory && matchesIssue && matchesQuery
    },
    [
      issuesByEntry,
      normalizedDebouncedReviewQuery,
      reviewCategory,
      reviewIssueFilter,
      reviewSource,
      reviewStatus
    ]
  )
  const projectEntries = useMemo(() => project?.entries ?? [], [project?.entries])
  const filteredEntries = useIncrementalReviewFilter(
    projectEntries,
    debouncedReviewFilterKey,
    matchesReviewEntry
  )
  const activeDocumentId = activeDocument?.id
  const sourcePageCount = useMemo(
    () =>
      Math.max(
        1,
        preflight[activeDocument?.path ?? '']?.pageCount ?? activeDocument?.pageCount ?? 1
      ),
    [activeDocument?.pageCount, activeDocument?.path, preflight]
  )
  const pageAspectRatios = useMemo(() => {
    const pages = preflight[activeDocument?.path ?? '']?.pages ?? []
    return new Map(
      pages
        .filter((page) => page.width > 0 && page.height > 0)
        .map((page) => [page.pageNumber, page.width / page.height])
    )
  }, [activeDocument?.path, preflight])
  const reviewSourcePage = Math.min(requestedReviewSourcePage, sourcePageCount)
  const sourcePageEntries = useMemo(
    () =>
      filteredEntries.filter((entry) =>
        entry.regions.some(
          (region) =>
            region.documentId === activeDocumentId && region.pageNumber === reviewSourcePage
        )
      ),
    [activeDocumentId, filteredEntries, reviewSourcePage]
  )
  const activeDocumentEntries = useMemo(
    () =>
      filteredEntries.filter((entry) =>
        entry.regions.some((region) => region.documentId === activeDocumentId)
      ),
    [activeDocumentId, filteredEntries]
  )
  const pageReviewCounts = useMemo(() => {
    const counts = new Map<number, { keep: number; maybe: number; exclude: number }>()
    for (const entry of project?.entries ?? []) {
      const pages = new Set(
        entry.regions
          .filter((region) => region.documentId === activeDocumentId)
          .map((region) => region.pageNumber)
      )
      for (const pageNumber of pages) {
        const pageCounts = counts.get(pageNumber) ?? { keep: 0, maybe: 0, exclude: 0 }
        pageCounts[entry.status] += 1
        counts.set(pageNumber, pageCounts)
      }
    }
    return counts
  }, [activeDocumentId, project?.entries])
  const hasSearchQuery = reviewQuery.trim().length > 0
  const parsedReviewPageSpan = Math.max(1, Number(reviewPageSpan) || DEFAULT_REVIEW_PAGE_SPAN)
  const reviewPageEnd = Math.min(sourcePageCount, reviewSourcePage + parsedReviewPageSpan - 1)
  const visibleSourcePages = useMemo(
    () =>
      new Set(
        Array.from(
          { length: reviewPageEnd - reviewSourcePage + 1 },
          (_, index) => reviewSourcePage + index
        )
      ),
    [reviewPageEnd, reviewSourcePage]
  )
  const visibleReviewEntries = useMemo(
    () =>
      viewAllReviewEntries || hasSearchQuery
        ? activeDocumentEntries
        : filteredEntries.filter((entry) =>
            entry.regions.some(
              (region) =>
                region.documentId === activeDocumentId && visibleSourcePages.has(region.pageNumber)
            )
          ),
    [
      activeDocumentEntries,
      activeDocumentId,
      filteredEntries,
      hasSearchQuery,
      viewAllReviewEntries,
      visibleSourcePages
    ]
  )
  const pagedEntries = visibleReviewEntries

  useEffect(() => {
    projectRef.current = project
    documentsRef.current = documents
    activePathRef.current = activePath
    activeDocumentIdRef.current = activeDocument?.id
    reviewSourcePageRef.current = requestedReviewSourcePage
    selectedReviewIdsRef.current = selectedReviewIds
    pagedEntriesRef.current = pagedEntries
    sourcePageEntriesRef.current = sourcePageEntries
    filteredEntriesRef.current = filteredEntries
  }, [
    activeDocument?.id,
    activePath,
    documents,
    filteredEntries,
    pagedEntries,
    project,
    requestedReviewSourcePage,
    selectedReviewIds,
    sourcePageEntries
  ])

  const reviewCategories = useMemo(
    () =>
      [...new Set((project?.entries ?? []).map((entry) => entry.category).filter(Boolean))].sort(),
    [project?.entries]
  )
  const persistedAnalysisState = useMemo(
    () => deriveAnalysisState(project?.entries ?? [], analysisConfiguration),
    [analysisConfiguration, project?.entries]
  )
  const analysisSnapshot = persistedAnalysisState.snapshot
  const selectedReviewEntries = useMemo(
    () => (project?.entries ?? []).filter((entry) => selectedReviewIds.has(entry.id)),
    [project?.entries, selectedReviewIds]
  )
  const selectedRegion = useMemo(
    () => findPreferredSourceRegion(selectedEntry, activeDocumentId, reviewSourcePage),
    [activeDocumentId, reviewSourcePage, selectedEntry]
  )
  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedRegion?.documentId),
    [documents, selectedRegion?.documentId]
  )
  const selectedPage = useMemo(
    () =>
      selectedDocument
        ? preflight[selectedDocument.path]?.pages.find(
            (page) => page.pageNumber === selectedRegion?.pageNumber
          )
        : undefined,
    [preflight, selectedDocument, selectedRegion?.pageNumber]
  )
  const viewerHighlight = useMemo(
    () =>
      selectedRegion?.bbox && selectedPage && selectedRegion.bbox.coordinateSpace === 'pdf-points'
        ? {
            entryNumber:
              (project?.entries ?? []).findIndex((entry) => entry.id === selectedEntryId) + 1,
            page: selectedRegion.pageNumber,
            x: selectedRegion.bbox.x / selectedPage.width,
            y: 1 - (selectedRegion.bbox.y + selectedRegion.bbox.height) / selectedPage.height,
            width: selectedRegion.bbox.width / selectedPage.width,
            height: selectedRegion.bbox.height / selectedPage.height
          }
        : selectedRegion?.bbox && selectedRegion.bbox.coordinateSpace === 'normalized'
          ? { page: selectedRegion.pageNumber, ...selectedRegion.bbox }
          : undefined,
    [project?.entries, selectedEntryId, selectedPage, selectedRegion]
  )
  const viewerHighlights = useMemo(
    () =>
      (project?.entries ?? []).flatMap((entry) =>
        entry.regions.flatMap((region, regionIndex) => {
          const page =
            region.documentId === activeDocumentId
              ? preflight[activeDocument?.path ?? '']?.pages.find(
                  (candidate) => candidate.pageNumber === region.pageNumber
                )
              : undefined
          if (!page || !region.bbox) return []
          if (region.bbox.coordinateSpace === 'pdf-points') {
            return [
              {
                entryNumber:
                  (project?.entries.findIndex((candidate) => candidate.id === entry.id) ?? -1) + 1,
                regionIndex,
                page: region.pageNumber,
                x: region.bbox.x / page.width,
                y: 1 - (region.bbox.y + region.bbox.height) / page.height,
                width: region.bbox.width / page.width,
                height: region.bbox.height / page.height,
                status: entry.status,
                selected: entry.id === selectedEntryId,
                checked: selectedReviewIds.has(entry.id),
                entryId: entry.id
              }
            ]
          }
          return [
            {
              entryNumber:
                (project?.entries.findIndex((candidate) => candidate.id === entry.id) ?? -1) + 1,
              regionIndex,
              page: region.pageNumber,
              ...region.bbox,
              status: entry.status,
              selected: entry.id === selectedEntryId,
              checked: selectedReviewIds.has(entry.id),
              entryId: entry.id
            }
          ]
        })
      ),
    [
      activeDocument?.path,
      activeDocumentId,
      preflight,
      project?.entries,
      selectedEntryId,
      selectedReviewIds
    ]
  )
  const changeViewerHighlight = useCallback(
    (
      entryId: string,
      regionIndex: number,
      region: { x: number; y: number; width: number; height: number }
    ): void => {
      setProject((current) => {
        if (!current) return current
        const updatedAt = new Date().toISOString()
        return {
          ...current,
          updatedAt,
          entries: current.entries.map((entry) => {
            if (entry.id !== entryId) return entry
            const regions = entry.regions.map((sourceRegion, index) => {
              if (index !== regionIndex || !sourceRegion.bbox) return sourceRegion
              if (sourceRegion.bbox.coordinateSpace === 'normalized') {
                return {
                  ...sourceRegion,
                  bbox: { ...region, coordinateSpace: 'normalized' as const }
                }
              }
              const page = current.pages.find(
                (candidate) =>
                  candidate.documentId === sourceRegion.documentId &&
                  candidate.pageNumber === sourceRegion.pageNumber
              )
              if (!page) return sourceRegion
              return {
                ...sourceRegion,
                bbox: {
                  x: region.x * page.width,
                  y: (1 - region.y - region.height) * page.height,
                  width: region.width * page.width,
                  height: region.height * page.height,
                  coordinateSpace: 'pdf-points' as const
                }
              }
            })
            return { ...entry, regions, updatedAt }
          })
        }
      })
    },
    []
  )

  const [highlightsVisible, setHighlightsVisible] = useState(true)
  const [highlightEditMode, setHighlightEditMode] = useState(false)
  const [highlightStyleMode, setHighlightStyleMode] = useState<HighlightStyleMode>('filled')
  const [highlightScope, setHighlightScope] = useState<HighlightScope>('entry')
  const [highlightResult, setHighlightResult] = useState<string | null>(null)

  const highlightTargets = useMemo(
    () =>
      resolveHighlightTargets(project?.entries ?? [], {
        scope: highlightScope,
        documentId: activeDocumentId,
        // Keep and checked-entries scopes are already precisely defined without the page in
        // view, so only 'entry'/'all' stay restricted to the visible page.
        pageNumber:
          highlightScope === 'keep' || highlightScope === 'selected' ? undefined : requestedPdfPage,
        selectedEntryId,
        selectedEntryIds: selectedReviewIds
      }),
    [
      activeDocumentId,
      highlightScope,
      project?.entries,
      requestedPdfPage,
      selectedEntryId,
      selectedReviewIds
    ]
  )

  const highlightMeasurements = useMemo(() => {
    const target = resolveHighlightTargets(project?.entries ?? [], {
      scope: 'entry',
      documentId: activeDocumentId,
      pageNumber: requestedPdfPage,
      selectedEntryId
    })[0]
    return measureHighlight(project?.entries ?? [], target, project?.pages ?? [])
  }, [activeDocumentId, project?.entries, project?.pages, requestedPdfPage, selectedEntryId])

  const applyHighlightEdit = useCallback(
    (
      field: HighlightGeometryField,
      mode: 'absolute' | 'delta',
      value: number,
      unit: LengthUnit
    ): void => {
      setProject((current) => {
        if (!current) return current
        const updatedAt = new Date().toISOString()
        const currentTargets = resolveHighlightTargets(current.entries, {
          scope: highlightScope,
          documentId: activeDocumentId,
          pageNumber:
            highlightScope === 'keep' || highlightScope === 'selected'
              ? undefined
              : requestedPdfPage,
          selectedEntryId,
          selectedEntryIds: selectedReviewIdsRef.current
        })
        const result = applyHighlightGeometry(
          current.entries,
          currentTargets,
          { field, mode, value, unit },
          current.pages,
          updatedAt
        )
        if (result.changedRegionCount === 0) {
          setHighlightResult('No highlights were changed.')
          return current
        }
        setHighlightResult(
          `Updated ${result.changedRegionCount} highlight${
            result.changedRegionCount === 1 ? '' : 's'
          } across ${result.changedEntryCount} entr${result.changedEntryCount === 1 ? 'y' : 'ies'}.`
        )
        return { ...current, updatedAt, entries: result.entries }
      })
    },
    [activeDocumentId, highlightScope, requestedPdfPage, selectedEntryId]
  )

  const setHighlightTargetStatus = useCallback(
    (status: ReviewStatus): void => {
      setProject((current) => {
        if (!current) return current
        const targets = resolveHighlightTargets(current.entries, {
          scope: highlightScope,
          documentId: activeDocumentId,
          pageNumber:
            highlightScope === 'keep' || highlightScope === 'selected'
              ? undefined
              : requestedPdfPage,
          selectedEntryId,
          selectedEntryIds: selectedReviewIdsRef.current
        })
        const targetEntryIds = new Set(targets.map((target) => target.entryId))
        const changedIds = current.entries
          .filter((entry) => targetEntryIds.has(entry.id) && entry.status !== status)
          .map((entry) => entry.id)
        if (changedIds.length === 0) {
          setHighlightResult('No entries were changed.')
          return current
        }
        const updatedAt = new Date().toISOString()
        undoStackRef.current = [...undoStackRef.current, current.entries]
        redoStackRef.current = []
        setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
        const changedIdSet = new Set(changedIds)
        setHighlightResult(
          `Marked ${changedIds.length} entr${changedIds.length === 1 ? 'y' : 'ies'} as ${status}.`
        )
        return {
          ...current,
          updatedAt,
          entries: current.entries.map((entry) =>
            changedIdSet.has(entry.id) ? { ...entry, status, updatedAt } : entry
          ),
          auditTrail: [
            ...current.auditTrail,
            {
              id: crypto.randomUUID(),
              occurredAt: updatedAt,
              action: 'bulk-review-status-changed',
              entityType: 'project',
              entityId: current.id,
              details: { status, count: changedIds.length, source: 'marks-panel' }
            }
          ]
        }
      })
    },
    [activeDocumentId, highlightScope, requestedPdfPage, selectedEntryId]
  )

  const projectSnapshot = useMemo<ProjectState | null>(() => {
    if (!project) return null
    const analysisEvent = {
      id: `${project.id}:analysis-state`,
      occurredAt: analysisSnapshot.generatedAt,
      action: 'analysis-state-saved',
      entityType: 'analysis' as const,
      entityId: project.id,
      details: { state: serializeAnalysisState(persistedAnalysisState) }
    }
    return {
      ...project,
      documents,
      pages: documents.flatMap((document) =>
        (preflight[document.path]?.pages ?? []).map((page) => ({
          documentId: document.id,
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          rotation: page.rotation,
          kind: page.kind,
          confidence: page.confidence
        }))
      ),
      preflight: documents.flatMap((document) => {
        const result = preflight[document.path]
        if (!result) return []
        return [
          {
            documentId: document.id,
            kind:
              result.textPageCount === result.pageCount
                ? ('report' as const)
                : result.textPageCount > 0
                  ? ('mixed' as const)
                  : ('unknown' as const),
            confidence: 0.9,
            pages: result.pages.map((page) => ({
              pageNumber: page.pageNumber,
              kind: page.kind,
              characterCount: page.characterCount,
              confidence: page.confidence,
              ocrRecommended: page.ocrRecommended,
              rotation: page.rotation
            })),
            completedAt: result.completedAt
          }
        ]
      }),
      auditTrail: [
        ...project.auditTrail.filter((event) => event.action !== 'analysis-state-saved'),
        analysisEvent
      ],
      settings: {
        theme,
        extraction: extractionSettings,
        splitPanePercent: panePercent,
        lengthUnit,
        currencyCode
      },
      keptEntriesLayout,
      keptExportTemplate
    }
  }, [
    analysisSnapshot,
    documents,
    extractionSettings,
    lengthUnit,
    currencyCode,
    panePercent,
    persistedAnalysisState,
    preflight,
    project,
    theme,
    keptExportTemplate,
    keptEntriesLayout
  ])

  const projectSnapshotRef = useRef(projectSnapshot)
  useEffect(() => {
    projectSnapshotRef.current = projectSnapshot
  }, [projectSnapshot])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('studio-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('studio-pane-percent', String(panePercent))
  }, [panePercent])

  // Remembered only as the seed for the next new project; the open project owns the real value.
  useEffect(() => {
    setStoredLengthUnit(lengthUnit)
    localStorage.setItem('studio-length-unit', lengthUnit)
  }, [lengthUnit])

  useEffect(() => {
    localStorage.setItem('studio-currency-code', currencyCode)
  }, [currencyCode])

  useEffect(() => {
    screenHeadingRef.current?.focus()
  }, [screen])

  useEffect(() => {
    window.studio.projects
      .listRecovery()
      .then(setRecentProjects)
      .catch(() => setRecentProjects([]))
  }, [])

  useEffect(() => {
    if (!projectSnapshot) return
    const timeout = window.setTimeout(() => {
      setSaveStatus('saving')
      setSaveError(null)
      window.studio.projects
        .save(projectSnapshot)
        .then(() => {
          lastSavedSnapshotRef.current = projectSnapshot
          setSaveStatus('saved')
          return window.studio.projects.listRecovery()
        })
        .then(setRecentProjects)
        .catch((saveFailure: unknown) => {
          setSaveStatus('error')
          setSaveError(saveFailureMessage(saveFailure))
        })
    }, 600)
    return () => window.clearTimeout(timeout)
  }, [projectSnapshot])

  useEffect(() => {
    void window.studio.app.setCloseGuard({
      hasUnsavedChanges:
        saveStatus === 'error' ||
        (projectSnapshot !== null && projectSnapshot !== lastSavedSnapshotRef.current),
      saveInProgress: saveStatus === 'saving',
      extractionInProgress: extractionProgress !== null,
      exportInProgress: exportState.isSaving
    })
  }, [exportState.isSaving, extractionProgress, projectSnapshot, saveStatus])

  useEffect(() => {
    if (!activeDocument) return
    let cancelled = false
    const editedPdfData = editedPdfDataRef.current.get(activeDocument.path)
    const pdfPromise = editedPdfData
      ? Promise.resolve(editedPdfData)
      : window.studio.documents.readPdf(activeDocument.path)
    pdfPromise
      .then((data) => {
        if (!cancelled) setPdfData(new Uint8Array(data))
      })
      .catch((readError: unknown) => {
        if (!cancelled)
          setError(readError instanceof Error ? readError.message : 'Unable to read PDF.')
      })
    return () => {
      cancelled = true
    }
  }, [activeDocument])

  useEffect(() => {
    if (screen !== 'preflight') return
    const pending = documents.filter((document) => !preflight[document.path])
    if (!pending.length) return

    let cancelled = false
    Promise.all(
      pending.map(async (document) => {
        const data = await window.studio.documents.readPdf(document.path)
        const result = await analyzePdf(new Uint8Array(data))
        const limitFailure = validatePdfLimits(document.size, result.pageCount)
        if (limitFailure) throw new Error(limitFailure.message)
        return [document.path, result] as const
      })
    )
      .then((results) => {
        if (!cancelled) setPreflight((current) => ({ ...current, ...Object.fromEntries(results) }))
      })
      .catch((analysisError: unknown) => {
        if (!cancelled) setError(classifyPdfFailure(analysisError).message)
      })
    return () => {
      cancelled = true
    }
  }, [documents, preflight, screen])

  const mergeDocuments = useCallback(
    (incoming: IncomingDocument[]): void => {
      const limitFailure = validatePdfImportBatch(
        documents.map((document) => document.path),
        incoming
      )
      if (limitFailure) {
        setError(limitFailure.message)
        return
      }

      setDocuments((current) => {
        const knownPaths = new Set(current.map((document) => document.path))
        const importedAt = new Date().toISOString()
        return [
          ...current,
          ...incoming
            .filter((document) => !knownPaths.has(document.path))
            .map((document) => ({ ...document, id: crypto.randomUUID(), importedAt }))
        ]
      })
      if (incoming[0]) setActivePath((current) => current ?? incoming[0].path)
    },
    [documents]
  )

  const createProject = async (): Promise<void> => {
    setError(null)
    try {
      const created = await window.studio.projects.create(
        `PDF Review ${new Date().toLocaleDateString()}`
      )
      const selectedCurrencyCode = currencyCode
      setProject({
        ...created,
        settings: { ...created.settings, currencyCode: selectedCurrencyCode }
      })
      setCurrencyCode(selectedCurrencyCode)
      setAnalysisConfiguration(DEFAULT_ANALYSIS_CONFIGURATION)
      setKeptExportTemplate(undefined)
      setWorkspaceMode('review')
      setDocuments([])
      setPreflight({})
      setActivePath(null)
      setPdfData(null)
      setScreen('import')
      undoStackRef.current = []
      redoStackRef.current = []
      pageRemovalUndoRef.current = []
      pageRemovalRedoRef.current = []
      setPageRemovalHistory({ undoCount: 0, redoCount: 0 })
      setHistoryState({ undoCount: 0, redoCount: 0 })
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : 'Unable to create project.')
    }
  }

  const migrateProjectBackgrounds = useCallback(async (loaded: ProjectState): Promise<void> => {
    // Legacy project files can still carry inline bytes; the runtime type is ref-only.
    const layoutBackground = loaded.keptEntriesLayout?.background as
      LegacyKeptEntriesBackground | undefined
    if (layoutBackground?.dataUrl && !layoutBackground.ref) {
      const migrated = await migrateLegacyBackground(layoutBackground)
      if (migrated !== layoutBackground) {
        setKeptEntriesLayout((current) => ({ ...current, background: migrated }))
      }
    }

    const template = loaded.keptExportTemplate
    if (!template) return
    const [pageOne, laterPages] = await Promise.all([
      migrateLegacyBackground(template.pageOneTemplate.background),
      migrateLegacyBackground(template.laterPagesTemplate.background)
    ])
    if (
      pageOne === template.pageOneTemplate.background &&
      laterPages === template.laterPagesTemplate.background
    ) {
      return
    }
    setKeptExportTemplate((current) =>
      current
        ? {
            ...current,
            pageOneTemplate: { ...current.pageOneTemplate, background: pageOne },
            laterPagesTemplate: { ...current.laterPagesTemplate, background: laterPages }
          }
        : current
    )
  }, [])

  const openProject = useCallback(
    async (projectId: string): Promise<void> => {
      setError(null)
      try {
        const loaded = await window.studio.projects.load(projectId)
        await Promise.all(
          loaded.documents.map(async (document) => {
            if (!document.removedPages?.length) return
            const source = await window.studio.documents.readPdf(document.path)
            const reduced = await window.studio.documents.removePdfPages(new Uint8Array(source), [
              ...document.removedPages
            ])
            editedPdfDataRef.current.set(document.path, reduced.bytes)
          })
        )
        const savedAnalysis = parseAnalysisState(
          [...loaded.auditTrail].reverse().find((event) => event.action === 'analysis-state-saved')
            ?.details?.state
        )
        setProject(loaded)
        setKeptEntriesLayout(
          loaded.keptEntriesLayout ?? createDefaultKeptEntriesLayout(loaded.entries)
        )
        setKeptExportTemplate(loaded.keptExportTemplate)
        void migrateProjectBackgrounds(loaded)
        setAnalysisConfiguration(savedAnalysis?.configuration ?? DEFAULT_ANALYSIS_CONFIGURATION)
        setWorkspaceMode('review')
        setDocuments(loaded.documents)
        setPreflight(restorePreflight(loaded))
        setActivePath(loaded.documents[0]?.path ?? null)
        setPdfData(null)
        setMode(loaded.settings.extraction.mode)
        setOcrLanguages(loaded.settings.extraction.ocrLanguages)
        setPanePercent(loaded.settings.splitPanePercent)
        setLengthUnit(loaded.settings.lengthUnit ?? CANONICAL_LENGTH_UNIT)
        setCurrencyCode(resolveCurrencyCode(loaded.settings.currencyCode))
        if (loaded.settings.theme !== 'system') setTheme(loaded.settings.theme)
        setScreen(loaded.documents.length > 0 ? 'workspace' : 'import')
        undoStackRef.current = []
        redoStackRef.current = []
        pageRemovalUndoRef.current = []
        pageRemovalRedoRef.current = []
        setPageRemovalHistory({ undoCount: 0, redoCount: 0 })
        setHistoryState({ undoCount: 0, redoCount: 0 })
      } catch (projectError) {
        setError(projectError instanceof Error ? projectError.message : 'Unable to open project.')
      }
    },
    [migrateProjectBackgrounds]
  )

  const removeRecentProject = useCallback(async (projectId: string): Promise<void> => {
    await window.studio.projects.removeRecent(projectId)
    setRecentProjects(await window.studio.projects.listRecovery())
  }, [])

  const locateProjectSources = useCallback(async (projectId: string): Promise<void> => {
    setRecoveryStatus('Locating missing source files...')
    try {
      const result = await window.studio.projects.locateSources(projectId)
      setRecentProjects(await window.studio.projects.listRecovery())
      if (result.cancelled) {
        setRecoveryStatus('Source recovery cancelled. No project files were changed.')
      } else if (result.remainingMissingSourceCount === 0) {
        setRecoveryStatus(
          `${result.recoveredSourceCount} missing source${result.recoveredSourceCount === 1 ? '' : 's'} recovered.`
        )
      } else {
        setRecoveryStatus(
          `${result.recoveredSourceCount} source${result.recoveredSourceCount === 1 ? '' : 's'} recovered; ${result.remainingMissingSourceCount} still missing.`
        )
      }
    } catch (recoveryError) {
      setRecoveryStatus(
        recoveryError instanceof Error ? recoveryError.message : 'Source recovery failed.'
      )
    }
  }, [])

  const retrySave = useCallback(async (): Promise<void> => {
    if (!projectSnapshot) return
    setSaveStatus('saving')
    setSaveError(null)
    try {
      await window.studio.projects.save(projectSnapshot)
      lastSavedSnapshotRef.current = projectSnapshot
      setSaveStatus('saved')
      setRecentProjects(await window.studio.projects.listRecovery())
    } catch (saveFailure) {
      setSaveStatus('error')
      setSaveError(saveFailureMessage(saveFailure))
    }
  }, [projectSnapshot])

  const startExtraction = async (): Promise<void> => {
    if (!project || documents.length === 0 || extractionAbortRef.current) return
    const jobId = crypto.randomUUID()
    const startedAt = new Date().toISOString()
    const controller = new AbortController()
    extractionAbortRef.current = controller
    setError(null)
    setExtractionProgress(0)
    setExtractionStage('Preparing extraction')
    lastOcrProgressAtRef.current = 0
    setProject((current) =>
      current
        ? {
            ...current,
            extractionJobs: [
              ...current.extractionJobs,
              {
                id: jobId,
                documentIds: documents.map((document) => document.id),
                settings: extractionSettings,
                status: 'running',
                progress: 0,
                startedAt
              }
            ]
          }
        : current
    )
    try {
      const results = await runExtractionBatch<StyledLocalParserResult>(documents, {
        signal: controller.signal,
        onDocumentStart: (document) => setExtractionStage(`Parsing ${document.name}`),
        extract: async (document, onProgress) => {
          const data = await window.studio.documents.readPdf(document.path)
          const sourceBytes = new Uint8Array(data)
          const result = await extractPdfLocally(document.id, sourceBytes, {
            settings: extractionSettings,
            tableTemplate,
            signal: controller.signal,
            onOcrProgress: onProgress
          })
          try {
            const styleProfile = await detectDocumentStyleProfile(document.id, sourceBytes)
            return { ...result, styleProfile }
          } catch (styleError) {
            const message =
              styleError instanceof Error ? styleError.message : 'Style detection failed.'
            setStyleDetectionStatus(`Style detection warning for ${document.name}: ${message}`)
            return result
          }
        },
        onProgress: (batchProgress) => {
          const progress = batchProgress.ocr
          if (progress) {
            const now = performance.now()
            if (progress.progress < 1 && now - lastOcrProgressAtRef.current < 50) return
            lastOcrProgressAtRef.current = now
            const stageLabel =
              progress.stage === 'rasterizing'
                ? 'Rendering OCR page'
                : progress.stage === 'recognizing'
                  ? progress.status || 'Recognizing text'
                  : progress.stage === 'merging'
                    ? 'Merging parser and OCR results'
                    : 'Planning extraction'
            setExtractionStage(
              progress.pageNumber ? `${stageLabel} ${progress.pageNumber}` : stageLabel
            )
          }
          setExtractionProgress(batchProgress.overallProgress)
          if (!progress) {
            setProject((current) =>
              current
                ? {
                    ...current,
                    extractionJobs: current.extractionJobs.map((job) =>
                      job.id === jobId ? { ...job, progress: batchProgress.overallProgress } : job
                    )
                  }
                : current
            )
          }
        }
      })
      const entries = results.flatMap((result) => result.entries)
      const styleProfiles = new Map(
        results.flatMap((result) =>
          result.styleProfile ? [[result.extraction.documentId, result.styleProfile] as const] : []
        )
      )
      const completedAt = new Date().toISOString()
      if (styleProfiles.size > 0) {
        setDocuments((current) =>
          current.map((document) => {
            const styleProfile = styleProfiles.get(document.id)
            return styleProfile ? { ...document, styleProfile } : document
          })
        )
        setStyleDetectionStatus(
          `Style profile updated for ${styleProfiles.size} document${styleProfiles.size === 1 ? '' : 's'}.`
        )
      }
      setProject((current) =>
        current
          ? {
              ...current,
              entries,
              extractionJobs: current.extractionJobs.map((job) =>
                job.id === jobId ? { ...job, status: 'completed', progress: 1, completedAt } : job
              )
            }
          : current
      )
      setSelectedEntryId(entries[0]?.id ?? null)
      setKeptEntriesLayout((current) =>
        current.placements.length === 0 ? createDefaultKeptEntriesLayout(entries) : current
      )
      setScreen('workspace')
    } catch (extractionError) {
      const cancelled =
        controller.signal.aborted ||
        (extractionError instanceof DOMException && extractionError.name === 'AbortError')
      const completedResults =
        extractionError instanceof ExtractionBatchError
          ? (extractionError.completedResults as readonly LocalParserResult[])
          : []
      const partialEntries = completedResults.flatMap((result) => result.entries)
      const completedDocumentIds = new Set(
        completedResults.map((result) => result.extraction.documentId)
      )
      const baseMessage = cancelled
        ? 'Extraction cancelled.'
        : classifyPdfFailure(extractionError).message
      const message =
        !cancelled && completedResults.length > 0
          ? `${baseMessage} Results from ${completedResults.length} completed document${completedResults.length === 1 ? '' : 's'} were preserved.`
          : baseMessage
      setProject((current) =>
        current
          ? {
              ...current,
              ...(!cancelled && completedDocumentIds.size > 0
                ? {
                    entries: [
                      ...current.entries.filter((entry) =>
                        entry.regions.every(
                          (region) => !completedDocumentIds.has(region.documentId)
                        )
                      ),
                      ...partialEntries
                    ]
                  }
                : {}),
              extractionJobs: current.extractionJobs.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      status: cancelled ? 'cancelled' : 'failed',
                      completedAt: new Date().toISOString(),
                      ...(cancelled ? {} : { error: message })
                    }
                  : job
              )
            }
          : current
      )
      if (!cancelled) setError(message)
    } finally {
      extractionAbortRef.current = null
      setExtractionProgress(null)
      setExtractionStage(null)
    }
  }

  const cancelExtraction = (): void => {
    setExtractionStage('Cancelling extraction')
    extractionAbortRef.current?.abort()
  }

  const choosePdfs = useCallback(async (): Promise<void> => {
    setError(null)
    setIsImporting(true)
    try {
      mergeDocuments(await window.studio.documents.choosePdfs())
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import PDFs.')
    } finally {
      setIsImporting(false)
    }
  }, [mergeDocuments])

  const handleDrop = async (files: File[]): Promise<void> => {
    const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'))
    setIsDragging(false)
    if (!pdfFiles.length) {
      setError('Drop one or more PDF files.')
      return
    }
    setError(null)
    setIsImporting(true)
    try {
      mergeDocuments(await window.studio.documents.importDroppedPdfs(pdfFiles))
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Unable to import dropped PDFs.'
      )
    } finally {
      setIsImporting(false)
    }
  }

  const beginResize = (event: React.PointerEvent<HTMLDivElement>): void =>
    event.currentTarget.setPointerCapture(event.pointerId)
  const resize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const shell = event.currentTarget.parentElement
    if (!shell) return
    const bounds = shell.getBoundingClientRect()
    setPanePercent(Math.min(70, Math.max(35, ((event.clientX - bounds.left) / bounds.width) * 100)))
  }
  const endResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const nextPercent =
      event.key === 'Home'
        ? 35
        : event.key === 'End'
          ? 70
          : event.key === 'ArrowLeft'
            ? panePercent - 2
            : event.key === 'ArrowRight'
              ? panePercent + 2
              : null
    if (nextPercent === null) return
    event.preventDefault()
    setPanePercent(Math.min(70, Math.max(35, nextPercent)))
  }

  const toggleOcrLanguage = (language: string): void => {
    setOcrLanguages((current) =>
      current.includes(language)
        ? current.filter((candidate) => candidate !== language)
        : [...current, language]
    )
  }

  const openEntryEditor = useCallback((entryId: string): void => {
    entryEditorOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingEntryId(entryId)
  }, [])

  const closeEntryEditor = useCallback((): void => {
    setEditingEntryId(null)
    requestAnimationFrame(() => entryEditorOpenerRef.current?.focus())
  }, [])

  const setEntryStatus = useCallback((entryId: string, status: ReviewStatus): void => {
    const updatedAt = new Date().toISOString()
    setProject((current) =>
      current
        ? (() => {
            const entry = current.entries.find((candidate) => candidate.id === entryId)
            if (!entry || entry.status === status) return current
            undoStackRef.current = [...undoStackRef.current, current.entries]
            redoStackRef.current = []
            setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
            return {
              ...current,
              entries: current.entries.map((candidate) =>
                candidate.id === entryId ? { ...candidate, status, updatedAt } : candidate
              ),
              auditTrail: [
                ...current.auditTrail,
                {
                  id: crypto.randomUUID(),
                  occurredAt: updatedAt,
                  action: 'review-status-changed',
                  entityType: 'entry',
                  entityId: entryId,
                  details: { from: entry.status, to: status }
                }
              ]
            }
          })()
        : current
    )
  }, [])

  const saveEntryEdit = useCallback(
    (entryId: string, patch: EntryEditPatch): void => {
      const updatedAt = new Date().toISOString()
      setProject((current) =>
        current
          ? (() => {
              const entry = current.entries.find((candidate) => candidate.id === entryId)
              if (!entry) return current
              undoStackRef.current = [...undoStackRef.current, current.entries]
              redoStackRef.current = []
              setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
              return {
                ...current,
                entries: current.entries.map((candidate) =>
                  candidate.id === entryId ? { ...candidate, ...patch, updatedAt } : candidate
                ),
                auditTrail: [
                  ...current.auditTrail,
                  {
                    id: crypto.randomUUID(),
                    occurredAt: updatedAt,
                    action: 'entry-edited',
                    entityType: 'entry',
                    entityId: entryId,
                    details: { fields: 'normalizedText,category,numericValue,date,notes,tags' }
                  }
                ]
              }
            })()
          : current
      )
      closeEntryEditor()
    },
    [closeEntryEditor]
  )

  const setBulkEntryStatus = useCallback((status: ReviewStatus): void => {
    const selectedIds = selectedReviewIdsRef.current
    if (selectedIds.size === 0) return
    const updatedAt = new Date().toISOString()
    setProject((current) =>
      current
        ? (() => {
            const changedIds = current.entries
              .filter((entry) => selectedIds.has(entry.id) && entry.status !== status)
              .map((entry) => entry.id)
            if (changedIds.length === 0) return current
            undoStackRef.current = [...undoStackRef.current, current.entries]
            redoStackRef.current = []
            setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
            const changedIdSet = new Set(changedIds)
            return {
              ...current,
              entries: current.entries.map((entry) =>
                changedIdSet.has(entry.id) ? { ...entry, status, updatedAt } : entry
              ),
              auditTrail: [
                ...current.auditTrail,
                {
                  id: crypto.randomUUID(),
                  occurredAt: updatedAt,
                  action: 'bulk-review-status-changed',
                  entityType: 'project',
                  entityId: current.id,
                  details: { status, count: changedIds.length }
                }
              ]
            }
          })()
        : current
    )
  }, [])

  const toggleReviewSelection = useCallback((entryId: string): void => {
    setSelectedReviewIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }, [])

  const addBulkTag = useCallback((): void => {
    const tag = bulkTag.trim()
    const proj = projectRef.current
    const selectedIds = selectedReviewIdsRef.current
    if (!proj || !tag || selectedIds.size === 0) return
    const changed = proj.entries.filter(
      (entry) => selectedIds.has(entry.id) && !entry.tags.includes(tag)
    )
    if (changed.length === 0) return
    const occurredAt = new Date().toISOString()
    undoStackRef.current = [...undoStackRef.current, proj.entries]
    redoStackRef.current = []
    setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
    setProject({
      ...proj,
      entries: proj.entries.map((entry) =>
        selectedIds.has(entry.id) && !entry.tags.includes(tag)
          ? { ...entry, tags: [...entry.tags, tag].sort(), updatedAt: occurredAt }
          : entry
      ),
      auditTrail: [
        ...proj.auditTrail,
        {
          id: crypto.randomUUID(),
          occurredAt,
          action: 'bulk-tag-added',
          entityType: 'project',
          entityId: proj.id,
          details: { tag, count: changed.length }
        }
      ]
    })
    setBulkTag('')
  }, [bulkTag])

  const clearScannedReferences = useCallback((): void => {
    const occurredAt = new Date().toISOString()
    setProject((current) => {
      if (!current) return current
      const result = clearScannedReferenceNotes(current.entries, occurredAt)
      setReferenceToolResults({})
      if (result.updatedEntryCount === 0) {
        setReferenceCopyStatus('No scanned reference lines found in entry notes.')
        return current
      }
      undoStackRef.current = [...undoStackRef.current, current.entries]
      redoStackRef.current = []
      setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
      setReferenceCopyStatus(
        `Removed ${result.removedReferenceCount} scanned reference${result.removedReferenceCount === 1 ? '' : 's'} from ${result.updatedEntryCount} entr${result.updatedEntryCount === 1 ? 'y' : 'ies'}. Re-run a scan to rebuild them.`
      )
      return {
        ...current,
        entries: result.entries,
        auditTrail: [
          ...current.auditTrail,
          {
            id: crypto.randomUUID(),
            occurredAt,
            action: 'scanned-reference-notes-cleared',
            entityType: 'project',
            entityId: current.id,
            details: {
              entries: result.updatedEntryCount,
              references: result.removedReferenceCount
            }
          }
        ],
        updatedAt: occurredAt
      }
    })
  }, [])

  const copyKeptReferencesToNotes = useCallback((): void => {
    const occurredAt = new Date().toISOString()
    setProject((current) => {
      if (!current) return current
      const result = copyKeptEntryReferencesToNotes(current.entries, occurredAt)
      setReferenceToolResults((current) => ({
        ...current,
        existing: {
          action: 'existing',
          candidateCount: result.copiedReferenceCount,
          matchedEntryCount: result.updatedEntryCount,
          copiedReferenceCount: result.copiedReferenceCount,
          unmatchedCandidateCount: 0
        }
      }))
      if (result.updatedEntryCount === 0) {
        setReferenceCopyStatus('No kept-entry references found to copy.')
        return current
      }
      undoStackRef.current = [...undoStackRef.current, current.entries]
      redoStackRef.current = []
      setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
      setReferenceCopyStatus(
        `Copied ${result.copiedReferenceCount} reference${result.copiedReferenceCount === 1 ? '' : 's'} into ${result.updatedEntryCount} kept entr${result.updatedEntryCount === 1 ? 'y' : 'ies'}.`
      )
      return {
        ...current,
        entries: result.entries,
        auditTrail: [
          ...current.auditTrail,
          {
            id: crypto.randomUUID(),
            occurredAt,
            action: 'kept-references-copied-to-notes',
            entityType: 'project',
            entityId: current.id,
            details: {
              entries: result.updatedEntryCount,
              references: result.copiedReferenceCount
            }
          }
        ],
        updatedAt: occurredAt
      }
    })
  }, [])

  const scanPdfTextReferencesToNotes = useCallback(async (): Promise<void> => {
    const proj = projectRef.current
    if (!proj || !activeDocument) {
      setReferenceCopyStatus('Select a source document before scanning references.')
      return
    }
    setIsScanningSourceReferences(true)
    setReferenceCopyStatus('Scanning selectable PDF text for references...')
    try {
      const editedData = editedPdfDataRef.current.get(activeDocument.path)
      const data =
        editedData ?? new Uint8Array(await window.studio.documents.readPdf(activeDocument.path))
      const scannedPages = new Set(
        proj.entries
          .filter((entry) => entry.status === 'keep')
          .flatMap((entry) =>
            entry.regions.flatMap((region) =>
              region.documentId === activeDocument.id ? [region.pageNumber] : []
            )
          )
      )
      const references = await scanPdfTextReferenceCandidates(activeDocument.id, data, scannedPages)
      const occurredAt = new Date().toISOString()
      const scannedPageCount = scannedPages.size
      setProject((current) => {
        if (!current) return current
        const result = copySourceReferencesToKeptEntryNotes(
          current.entries,
          references,
          occurredAt,
          {
            scannedPageCount
          }
        )
        setReferenceToolResults((current) => ({
          ...current,
          'pdf-text': {
            action: 'pdf-text',
            scannedPageCount,
            candidateCount: result.candidateCount,
            matchedCandidateCount: result.matchedCandidateCount,
            matchedEntryCount: result.matchedEntryCount,
            copiedReferenceCount: result.copiedReferenceCount,
            unmatchedCandidateCount: result.unmatchedCandidateCount,
            noSamePageParentCount: result.noSamePageParentCount,
            tooFarCandidateCount: result.tooFarCandidateCount,
            closestUnmatchedScore: result.closestUnmatchedScore,
            alreadyPresentReferenceCount: result.alreadyPresentReferenceCount
          }
        }))
        if (result.updatedEntryCount === 0) {
          setReferenceCopyStatus('No PDF text references matched kept entries.')
          return current
        }
        undoStackRef.current = [...undoStackRef.current, current.entries]
        redoStackRef.current = []
        setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
        setReferenceCopyStatus(
          `PDF text scan copied ${result.copiedReferenceCount} reference${result.copiedReferenceCount === 1 ? '' : 's'} into ${result.updatedEntryCount} kept entr${result.updatedEntryCount === 1 ? 'y' : 'ies'}.`
        )
        return { ...current, entries: result.entries, updatedAt: occurredAt }
      })
    } catch (scanError) {
      setReferenceCopyStatus(
        scanError instanceof Error ? scanError.message : 'Unable to scan PDF text references.'
      )
    } finally {
      setIsScanningSourceReferences(false)
    }
  }, [activeDocument])

  const scanSourceReferencesToNotes = useCallback(async (): Promise<void> => {
    const proj = projectRef.current
    if (!proj || !activeDocument) {
      setReferenceCopyStatus('Select a source document before scanning references.')
      return
    }
    const controller = new AbortController()
    referenceScanAbortRef.current = controller
    setIsScanningSourceReferences(true)
    setReferenceCopyStatus('Scanning source PDF references...')
    try {
      const editedData = editedPdfDataRef.current.get(activeDocument.path)
      const data =
        editedData ?? new Uint8Array(await window.studio.documents.readPdf(activeDocument.path))
      const references = await scanPdfReferenceCandidates(activeDocument.id, data, {
        entries: proj.entries,
        languages: proj.settings.extraction.ocrLanguages,
        signal: controller.signal,
        onProgress: (progress) => {
          const label =
            progress.stage === 'rasterizing'
              ? 'Preparing page image'
              : progress.stage === 'recognizing'
                ? progress.status || 'Reading reference text'
                : 'Filtering reference candidates'
          setReferenceCopyStatus(
            progress.pageNumber
              ? `${label} ${progress.pageNumber} · ${Math.round(progress.progress * 100)}%`
              : `${label} · ${Math.round(progress.progress * 100)}%`
          )
        }
      })
      const occurredAt = new Date().toISOString()
      const scannedPageCount = new Set(
        proj.entries
          .filter((entry) => entry.status === 'keep')
          .flatMap((entry) =>
            entry.regions.flatMap((region) =>
              region.documentId === activeDocument.id ? [region.pageNumber] : []
            )
          )
      ).size
      setProject((current) => {
        if (!current) return current
        const result = copySourceReferencesToKeptEntryNotes(
          current.entries,
          references,
          occurredAt,
          {
            scannedPageCount
          }
        )
        setReferenceToolResults((current) => ({
          ...current,
          ocr: {
            action: 'ocr',
            scannedPageCount: result.scannedPageCount ?? scannedPageCount,
            candidateCount: result.candidateCount,
            matchedCandidateCount: result.matchedCandidateCount,
            matchedEntryCount: result.matchedEntryCount,
            copiedReferenceCount: result.copiedReferenceCount,
            unmatchedCandidateCount: result.unmatchedCandidateCount,
            noSamePageParentCount: result.noSamePageParentCount,
            tooFarCandidateCount: result.tooFarCandidateCount,
            closestUnmatchedScore: result.closestUnmatchedScore,
            alreadyPresentReferenceCount: result.alreadyPresentReferenceCount
          }
        }))
        if (result.updatedEntryCount === 0) {
          setReferenceCopyStatus(
            `${result.candidateCount ?? 0} OCR candidates found; ${result.matchedCandidateCount ?? 0} matched a kept entry, ${result.noSamePageParentCount ?? 0} had no kept parent on the same page, ${result.tooFarCandidateCount ?? 0} were too far away, and ${result.alreadyPresentReferenceCount ?? 0} references were already in notes. No new notes were added.`
          )
          return current
        }
        undoStackRef.current = [...undoStackRef.current, current.entries]
        redoStackRef.current = []
        setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
        setReferenceCopyStatus(
          `OCR re-scan: ${result.copiedReferenceCount} reference${result.copiedReferenceCount === 1 ? '' : 's'} copied to ${result.updatedEntryCount} kept entr${result.updatedEntryCount === 1 ? 'y' : 'ies'} from ${result.candidateCount ?? 0} candidate${result.candidateCount === 1 ? '' : 's'}.`
        )
        return {
          ...current,
          entries: result.entries,
          auditTrail: [
            ...current.auditTrail,
            {
              id: crypto.randomUUID(),
              occurredAt,
              action: 'ocr-reference-scan-notes-updated',
              entityType: 'document',
              entityId: activeDocument.id,
              details: {
                pagesScanned: result.scannedPageCount ?? scannedPageCount,
                candidates: result.candidateCount ?? references.length,
                matchedEntries: result.matchedEntryCount ?? 0,
                entries: result.updatedEntryCount,
                references: result.copiedReferenceCount
              }
            }
          ],
          updatedAt: occurredAt
        }
      })
    } catch (scanError) {
      const cancelled =
        controller.signal.aborted ||
        (scanError instanceof DOMException && scanError.name === 'AbortError')
      setReferenceCopyStatus(
        cancelled
          ? 'Reference re-scan cancelled. No entry notes were changed.'
          : scanError instanceof Error
            ? scanError.message
            : 'Unable to scan source references.'
      )
    } finally {
      if (referenceScanAbortRef.current === controller) referenceScanAbortRef.current = null
      setIsScanningSourceReferences(false)
    }
  }, [activeDocument])

  const cancelSourceReferenceScan = useCallback((): void => {
    referenceScanAbortRef.current?.abort()
    setReferenceCopyStatus('Cancelling reference re-scan...')
  }, [])

  const navigateToEntry = useCallback((entryId: string): void => {
    const entry = projectRef.current?.entries.find((candidate) => candidate.id === entryId)
    const region = findPreferredSourceRegion(
      entry,
      activeDocumentIdRef.current,
      reviewSourcePageRef.current
    )
    setSelectedEntryId(entryId)
    if (region?.pageNumber) {
      setRequestedPdfPage(region.pageNumber)
      setReviewSourcePage(region.pageNumber)
    }
    const source = documentsRef.current.find((document) => document.id === region?.documentId)
    if (source && source.path !== activePathRef.current) {
      setPdfData(null)
      setActivePath(source.path)
    }
  }, [])

  const navigateToReviewPage = useCallback(
    (page: number): void => {
      const nextPage = Math.min(sourcePageCount, Math.max(1, page))
      setReviewSourcePage(nextPage)
      setRequestedPdfPage(nextPage)
      const firstEntry = filteredEntries.find((entry) =>
        entry.regions.some(
          (region) => region.documentId === activeDocumentId && region.pageNumber === nextPage
        )
      )
      if (firstEntry) navigateToEntry(firstEntry.id)
    },
    [activeDocumentId, filteredEntries, navigateToEntry, sourcePageCount]
  )

  const handlePdfPageChange = useCallback((page: number): void => {
    setRequestedPdfPage(page)
    setReviewSourcePage(page)
    setSelectedEntryId(null)
  }, [])

  const focusEntryInReview = useCallback(
    (entryId: string): void => {
      setWorkspaceMode('review')
      navigateToEntry(entryId)
    },
    [navigateToEntry]
  )

  const removePages = useCallback(
    async (pagesToRemove: number[]): Promise<void> => {
      if (!activeDocument) {
        setError('Select a PDF before removing pages.')
        setPageRemovalStatus('No active PDF is selected.')
        return
      }
      if (!pdfData) {
        setError('The PDF is still loading. Wait for the page preview, then try again.')
        setPageRemovalStatus('The PDF is still loading. Try again when the preview is visible.')
        return
      }
      if (!project) {
        setError('Open a project before removing pages.')
        return
      }
      setPageRemovalStatus('Preparing page removal...')
      setIsRemovingPages(true)
      try {
        const editedPdfData = editedPdfDataRef.current.get(activeDocument.path)
        let sourceBytes: Uint8Array
        if (editedPdfData) {
          sourceBytes = new Uint8Array(editedPdfData)
        } else {
          setPageRemovalStatus('Refreshing the source PDF...')
          const reloaded = await window.studio.documents.readPdf(activeDocument.path)
          sourceBytes = new Uint8Array(reloaded)
        }
        if (!hasPdfHeader(sourceBytes)) {
          throw new Error('The selected source file is not a valid PDF.')
        }
        const beforeRemoval: PageRemovalHistorySnapshot = {
          project: structuredClone(project),
          documents: structuredClone(documents),
          preflight: structuredClone(preflight),
          pdfData: new Uint8Array(sourceBytes),
          activePath: activeDocument.path,
          reviewPage: reviewSourcePage
        }
        setPageRemovalStatus('Rebuilding the PDF without the selected pages...')
        const removedPdf = await window.studio.documents.removePdfPages(sourceBytes, pagesToRemove)
        const { bytes: nextPdfData, pageCount, removedPages: pages } = removedPdf
        const previousRemovedPages = activeDocument.removedPages ?? []
        const originalPageCount = pageCount + previousRemovedPages.length
        const originalPages = pages
          .map((page) => restoreOriginalPageNumber(page, originalPageCount, previousRemovedPages))
          .filter((page): page is number => page !== null)
        const allRemovedPages = [...new Set([...previousRemovedPages, ...originalPages])].sort(
          (left, right) => left - right
        )
        editedPdfDataRef.current.set(activeDocument.path, new Uint8Array(nextPdfData))
        setPdfData(new Uint8Array(nextPdfData))

        const remapPage = (pageNumber: number): number | null => {
          return remapPageNumber(pageNumber, pages)
        }
        const activePreflight = preflight[activeDocument.path]
        const nextPreflight = activePreflight
          ? {
              ...activePreflight,
              pageCount,
              pages: activePreflight.pages.flatMap((page) => {
                const nextPage = remapPage(page.pageNumber)
                return nextPage === null ? [] : [{ ...page, pageNumber: nextPage }]
              })
            }
          : undefined

        const occurredAt = new Date().toISOString()
        setDocuments((current) =>
          current.map((document) =>
            document.id === activeDocument.id
              ? { ...document, pageCount, removedPages: allRemovedPages }
              : document
          )
        )
        const nextEntries = project.entries.flatMap((entry) => {
          const regions = entry.regions.flatMap((region) => {
            if (region.documentId !== activeDocument.id) return [region]
            const nextPage = remapPage(region.pageNumber)
            return nextPage === null ? [] : [{ ...region, pageNumber: nextPage }]
          })
          return regions.length > 0 ? [{ ...entry, regions, updatedAt: occurredAt }] : []
        })
        setProject({
          ...project,
          documents: project.documents.map((document) =>
            document.id === activeDocument.id
              ? { ...document, pageCount, removedPages: allRemovedPages }
              : document
          ),
          pages: project.pages.flatMap((page) => {
            if (page.documentId !== activeDocument.id) return [page]
            const nextPage = remapPage(page.pageNumber)
            return nextPage === null ? [] : [{ ...page, pageNumber: nextPage }]
          }),
          entries: nextEntries,
          auditTrail: [
            ...project.auditTrail,
            {
              id: crypto.randomUUID(),
              occurredAt,
              action: 'pages-removed',
              entityType: 'document',
              entityId: activeDocument.id,
              details: { count: pages.length, remaining: pageCount }
            }
          ],
          updatedAt: occurredAt
        })

        setDocuments((current) =>
          current.map((document) =>
            document.id === activeDocument.id ? { ...document, pageCount } : document
          )
        )
        setPreflight((current) =>
          nextPreflight ? { ...current, [activeDocument.path]: nextPreflight } : current
        )
        const nextEntryIds = new Set(nextEntries.map((entry) => entry.id))
        setSelectedReviewIds(
          (current) => new Set([...current].filter((id) => nextEntryIds.has(id)))
        )
        setSelectedEntryId((current) => (current && nextEntryIds.has(current) ? current : null))

        const nextCurrentPage = remapPage(reviewSourcePage) ?? Math.min(reviewSourcePage, pageCount)
        setReviewSourcePage(nextCurrentPage)
        setRequestedPdfPage(nextCurrentPage)
        setError(null)
        setPageRemovalStatus(
          `Removed ${pages.length} page${pages.length === 1 ? '' : 's'}. ${pageCount} page${pageCount === 1 ? '' : 's'} remain.`
        )
        pageRemovalUndoRef.current = [...pageRemovalUndoRef.current, beforeRemoval]
        pageRemovalRedoRef.current = []
        setPageRemovalHistory({ undoCount: pageRemovalUndoRef.current.length, redoCount: 0 })
      } catch (removeError) {
        const message =
          removeError instanceof Error ? removeError.message : 'Unable to remove pages.'
        setError(message)
        setPageRemovalStatus(message)
      } finally {
        setIsRemovingPages(false)
      }
    },
    [activeDocument, documents, pdfData, preflight, project, reviewSourcePage]
  )

  const restorePageRemovalSnapshot = (snapshot: PageRemovalHistorySnapshot): void => {
    setProject(structuredClone(snapshot.project))
    setDocuments(structuredClone(snapshot.documents))
    setPreflight(structuredClone(snapshot.preflight))
    editedPdfDataRef.current.set(snapshot.activePath, new Uint8Array(snapshot.pdfData))
    setActivePath(snapshot.activePath)
    setPdfData(new Uint8Array(snapshot.pdfData))
    setReviewSourcePage(snapshot.reviewPage)
    setRequestedPdfPage(snapshot.reviewPage)
  }

  const undoPageRemoval = (): void => {
    const previous = pageRemovalUndoRef.current.at(-1)
    if (!previous || isRemovingPages || !project || !pdfData || !activeDocument) return
    const activePdfData = editedPdfDataRef.current.get(activeDocument.path)
    if (!activePdfData) return
    pageRemovalUndoRef.current = pageRemovalUndoRef.current.slice(0, -1)
    pageRemovalRedoRef.current = [
      ...pageRemovalRedoRef.current,
      {
        project: structuredClone(project),
        documents: structuredClone(documents),
        preflight: structuredClone(preflight),
        pdfData: new Uint8Array(activePdfData),
        activePath: activeDocument.path,
        reviewPage: reviewSourcePage
      }
    ]
    restorePageRemovalSnapshot(previous)
    setPageRemovalHistory({
      undoCount: pageRemovalUndoRef.current.length,
      redoCount: pageRemovalRedoRef.current.length
    })
  }

  const redoPageRemoval = (): void => {
    const next = pageRemovalRedoRef.current.at(-1)
    if (!next || isRemovingPages || !project || !pdfData || !activeDocument) return
    const activePdfData = editedPdfDataRef.current.get(activeDocument.path)
    if (!activePdfData) return
    pageRemovalRedoRef.current = pageRemovalRedoRef.current.slice(0, -1)
    pageRemovalUndoRef.current = [
      ...pageRemovalUndoRef.current,
      {
        project: structuredClone(project),
        documents: structuredClone(documents),
        preflight: structuredClone(preflight),
        pdfData: new Uint8Array(activePdfData),
        activePath: activeDocument.path,
        reviewPage: reviewSourcePage
      }
    ]
    restorePageRemovalSnapshot(next)
    setPageRemovalHistory({
      undoCount: pageRemovalUndoRef.current.length,
      redoCount: pageRemovalRedoRef.current.length
    })
  }

  const selectHighlightEntry = useCallback(
    (entryId: string): void => {
      focusEntryInReview(entryId)
      toggleReviewSelection(entryId)
    },
    [focusEntryInReview, toggleReviewSelection]
  )

  const applyMergedEntries = useCallback((entriesToMerge: ProjectEntry[]): void => {
    const proj = projectRef.current
    if (!proj) return
    try {
      const merged = mergeReviewEntries(entriesToMerge)
      const mergedIds = new Set(entriesToMerge.map((entry) => entry.id))
      const insertionIndex = proj.entries.findIndex((entry) => mergedIds.has(entry.id))
      const remaining = proj.entries.filter((entry) => !mergedIds.has(entry.id))
      const nextEntries = [...remaining]
      nextEntries.splice(Math.max(0, insertionIndex), 0, merged)
      const occurredAt = new Date().toISOString()
      undoStackRef.current = [...undoStackRef.current, proj.entries]
      redoStackRef.current = []
      setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
      setProject({
        ...proj,
        entries: nextEntries,
        auditTrail: [
          ...proj.auditTrail,
          {
            id: crypto.randomUUID(),
            occurredAt,
            action: 'entries-merged',
            entityType: 'entry',
            entityId: merged.id,
            details: { sourceEntryIds: [...mergedIds].sort().join('|'), count: mergedIds.size }
          }
        ]
      })
      setSelectedReviewIds(new Set([merged.id]))
      setSelectedEntryId(merged.id)
      setEditingEntryId(null)
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : 'Unable to merge entries.')
    }
  }, [])

  const mergeSelectedReviewEntries = useCallback((): void => {
    const proj = projectRef.current
    if (!proj || selectedReviewEntries.length < 2) return
    applyMergedEntries(selectedReviewEntries)
  }, [applyMergedEntries, selectedReviewEntries])

  const mergeEntryWithRowAbove = useCallback(
    (entryId: string): void => {
      const proj = projectRef.current
      if (!proj) return
      const entry = proj.entries.find((candidate) => candidate.id === entryId)
      if (!entry) return
      const rowAbove = findEntryDirectlyAbove(entry, proj.entries)
      if (!rowAbove || rowAbove.status !== entry.status) return
      applyMergedEntries([rowAbove, entry])
    },
    [applyMergedEntries]
  )

  const canMergeEntryUp = useCallback((entryId: string): boolean => {
    const proj = projectRef.current
    const entry = proj?.entries.find((candidate) => candidate.id === entryId)
    const rowAbove = entry ? findEntryDirectlyAbove(entry, proj?.entries ?? []) : undefined
    return Boolean(entry && rowAbove && rowAbove.status === entry.status)
  }, [])

  const splitSelectedReviewEntry = useCallback((entryId: string, parts: string[]): void => {
    const proj = projectRef.current
    if (!proj) return
    const source = proj.entries.find((entry) => entry.id === entryId)
    if (!source) return
    try {
      const split = splitReviewEntry(source, parts)
      const sourceIndex = proj.entries.findIndex((entry) => entry.id === entryId)
      const nextEntries = proj.entries.filter((entry) => entry.id !== entryId)
      nextEntries.splice(sourceIndex, 0, ...split)
      const occurredAt = new Date().toISOString()
      undoStackRef.current = [...undoStackRef.current, proj.entries]
      redoStackRef.current = []
      setHistoryState({ undoCount: undoStackRef.current.length, redoCount: 0 })
      setProject({
        ...proj,
        entries: nextEntries,
        auditTrail: [
          ...proj.auditTrail,
          {
            id: crypto.randomUUID(),
            occurredAt,
            action: 'entry-split',
            entityType: 'entry',
            entityId: entryId,
            details: {
              resultEntryIds: split.map((entry) => entry.id).join('|'),
              count: split.length
            }
          }
        ]
      })
      setSelectedReviewIds(new Set(split.map((entry) => entry.id)))
      setSelectedEntryId(split[0]?.id ?? null)
      setEditingEntryId(null)
    } catch (splitError) {
      setError(splitError instanceof Error ? splitError.message : 'Unable to split entry.')
    }
  }, [])

  const generatePdfExport = useCallback(
    async (
      format: PdfExportFormat,
      template?: KeptExportTemplate,
      layers?: { text?: boolean; images?: boolean }
    ): Promise<Uint8Array> => {
      if (!projectSnapshot) throw new Error('Open a project before previewing an export.')
      const loadSourceFiles = async (): Promise<Map<string, Uint8Array>> => {
        const sourceFiles = new Map<string, Uint8Array>()
        for (const document of projectSnapshot.documents) {
          const editedData = editedPdfDataRef.current.get(document.path)
          const data =
            editedData ?? new Uint8Array(await window.studio.documents.readPdf(document.path))
          sourceFiles.set(document.path, data)
        }
        return sourceFiles
      }
      if (format === 'pdf') {
        return exportProjectPdf(projectSnapshot, {
          metrics: analysisSnapshot.metrics.map((metric) => ({
            label: metric.kind,
            value: metric.value,
            contributorCount: metric.contributorEntryIds.length,
            group: metric.group
          }))
        })
      }
      if (format === 'pdf-kept-template') {
        const appliedTemplate = template ?? keptExportTemplate
        if (!appliedTemplate) {
          throw new Error('Configure the kept text export template before previewing it.')
        }
        return exportProjectKeptEntriesTemplatePdf(
          projectSnapshot,
          appliedTemplate,
          await loadSourceFiles(),
          await resolveTemplateBackgroundDataUrls(appliedTemplate)
        )
      }
      if (format === 'pdf-kept-canvas') {
        if (template) {
          return exportProjectKeptEntriesTemplatePdf(
            projectSnapshot,
            template,
            await loadSourceFiles(),
            await resolveTemplateBackgroundDataUrls(template)
          )
        }
        const currentLayout = keptEntriesLayout
        const [imageDataUrls, sourceFiles] = await Promise.all([
          resolveKeptImageDataUrls(projectSnapshot, currentLayout, async (path) => {
            const editedData = editedPdfDataRef.current.get(path)
            return editedData ?? new Uint8Array(await window.studio.documents.readPdf(path))
          }),
          loadSourceFiles()
        ])
        return exportProjectKeptEntriesCanvasPdf(projectSnapshot, currentLayout, {
          imageDataUrls,
          sourceFiles,
          layers
        })
      }
      throw new Error(`Unsupported preview format: ${format}`)
    },
    [analysisSnapshot, keptEntriesLayout, keptExportTemplate, projectSnapshot]
  )

  const keptTextRenderPlan = useMemo(() => {
    if (!projectSnapshot || !keptExportTemplate) return undefined
    return buildKeptExportRenderPlan(
      buildKeptExportSourceRows(projectSnapshot, keptExportTemplate),
      keptExportTemplate
    )
  }, [projectSnapshot, keptExportTemplate])

  const saveExport = useCallback(
    async (
      format: 'csv' | 'json' | 'pdf' | 'pdf-kept-canvas' | 'entry-images',
      template?: KeptExportTemplate,
      layers?: { text?: boolean; images?: boolean }
    ): Promise<void> => {
      if (!projectSnapshot) return
      setExportState({ isSaving: true, status: `Preparing ${format.toUpperCase()}...` })
      try {
        if (format === 'entry-images') {
          const files = await generateEntryPngFiles(projectSnapshot, async (path) => {
            const editedData = editedPdfDataRef.current.get(path)
            return editedData ?? new Uint8Array(await window.studio.documents.readPdf(path))
          })
          const result = await window.studio.exports.saveEntryImages({
            suggestedFolderName: `${projectSnapshot.name}-kept-entry-images`,
            files
          })
          setExportState({
            isSaving: false,
            status:
              result.status === 'saved'
                ? `Saved ${result.fileCount} PNGs to ${result.path}`
                : 'Export cancelled'
          })
          return
        }
        let content: string
        if (format === 'csv') content = exportProjectCsv(projectSnapshot)
        else if (format === 'json') {
          content = exportProjectJson(projectSnapshot, { includeExcluded: true })
        } else {
          const bytes = await generatePdfExport(format, template, layers)
          let binary = ''
          for (let offset = 0; offset < bytes.length; offset += 32768) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
          }
          content = btoa(binary)
        }
        const result = await window.studio.exports.save({
          format,
          suggestedName: `${projectSnapshot.name}-review`,
          content
        })
        setExportState({
          isSaving: false,
          status: result.status === 'saved' ? `Saved ${result.path}` : 'Export cancelled'
        })
      } catch (exportError) {
        const message = exportError instanceof Error ? exportError.message : 'Export failed.'
        setExportState({ isSaving: false, status: message })
      }
    },
    [generatePdfExport, projectSnapshot]
  )

  const undoReview = useCallback((): void => {
    const previous = undoStackRef.current.at(-1)
    if (!previous) return
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setProject((current) => {
      if (!current) return current
      redoStackRef.current = [...redoStackRef.current, current.entries]
      return { ...current, entries: previous }
    })
    const selection = reconcileReviewSelection(previous, selectedReviewIds, selectedEntryId)
    setSelectedReviewIds(selection.selectedIds)
    setSelectedEntryId(selection.primaryId)
    setHistoryState({
      undoCount: undoStackRef.current.length,
      redoCount: redoStackRef.current.length
    })
  }, [selectedEntryId, selectedReviewIds])

  const redoReview = useCallback((): void => {
    const next = redoStackRef.current.at(-1)
    if (!next) return
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    setProject((current) => {
      if (!current) return current
      undoStackRef.current = [...undoStackRef.current, current.entries]
      return { ...current, entries: next }
    })
    const selection = reconcileReviewSelection(next, selectedReviewIds, selectedEntryId)
    setSelectedReviewIds(selection.selectedIds)
    setSelectedEntryId(selection.primaryId)
    setHistoryState({
      undoCount: undoStackRef.current.length,
      redoCount: redoStackRef.current.length
    })
  }, [selectedEntryId, selectedReviewIds])

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent): void => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('mousemove', handlePointerMove)
    return () => window.removeEventListener('mousemove', handlePointerMove)
  }, [])

  // Keeps the latest closures available to the keydown listener below without forcing it to
  // resubscribe (and without wrapping every handler in useCallback) on every render.
  const shortcutHandlersRef = useRef({
    navigateToReviewPage,
    navigateToEntry,
    retrySave,
    saveExport
  })
  useEffect(() => {
    shortcutHandlersRef.current = { navigateToReviewPage, navigateToEntry, retrySave, saveExport }
  })

  useEffect(() => {
    if (screen !== 'workspace') return
    const handleReviewShortcut = (event: KeyboardEvent): void => {
      const target = event.target
      const activeElement = document.activeElement
      if (commandPopup || showShortcutsHelp) return
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        (activeElement instanceof HTMLElement && isFocusableShortcutTarget(activeElement))
      )
        return
      const key = event.key
      const lowerKey = key.toLocaleLowerCase()
      const primaryModifier = event.ctrlKey || event.metaKey

      if (primaryModifier && lowerKey === 'z') {
        event.preventDefault()
        if (event.shiftKey) redoReview()
        else undoReview()
        return
      }
      if (primaryModifier && lowerKey === 'y') {
        event.preventDefault()
        redoReview()
        return
      }
      if (primaryModifier && lowerKey === 's') {
        event.preventDefault()
        void shortcutHandlersRef.current.retrySave()
        return
      }
      if (primaryModifier && lowerKey === 'e') {
        event.preventDefault()
        void shortcutHandlersRef.current.saveExport('pdf')
        return
      }
      if (primaryModifier && lowerKey === 'f') {
        event.preventDefault()
        setWorkspaceMode('review')
        setCommandPopup({
          kind: 'search',
          x: lastPointerRef.current.x,
          y: lastPointerRef.current.y,
          value: reviewQuery
        })
        return
      }
      if (primaryModifier && lowerKey === 'g') {
        event.preventDefault()
        setCommandPopup({
          kind: 'goto',
          x: lastPointerRef.current.x,
          y: lastPointerRef.current.y,
          value: String(reviewSourcePage)
        })
        return
      }
      if (primaryModifier && lowerKey === 'a') {
        event.preventDefault()
        setSelectedReviewIds(new Set(filteredEntries.map((entry) => entry.id)))
        return
      }
      if (key === 'Escape') {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false)
          return
        }
        if (selectedReviewIds.size > 0) {
          event.preventDefault()
          setSelectedReviewIds(new Set())
        }
        return
      }
      if (!primaryModifier && !event.altKey && (key === 'PageDown' || key === 'PageUp')) {
        event.preventDefault()
        shortcutHandlersRef.current.navigateToReviewPage(
          reviewSourcePage + (key === 'PageDown' ? 1 : -1)
        )
        return
      }
      if (event.altKey && !primaryModifier) {
        if (key === 'ArrowRight') {
          event.preventDefault()
          shortcutHandlersRef.current.navigateToReviewPage(reviewSourcePage + 1)
          return
        }
        if (key === 'ArrowLeft') {
          event.preventDefault()
          shortcutHandlersRef.current.navigateToReviewPage(reviewSourcePage - 1)
          return
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
          event.preventDefault()
          const index = pagedEntries.findIndex((entry) => entry.id === selectedEntryId)
          const nextEntry =
            key === 'ArrowDown'
              ? (pagedEntries[index + 1] ?? pagedEntries[0])
              : index > 0
                ? pagedEntries[index - 1]
                : pagedEntries[pagedEntries.length - 1]
          if (nextEntry) shortcutHandlersRef.current.navigateToEntry(nextEntry.id)
          return
        }
        if (lowerKey === 'h') {
          event.preventDefault()
          setHighlightsVisible((current) => !current)
          return
        }
        if (lowerKey === 'r') {
          event.preventDefault()
          setWorkspaceMode('review')
          return
        }
        if (lowerKey === 'a') {
          event.preventDefault()
          setWorkspaceMode('analysis')
          return
        }
        if (lowerKey === 'x') {
          event.preventDefault()
          setWorkspaceMode('export')
          return
        }
        if (key === '1') {
          event.preventDefault()
          setReviewStatus('all')
          setReviewSource('all')
          return
        }
        if (key === '2') {
          event.preventDefault()
          setReviewStatus('keep')
          return
        }
        if (key === '3') {
          event.preventDefault()
          setReviewStatus('maybe')
          return
        }
        if (key === '4') {
          event.preventDefault()
          setReviewStatus('exclude')
          return
        }
        if (key === '5') {
          event.preventDefault()
          setReviewSource('merged')
          return
        }
      }
      if (key === '?') {
        event.preventDefault()
        setShowShortcutsHelp((current) => !current)
        return
      }
      if (!selectedEntryId || primaryModifier || event.altKey) return
      const decision = { k: 'keep', m: 'maybe', e: 'exclude' }[lowerKey] as ReviewStatus | undefined
      if (!decision) return
      event.preventDefault()
      setEntryStatus(selectedEntryId, decision)
    }
    window.addEventListener('keydown', handleReviewShortcut)
    return () => window.removeEventListener('keydown', handleReviewShortcut)
  }, [
    filteredEntries,
    pagedEntries,
    redoReview,
    reviewQuery,
    reviewSourcePage,
    screen,
    selectedEntryId,
    selectedReviewIds,
    commandPopup,
    setEntryStatus,
    showShortcutsHelp,
    undoReview
  ])

  const submitCommandPopup = (): void => {
    if (!commandPopup) return
    if (commandPopup.kind === 'search') {
      setReviewQuery(commandPopup.value)
    } else if (commandPopup.kind === 'goto') {
      const page = Number(commandPopup.value)
      if (Number.isFinite(page)) navigateToReviewPage(page)
    }
    setCommandPopup(null)
  }

  const selectCurrencyCode = useCallback((nextCurrencyCode: CurrencyCode): void => {
    setCurrencyCode(nextCurrencyCode)
    setCommandPopup(null)
  }, [])

  const customSettingsInvalid =
    mode === 'custom' &&
    (ocrLanguages.length === 0 || (customPageMode === 'range' && !pageRange.trim()))

  const handleBrandClick = useCallback(() => setScreen('onboarding'), [])
  const handleToggleTheme = useCallback(
    () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    []
  )
  const handleNavAddPdfs = useCallback(() => setScreen('import'), [])
  const handleToggleShortcutsHelp = useCallback(
    () => setShowShortcutsHelp((current) => !current),
    []
  )

  const handleSelectSourcePath = useCallback((path: string) => {
    setPdfData(null)
    setActivePath(path)
  }, [])

  const detectActiveDocumentStyle = useCallback(async (): Promise<void> => {
    if (!activeDocument) {
      setStyleDetectionStatus('Select a source PDF before detecting style.')
      return
    }
    setWorkspaceMode('style')
    setStyleDetectionStatus(`Detecting style for ${activeDocument.name}...`)
    try {
      const data =
        pdfData ?? new Uint8Array(await window.studio.documents.readPdf(activeDocument.path))
      const styleProfile = await detectDocumentStyleProfile(activeDocument.id, data)
      setDocuments((current) =>
        current.map((document) =>
          document.id === activeDocument.id ? { ...document, styleProfile } : document
        )
      )
      setStyleDetectionStatus(
        `Detected ${styleProfile.textStyles.length} text style${styleProfile.textStyles.length === 1 ? '' : 's'} for ${activeDocument.name}.`
      )
    } catch (styleError) {
      setStyleDetectionStatus(
        styleError instanceof Error ? styleError.message : 'Style detection failed.'
      )
    }
  }, [activeDocument, pdfData])

  const detectActivePageNumberStyle = useCallback(async () => {
    if (!activeDocument) return undefined
    const data =
      pdfData ?? new Uint8Array(await window.studio.documents.readPdf(activeDocument.path))
    return detectSourcePageNumberStyle(activeDocument.id, data, activeDocument.styleProfile)
  }, [activeDocument, pdfData])

  const handleRightWorkspaceCommand = useCallback(
    (command: RightWorkspaceCommand) => {
      if (command === 'zoom-out') pdfViewerRef.current?.zoomOut()
      else if (command === 'zoom-in') pdfViewerRef.current?.zoomIn()
      else if (command === 'import') void choosePdfs()
      else if (command === 'save') void retrySave()
      else if (command === 'detect-style') void detectActiveDocumentStyle()
      else if (command === 'currency') {
        setCommandPopup({
          kind: 'currency',
          x: 84,
          y: Math.max(16, window.innerHeight - 360),
          value: currencyCode
        })
      } else {
        setCommandPopup({
          kind: 'goto',
          x: Math.max(16, window.innerWidth - 300),
          y: 84,
          value: String(reviewSourcePageRef.current)
        })
      }
    },
    [choosePdfs, currencyCode, detectActiveDocumentStyle, retrySave]
  )

  const applyStyleProfileTextStyle = useCallback((style: TextStyleCluster): void => {
    setKeptExportTemplate((current) => {
      const draft = createKeptExportTemplateDraft(current)
      const textStyle = textStyleToKeptExportTextStyle(style)
      draft.pageOneTemplate.defaultTextStyle = textStyle
      draft.pageOneTemplate.columns = draft.pageOneTemplate.columns.map((column) => ({
        ...column,
        textStyle
      }))
      if (draft.useSeparateLaterPages) {
        draft.laterPagesTemplate.defaultTextStyle = textStyle
        draft.laterPagesTemplate.columns = draft.laterPagesTemplate.columns.map((column) => ({
          ...column,
          textStyle
        }))
      }
      return toKeptExportTemplate(draft)
    })
    setStyleDetectionStatus(
      `Applied detected ${style.role} style to the kept text export template.`
    )
  }, [])

  const applyStyleProfileDivider = useCallback((): void => {
    const divider = activeStyleProfile?.dividerStyles[0]
    if (!divider) return
    setKeptExportTemplate((current) => {
      const draft = createKeptExportTemplateDraft(current)
      draft.pageOneTemplate.divider = dividerStyleToKeptExportDivider(divider)
      if (draft.useSeparateLaterPages) {
        draft.laterPagesTemplate.divider = dividerStyleToKeptExportDivider(divider)
      }
      return toKeptExportTemplate(draft)
    })
    setStyleDetectionStatus('Applied detected divider style to the kept text export template.')
  }, [activeStyleProfile])

  const selectVisibleEntries = useCallback(() => {
    setSelectedReviewIds(new Set(pagedEntries.map((entry) => entry.id)))
  }, [pagedEntries])

  const selectCurrentPageEntries = useCallback(() => {
    setSelectedReviewIds(new Set(sourcePageEntries.map((entry) => entry.id)))
  }, [sourcePageEntries])

  const selectAllFilteredEntries = useCallback(() => {
    // Without View all or a search query, only the entries on screen should be checked;
    // otherwise every entry matching the current filters and search bar is checked.
    const targets = viewAllReviewEntries || hasSearchQuery ? filteredEntries : pagedEntries
    setSelectedReviewIds(new Set(targets.map((entry) => entry.id)))
  }, [filteredEntries, hasSearchQuery, pagedEntries, viewAllReviewEntries])

  const clearReviewSelection = useCallback(() => {
    setSelectedReviewIds(new Set())
  }, [])

  const resetReviewFilters = useCallback(() => {
    setReviewQuery('')
    setReviewStatus('all')
    setReviewSource('all')
    setReviewCategory('all')
    setReviewIssueFilter('all')
  }, [])

  const handlePlaceKeptImages = useCallback((plan: KeptImagePlan) => {
    setKeptEntriesLayout((current) => withKeptImagePlacements(current, plan))
  }, [])

  // The config windows live inside ExportPanel, which only mounts on the Export tab.
  const openKeptConfiguration = useCallback((kind: 'png' | 'text') => {
    setShowKeptCanvas(null)
    setWorkspaceMode('export')
    setOpenKeptConfig(kind)
  }, [])

  const handleImagePlacementConfigurationChange = useCallback(
    (
      imagePlacementOptions: KeptImagePlacementOptions,
      uploadedImageSources: readonly KeptImageSourceDescriptor[]
    ) => {
      setKeptEntriesLayout((current) => {
        const activeProject = projectSnapshotRef.current
        if (!activeProject) {
          return {
            ...current,
            imagePlacementOptions,
            uploadedImageSources: [...uploadedImageSources]
          }
        }
        const sources =
          imagePlacementOptions.sourceMode === 'session-entry'
            ? buildSessionKeptImageSources(activeProject.entries)
            : [...uploadedImageSources]
        const plan = planKeptEntryImagePlacements(sources, {
          pageSize: current.pageSize,
          orientation: current.orientation,
          ...imagePlacementOptions,
          entries: activeProject.entries.filter((entry) => entry.status === 'keep'),
          runningBalanceConfig: activeProject.keptExportTemplate?.runningBalance
        })
        plan.options = imagePlacementOptions
        return {
          ...withKeptImagePlacements(current, plan),
          uploadedImageSources: [...uploadedImageSources]
        }
      })
    },
    []
  )

  const applyKeptExportTemplate = useCallback(
    (template: KeptExportTemplate): void => {
      setKeptExportTemplate(template)
      const entries = project?.entries
      if (!entries) return
      setKeptEntriesLayout((current) => {
        const imagePlacementOptions = current.imagePlacementOptions
        if (
          imagePlacementOptions?.sourceMode !== 'session-entry' ||
          !imagePlacementOptions.runningBalance?.enabled
        ) {
          return current
        }
        const plan = planKeptEntryImagePlacements(buildSessionKeptImageSources(entries), {
          pageSize: current.pageSize,
          orientation: current.orientation,
          ...imagePlacementOptions,
          entries: entries.filter((entry) => entry.status === 'keep'),
          runningBalanceConfig: template.runningBalance
        })
        const balanceByEntryId = new Map(
          plan.placements.flatMap((placement) =>
            placement.entryId && placement.runningBalanceText
              ? [[placement.entryId, placement.runningBalanceText] as const]
              : []
          )
        )
        return {
          ...current,
          images: (current.images ?? []).map((placement) => {
            if (placement.source.kind !== 'session-entry') return placement
            const runningBalanceText = balanceByEntryId.get(
              placement.entryId ?? placement.source.ref
            )
            return { ...placement, ...(runningBalanceText ? { runningBalanceText } : {}) }
          })
        }
      })
    },
    [project]
  )

  // Uploaded images stream from managed storage; session crops must be regenerated for display.
  const resolveCanvasImageSource = useCallback(
    (source: KeptImageSourceRef): string | undefined =>
      resolveKeptImageUrl(source, sessionImageUrls),
    [sessionImageUrls]
  )

  // Keyed on the referenced set, so moving or resizing a placement never re-renders the crops.
  const sessionImageRefs = useMemo(
    () => collectKeptImageRefs(keptEntriesLayout, 'session-entry'),
    [keptEntriesLayout]
  )
  const sessionImageRefKey = JSON.stringify(sessionImageRefs)

  useEffect(() => {
    if (showKeptCanvas !== 'png' || !projectSnapshotRef.current) return
    const refs = JSON.parse(sessionImageRefKey) as string[]
    let cancelled = false
    setIsRefreshingSessionImages(true)
    void loadKeptSessionImageUrls(projectSnapshotRef.current, refs, async (path) => {
      const editedData = editedPdfDataRef.current.get(path)
      return editedData ?? new Uint8Array(await window.studio.documents.readPdf(path))
    }).then((resolved) => {
      if (cancelled) return
      setSessionImageUrls(resolved.urls)
      setSessionImageError(resolved.error ?? null)
      setIsRefreshingSessionImages(false)
    })
    return () => {
      cancelled = true
    }
  }, [sessionImageRefKey, showKeptCanvas, sessionImageRefreshToken])

  const handleSaveEditingEntry = useCallback(
    (patch: EntryEditPatch) => {
      if (editingEntryId) saveEntryEdit(editingEntryId, patch)
    },
    [editingEntryId, saveEntryEdit]
  )

  const handleTemplateExport = useCallback(
    (template: KeptExportTemplate) => {
      void saveExport('pdf-kept-canvas', template)
    },
    [saveExport]
  )

  const handleTemplatePreview = useCallback((template: KeptExportTemplate) => {
    setKeptExportTemplate(template)
    setShowKeptCanvas('text')
  }, [])

  const handleRemovePagesAction = useCallback(
    (pages: number[]) => {
      void removePages(pages)
    },
    [removePages]
  )

  const handleOpenRecentProject = useCallback(
    (projectId: string) => {
      void openProject(projectId)
    },
    [openProject]
  )

  const handleRemoveRecentProject = useCallback(
    (projectId: string) => {
      void removeRecentProject(projectId)
    },
    [removeRecentProject]
  )

  const handleLocateProjectSources = useCallback(
    (projectId: string) => {
      void locateProjectSources(projectId)
    },
    [locateProjectSources]
  )

  const handleRetrySaveAction = useCallback(() => {
    void retrySave()
  }, [retrySave])

  const handleSelectReviewSourcePage = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      navigateToReviewPage(Number(event.target.value))
    },
    [navigateToReviewPage]
  )

  const handleToggleViewAllReviewEntries = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setViewAllReviewEntries(event.target.checked)
    },
    []
  )

  const handleSelectReviewPageSpan = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setReviewPageSpan(event.target.value)
  }, [])

  const reviewBulkContext = useMemo(
    () => (
      <div className="review-tool-menubar right-context-controls" aria-label="Review tools">
        <section
          className="review-menu-section review-menu-search"
          aria-labelledby="review-search-heading"
        >
          <header className="review-menu-section-heading">
            <div>
              <span className="toolbar-group-label">Find</span>
              <h3 id="review-search-heading">Search and filters</h3>
            </div>
            <button
              className="review-menu-reset"
              type="button"
              disabled={
                !hasSearchQuery &&
                reviewStatus === 'all' &&
                reviewSource === 'all' &&
                reviewCategory === 'all' &&
                reviewIssueFilter === 'all'
              }
              onClick={resetReviewFilters}
            >
              <X size={14} aria-hidden="true" /> Reset
            </button>
          </header>
          <div className="review-toolbar" aria-label="Search and review filters">
            <label className="review-search">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">Search extracted entries</span>
              <input
                value={reviewQuery}
                onChange={(event) => setReviewQuery(event.target.value)}
                placeholder="Search entries"
              />
            </label>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as ReviewStatus | 'all')}
              aria-label="Filter by review decision"
            >
              <option value="all">All decisions</option>
              <option value="keep">Keep</option>
              <option value="maybe">Maybe</option>
              <option value="exclude">Exclude</option>
            </select>
            <select
              value={reviewSource}
              onChange={(event) =>
                setReviewSource(event.target.value as 'all' | 'parser' | 'ocr' | 'merged')
              }
              aria-label="Filter by extraction source"
            >
              <option value="all">All sources</option>
              <option value="parser">Parser</option>
              <option value="ocr">OCR</option>
              <option value="merged">Merged</option>
            </select>
            <select
              value={reviewCategory}
              onChange={(event) => setReviewCategory(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {reviewCategories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={reviewIssueFilter}
              onChange={(event) =>
                setReviewIssueFilter(event.target.value as ReviewIssueCode | 'all')
              }
              aria-label="Filter by review warning"
            >
              <option value="all">All warnings</option>
              <option value="duplicate-entry">Duplicates</option>
              <option value="broken-row-across-pages">Broken rows</option>
            </select>
          </div>
        </section>

        <section className="review-menu-section" aria-labelledby="review-selection-heading">
          <header className="review-menu-section-heading">
            <div>
              <span className="toolbar-group-label">Scope</span>
              <h3 id="review-selection-heading">Selection</h3>
            </div>
            <span className="review-selection-count">{selectedReviewIds.size} selected</span>
          </header>
          <div className="selection-toolbar" aria-label="Selection tools">
            <button className="secondary-button" type="button" onClick={selectVisibleEntries}>
              Visible
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={sourcePageEntries.length === 0}
              onClick={selectCurrentPageEntries}
            >
              Current page
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={
                (viewAllReviewEntries || hasSearchQuery ? filteredEntries : pagedEntries).length ===
                0
              }
              onClick={selectAllFilteredEntries}
            >
              All results
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={selectedReviewIds.size === 0}
              onClick={clearReviewSelection}
            >
              Clear
            </button>
          </div>
        </section>

        <section className="review-menu-section" aria-labelledby="review-actions-heading">
          <header className="review-menu-section-heading">
            <div>
              <span className="toolbar-group-label">Edit</span>
              <h3 id="review-actions-heading">Actions</h3>
            </div>
          </header>
          <div className="bulk-toolbar" aria-label="Bulk review actions">
            <div className="review-history-actions" aria-label="Review history">
              <button
                className="icon-button"
                type="button"
                title="Undo review decision"
                aria-label="Undo review decision"
                disabled={historyState.undoCount === 0}
                onClick={undoReview}
              >
                <Undo2 size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                title="Redo review decision"
                aria-label="Redo review decision"
                disabled={historyState.redoCount === 0}
                onClick={redoReview}
              >
                <Redo2 size={16} />
              </button>
            </div>
            {(['keep', 'maybe', 'exclude'] as const).map((status) => (
              <button
                className={`bulk-${status}`}
                type="button"
                key={status}
                title={`${status[0].toUpperCase()}${status.slice(1)} selected rows`}
                disabled={selectedReviewIds.size === 0}
                onClick={() => setBulkEntryStatus(status)}
              >
                {status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
            <ReviewMergeSplitControls
              selectedEntries={selectedReviewEntries}
              primaryEntry={selectedEntry}
              onMerge={mergeSelectedReviewEntries}
              onSplit={splitSelectedReviewEntry}
            />
            <div className="review-tag-actions">
              <label className="bulk-tag-field">
                <span className="sr-only">Tag selected entries</span>
                <input
                  value={bulkTag}
                  placeholder="Add a tag"
                  onChange={(event) => setBulkTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addBulkTag()
                    }
                  }}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={!bulkTag.trim() || selectedReviewIds.size === 0}
                onClick={addBulkTag}
              >
                Add
              </button>
            </div>
          </div>
        </section>
      </div>
    ),
    [
      addBulkTag,
      bulkTag,
      clearReviewSelection,
      filteredEntries,
      hasSearchQuery,
      historyState.redoCount,
      historyState.undoCount,
      mergeSelectedReviewEntries,
      pagedEntries,
      redoReview,
      reviewCategories,
      reviewCategory,
      reviewIssueFilter,
      reviewQuery,
      reviewSource,
      reviewStatus,
      resetReviewFilters,
      selectedEntry,
      selectedReviewEntries,
      selectedReviewIds,
      selectAllFilteredEntries,
      selectCurrentPageEntries,
      selectVisibleEntries,
      setBulkEntryStatus,
      sourcePageEntries,
      splitSelectedReviewEntry,
      undoReview,
      viewAllReviewEntries
    ]
  )

  return (
    <div className="app-shell">
      {showKeptCanvas === 'png' && projectSnapshot && (
        <KeptPngCanvasWorkspace
          entries={projectSnapshot.entries}
          layout={keptEntriesLayout}
          keptExportTemplate={keptExportTemplate}
          isExporting={exportState.isSaving}
          resolveImageSource={resolveCanvasImageSource}
          imageResolutionError={sessionImageError ?? undefined}
          isRefreshingImages={isRefreshingSessionImages}
          onRefreshImages={() => {
            setSessionImageRefreshToken((current) => current + 1)
          }}
          onLayoutChange={setKeptEntriesLayout}
          documents={projectSnapshot.documents}
          onPlaceKeptImages={handlePlaceKeptImages}
          onImagePlacementConfigurationChange={handleImagePlacementConfigurationChange}
          onDetectPageNumbers={detectActivePageNumberStyle}
          onClose={() => {
            setShowKeptCanvas(null)
            setSessionImageUrls(new Map())
            setSessionImageError(null)
            setIsRefreshingSessionImages(false)
          }}
          onOpenConfiguration={() => openKeptConfiguration('png')}
          onOpenPngConfiguration={() => openKeptConfiguration('png')}
          onOpenTextConfiguration={() => openKeptConfiguration('text')}
          onSwitchMode={() => setShowKeptCanvas('text')}
          onExport={() => void saveExport('pdf-kept-canvas', undefined, { text: false })}
          onReset={() =>
            setKeptEntriesLayout(createDefaultKeptEntriesLayout(projectSnapshot.entries))
          }
        />
      )}
      {showKeptCanvas === 'text' && projectSnapshot && (
        <KeptTextCanvasWorkspace
          entries={projectSnapshot.entries}
          layout={keptEntriesLayout}
          keptExportTemplate={keptExportTemplate}
          onTextTemplateChange={applyKeptExportTemplate}
          textRenderPlan={keptTextRenderPlan}
          isExporting={exportState.isSaving}
          onLayoutChange={setKeptEntriesLayout}
          onClose={() => setShowKeptCanvas(null)}
          onOpenConfiguration={() => openKeptConfiguration('text')}
          onOpenTextConfiguration={() => openKeptConfiguration('text')}
          onOpenPngConfiguration={() => openKeptConfiguration('png')}
          onSwitchMode={() => setShowKeptCanvas('png')}
          onExport={() => {
            const draftTemplate =
              keptExportTemplate ?? toKeptExportTemplate(createKeptExportTemplateDraft())
            void saveExport('pdf-kept-canvas', draftTemplate)
          }}
          onReset={() =>
            setKeptEntriesLayout(createDefaultKeptEntriesLayout(projectSnapshot.entries))
          }
        />
      )}
      {isRemovingPages && (
        <div className="blocking-overlay" role="alert" aria-live="assertive">
          <div className="blocking-overlay-panel">
            <div className="indeterminate-progress-bar" aria-hidden="true">
              <span />
            </div>
            <strong>Removing pages...</strong>
            <span>{pageRemovalStatus ?? 'Preparing page removal...'}</span>
          </div>
        </div>
      )}
      {commandPopup && (
        <div className="command-popup" style={{ left: commandPopup.x, top: commandPopup.y }}>
          {commandPopup.kind === 'currency' ? (
            <div
              className="currency-popup"
              role="menu"
              aria-label="Choose project currency"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setCommandPopup(null)
                }
              }}
              onBlur={(event) => {
                const nextFocusTarget = event.relatedTarget as Node | null
                if (nextFocusTarget && event.currentTarget.contains(nextFocusTarget)) return
                setCommandPopup(null)
              }}
            >
              <strong>Project currency</strong>
              <div className="currency-popup-grid">
                {POPULAR_CURRENCIES.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={currency.code === currencyCode}
                    autoFocus={currency.code === currencyCode}
                    onClick={() => selectCurrencyCode(currency.code)}
                  >
                    <span>{currency.symbol}</span>
                    <span>{currency.code}</span>
                    <small>{currency.name}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label>
              <span className="sr-only">
                {commandPopup.kind === 'search' ? 'Search entries' : 'Go to page'}
              </span>
              <input
                type={commandPopup.kind === 'goto' ? 'number' : 'text'}
                min={commandPopup.kind === 'goto' ? 1 : undefined}
                autoFocus
                placeholder={commandPopup.kind === 'search' ? 'Search entries...' : 'Go to page...'}
                value={commandPopup.value}
                onChange={(event) =>
                  setCommandPopup((current) =>
                    current ? { ...current, value: event.target.value } : current
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitCommandPopup()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setCommandPopup(null)
                  }
                }}
                onBlur={(event) => {
                  const nextFocusTarget = event.relatedTarget as Node | null
                  if (
                    nextFocusTarget &&
                    event.currentTarget.parentElement?.contains(nextFocusTarget)
                  ) {
                    return
                  }
                  setCommandPopup(null)
                }}
              />
            </label>
          )}
        </div>
      )}
      {showShortcutsHelp && (
        <div className="shortcuts-help-backdrop" onClick={() => setShowShortcutsHelp(false)}>
          <div
            className="shortcuts-help"
            role="dialog"
            aria-label="Keyboard shortcuts"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <strong>Keyboard shortcuts</strong>
              <button
                className="icon-button"
                type="button"
                title="Close"
                onClick={() => setShowShortcutsHelp(false)}
              >
                <X size={15} />
              </button>
            </header>
            <dl>
              <div>
                <dt>Page Down / Alt+&rarr;</dt>
                <dd>Next source page</dd>
              </div>
              <div>
                <dt>Page Up / Alt+&larr;</dt>
                <dd>Previous source page</dd>
              </div>
              <div>
                <dt>Ctrl+G</dt>
                <dd>Go to page...</dd>
              </div>
              <div>
                <dt>Ctrl+F</dt>
                <dd>Search entries...</dd>
              </div>
              <div>
                <dt>Ctrl+A</dt>
                <dd>Select all visible entries</dd>
              </div>
              <div>
                <dt>Escape</dt>
                <dd>Clear selection / close popups</dd>
              </div>
              <div>
                <dt>Alt+1</dt>
                <dd>Show all entries</dd>
              </div>
              <div>
                <dt>Alt+2</dt>
                <dd>Show only kept</dd>
              </div>
              <div>
                <dt>Alt+3</dt>
                <dd>Show only maybe</dd>
              </div>
              <div>
                <dt>Alt+4</dt>
                <dd>Show only excluded</dd>
              </div>
              <div>
                <dt>Alt+5</dt>
                <dd>Show only merged</dd>
              </div>
              <div>
                <dt>Alt+R / Alt+A / Alt+X</dt>
                <dd>Switch to Review / Analysis / Export</dd>
              </div>
              <div>
                <dt>Alt+&uarr; / Alt+&darr;</dt>
                <dd>Select previous / next entry</dd>
              </div>
              <div>
                <dt>K / M / E</dt>
                <dd>Keep / Maybe / Exclude selected entry</dd>
              </div>
              <div>
                <dt>Alt+H</dt>
                <dd>Hide/show the highlight overlay in the previewer</dd>
              </div>
              <div>
                <dt>Ctrl+Z / Ctrl+Shift+Z</dt>
                <dd>Undo / Redo</dd>
              </div>
              <div>
                <dt>Ctrl+S</dt>
                <dd>Save project</dd>
              </div>
              <div>
                <dt>Ctrl+E</dt>
                <dd>Standard PDF export</dd>
              </div>
              <div>
                <dt>?</dt>
                <dd>Toggle this help</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
      <HeaderBar
        screen={screen}
        theme={theme}
        onBrandClick={handleBrandClick}
        onToggleTheme={handleToggleTheme}
        onAddPdfs={handleNavAddPdfs}
        onToggleShortcutsHelp={handleToggleShortcutsHelp}
        projectName={project?.name}
        activeDocumentName={activeDocument?.name}
        documentCount={documents.length}
        sourcePageCount={screen === 'workspace' ? sourcePageCount : undefined}
        entries={project?.entries}
        warningCount={reviewIssues.length}
        saveStatus={saveStatus}
        extractionMode={mode}
      />

      {screen === 'onboarding' && (
        <main className="onboarding">
          <section className="onboarding-primary" aria-labelledby="onboarding-title">
            <div className="onboarding-copy">
              <span className="eyebrow">LOCAL PDF WORKSPACE</span>
              <h1 id="onboarding-title" ref={screenHeadingRef} tabIndex={-1}>
                EXACT EXTRACT
              </h1>
              <strong className="onboarding-tagline">Your No.1 PDF extraction tool</strong>
              <p>
                Extract, verify, reconcile, and export difficult PDFs without sending source files
                off-device.
              </p>
              {error && (
                <div className="error-banner" role="alert">
                  {error}
                </div>
              )}
              <div className="onboarding-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void createProject()}
                >
                  <Upload size={17} /> Start a review
                </button>
                {recentProjects[0] && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void openProject(recentProjects[0].id)}
                  >
                    <FolderOpen size={17} /> Resume latest
                  </button>
                )}
              </div>
            </div>
            <RecentProjectsPanel
              projects={recentProjects}
              recoveryStatus={recoveryStatus}
              saveState={
                saveStatus === 'error'
                  ? { status: 'error', message: saveError ?? 'The project could not be saved.' }
                  : ({ status: saveStatus } satisfies SaveRecoveryState)
              }
              onOpen={handleOpenRecentProject}
              onRemove={handleRemoveRecentProject}
              onLocateSources={handleLocateProjectSources}
              onRetrySave={handleRetrySaveAction}
            />
          </section>
          <section className="onboarding-flow" aria-labelledby="workflow-title">
            <div className="onboarding-section-heading">
              <span>END TO END</span>
              <h2 id="workflow-title">From source to final output</h2>
            </div>
            <div className="workflow-preview" aria-label="Review workflow">
              <div className="preview-header">
                <span />
                <span />
                <span />
              </div>
              {[
                ['Import source PDFs', 'Local files stay on this device'],
                ['Preflight and OCR', 'Parser first, OCR where needed'],
                ['Verify and correct', 'Page-linked editable source regions'],
                ['Analyze and reconcile', 'Map columns and validate balances'],
                ['Preview and export', 'Inspect exact output before saving']
              ].map(([label, detail], index) => (
                <div className="preview-row" key={label}>
                  <span className="preview-index">0{index + 1}</span>
                  <div>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </div>
                  {index === 0 ? <Check size={17} /> : <ArrowRight size={17} />}
                </div>
              ))}
            </div>
          </section>
          <ProductUpdatesPanel />
        </main>
      )}

      {screen === 'import' && (
        <main className="flow-screen">
          <div className="flow-heading">
            <button className="back-button" type="button" onClick={() => setScreen('onboarding')}>
              <ArrowLeft size={17} /> Back
            </button>
            <span className="step-label">STEP 1 OF 2</span>
            <h1 ref={screenHeadingRef} tabIndex={-1}>
              Import source documents
            </h1>
            <p>Add one or more PDFs. Duplicate paths are ignored.</p>
            <label className="currency-select-field flow-currency-select">
              <span>Currency</span>
              <select
                value={currencyCode}
                onChange={(event) => selectCurrencyCode(event.target.value as CurrencyCode)}
              >
                {POPULAR_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className={`drop-zone ${isDragging ? 'is-dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setIsDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              void handleDrop(Array.from(event.dataTransfer.files))
            }}
          >
            <span className="drop-icon">
              <Upload size={25} />
            </span>
            <strong>{isDragging ? 'Release to add PDFs' : 'Drop PDF files here'}</strong>
            <span>or choose files from your computer</span>
            <button
              className="secondary-button"
              type="button"
              disabled={isImporting}
              onClick={() => void choosePdfs()}
            >
              <FolderOpen size={17} /> {isImporting ? 'Importing...' : 'Choose PDFs'}
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {documents.length > 0 && (
            <section className="import-list" aria-label="Imported documents">
              <div className="section-heading">
                <strong>
                  {documents.length} document{documents.length === 1 ? '' : 's'}
                </strong>
                <span>
                  {formatSize(documents.reduce((sum, document) => sum + document.size, 0))} total
                </span>
              </div>
              {documents.map((document) => (
                <div className="document-row" key={document.path}>
                  <span className="file-icon">
                    <FileText size={19} />
                  </span>
                  <div>
                    <strong>{document.name}</strong>
                    <small>{formatSize(document.size)}</small>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    title={`Remove ${document.name}`}
                    onClick={() => {
                      setDocuments((current) =>
                        current.filter((item) => item.path !== document.path)
                      )
                      if (activePath === document.path) {
                        setPdfData(null)
                        setActivePath(null)
                      }
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </section>
          )}
          <div className="flow-footer">
            <span>Files are read locally and are not uploaded.</span>
            <button
              className="primary-button"
              type="button"
              disabled={!documents.length}
              onClick={() => setScreen('preflight')}
            >
              Continue to preflight <ArrowRight size={17} />
            </button>
          </div>
        </main>
      )}

      {screen === 'preflight' && (
        <main className="flow-screen preflight-screen">
          <div className="flow-heading">
            <button className="back-button" type="button" onClick={() => setScreen('import')}>
              <ArrowLeft size={17} /> Back
            </button>
            <span className="step-label">STEP 2 OF 2</span>
            <h1 ref={screenHeadingRef} tabIndex={-1}>
              Quality preflight
            </h1>
            <p>Choose how thoroughly the extraction pipeline should inspect these documents.</p>
          </div>
          <div className="preflight-grid">
            <section className="report-panel">
              <div className="section-heading">
                <strong>Source report</strong>
                <span className="status-pill">{isAnalyzing ? 'Analyzing' : 'Ready'}</span>
              </div>
              {documents.map((document) => {
                const result = preflight[document.path]
                return (
                  <div className="report-document" key={document.path}>
                    <span className="file-icon">
                      <FileSearch size={19} />
                    </span>
                    <div>
                      <strong>{document.name}</strong>
                      <small>
                        {result
                          ? `${result.pageCount} pages · ${result.textPageCount} text · ${result.imagePageCount} need review`
                          : `${formatSize(document.size)} · Inspecting pages...`}
                      </small>
                    </div>
                  </div>
                )
              })}
              <div className="report-stats">
                <div>
                  <span>Total pages</span>
                  <strong>
                    {Object.values(preflight).reduce((sum, result) => sum + result.pageCount, 0) ||
                      '...'}
                  </strong>
                </div>
                <div>
                  <span>Text strategy</span>
                  <strong>Parser first</strong>
                </div>
                <div>
                  <span>OCR</span>
                  <strong>
                    {Object.values(preflight).some((result) => result.imagePageCount > 0)
                      ? 'Recommended'
                      : isAnalyzing
                        ? 'Checking'
                        : 'Not needed'}
                  </strong>
                </div>
              </div>
            </section>
            <section className="mode-panel">
              <div className="section-heading">
                <strong>Extraction mode</strong>
                <ChevronDown size={17} />
              </div>
              <div className="mode-options">
                {modeOptions.map((option) => (
                  <label
                    className={`mode-option ${mode === option.id ? 'is-selected' : ''}`}
                    key={option.id}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === option.id}
                      onChange={() => setMode(option.id)}
                    />
                    <span className="radio-dot" />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    {option.id === 'balanced' && <em>Recommended</em>}
                  </label>
                ))}
              </div>
              {mode === 'custom' && (
                <div className="custom-extraction" aria-label="Custom extraction settings">
                  <fieldset>
                    <legend>OCR languages</legend>
                    <div className="choice-grid">
                      {ocrLanguageOptions.map((language) => (
                        <label key={language.code}>
                          <input
                            type="checkbox"
                            checked={ocrLanguages.includes(language.code)}
                            onChange={() => toggleOcrLanguage(language.code)}
                          />
                          <span>{language.label}</span>
                        </label>
                      ))}
                    </div>
                    {ocrLanguages.length === 0 && (
                      <small role="alert">Select at least one OCR language.</small>
                    )}
                  </fieldset>
                  <fieldset>
                    <legend>Pages to OCR</legend>
                    <div className="segmented-control">
                      {(['recommended', 'all', 'range'] as const).map((pageMode) => (
                        <label key={pageMode}>
                          <input
                            type="radio"
                            name="custom-pages"
                            checked={customPageMode === pageMode}
                            onChange={() => setCustomPageMode(pageMode)}
                          />
                          <span>
                            {pageMode === 'range'
                              ? 'Selected'
                              : `${pageMode[0].toUpperCase()}${pageMode.slice(1)}`}
                          </span>
                        </label>
                      ))}
                    </div>
                    {customPageMode === 'range' && (
                      <label className="page-range-field">
                        <span>Page ranges</span>
                        <input
                          value={pageRange}
                          onChange={(event) => setPageRange(event.target.value)}
                          placeholder="1-3, 7, 12-15"
                          aria-describedby="page-range-help"
                        />
                        <small id="page-range-help">Use page numbers separated by commas.</small>
                      </label>
                    )}
                  </fieldset>
                </div>
              )}
            </section>
            <section className="table-template-panel">
              <div className="section-heading">
                <div>
                  <strong>Recognize table rows</strong>
                  <small>Use measured PDF points to validate repeated information rows.</small>
                </div>
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={tableTemplateEnabled}
                    onChange={(event) => setTableTemplateEnabled(event.target.checked)}
                  />
                  <span>Use template</span>
                </label>
              </div>
              {tableTemplateEnabled && (
                <div className="table-template-editor">
                  <div className="template-library">
                    <label>
                      <span>Saved templates</span>
                      <select
                        value=""
                        onChange={(event) => loadTableTemplate(event.target.value)}
                        aria-label="Load saved table template"
                      >
                        <option value="">Load a saved template...</option>
                        {savedTableTemplates.map((template) => (
                          <option value={template.name} key={template.name}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={tableTemplateInvalid || !tableTemplateName.trim()}
                      onClick={saveTableTemplate}
                    >
                      Save template
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title="Delete saved template with this name"
                      aria-label="Delete saved template"
                      disabled={
                        !savedTableTemplates.some(
                          (template) => template.name === tableTemplateName.trim()
                        )
                      }
                      onClick={deleteTableTemplate}
                    >
                      <X size={15} />
                    </button>
                    {tableTemplateStatus && (
                      <small className="template-status" role="status">
                        {tableTemplateStatus}
                      </small>
                    )}
                  </div>
                  <div className="template-basics">
                    <label>
                      <span>Template name</span>
                      <input
                        value={tableTemplateName}
                        onChange={(event) => setTableTemplateName(event.target.value)}
                        placeholder="Expenses table"
                      />
                    </label>
                    <label>
                      <span>Repeated header labels</span>
                      <input
                        value={tableHeaderLabels}
                        onChange={(event) => setTableHeaderLabels(event.target.value)}
                        placeholder="Description, Amount"
                      />
                    </label>
                    <label>
                      <span>Top divider Y</span>
                      <input
                        inputMode="decimal"
                        value={tableTopY}
                        onChange={(event) => setTableTopY(event.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                    <label>
                      <span>Bottom divider Y</span>
                      <input
                        inputMode="decimal"
                        value={tableBottomY}
                        onChange={(event) => setTableBottomY(event.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                  </div>
                  <div className="template-columns-heading">
                    <span>Expected columns</span>
                    <small>Coordinates are stored as PDF points, whatever unit is shown.</small>
                    <LengthUnitSelect onChange={setLengthUnit} />
                  </div>
                  <div className="template-columns" role="list">
                    {tableColumns.map((column, index) => (
                      <div
                        className="template-column"
                        role="listitem"
                        key={`${index}-${column.name}`}
                      >
                        <label>
                          <span>Name</span>
                          <input
                            value={column.name}
                            onChange={(event) =>
                              setTableColumns((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, name: event.target.value } : item
                                )
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Type</span>
                          <select
                            value={column.type}
                            onChange={(event) =>
                              setTableColumns((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        type: event.target.value as TableColumnDefinition['type']
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            {(
                              [
                                'text',
                                'integer',
                                'decimal',
                                'currency',
                                'date',
                                'percentage'
                              ] as const
                            ).map((type) => (
                              <option key={type} value={type}>
                                {type[0].toUpperCase() + type.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Total behavior</span>
                          <select
                            value={column.totalBehavior ?? 'none'}
                            onChange={(event) =>
                              setTableColumns((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        totalBehavior: event.target.value as
                                          'none' | 'add' | 'subtract'
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            <option value="none">No total</option>
                            <option value="add">Add to total</option>
                            <option value="subtract">Subtract from total</option>
                          </select>
                        </label>
                        <LengthField
                          label="X start"
                          value={column.xStart}
                          onChange={(points) =>
                            setTableColumns((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, xStart: points } : item
                              )
                            )
                          }
                        />
                        <LengthField
                          label="X end"
                          value={column.xEnd}
                          onChange={(points) =>
                            setTableColumns((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, xEnd: points } : item
                              )
                            )
                          }
                        />
                        <label className="required-toggle">
                          <input
                            type="checkbox"
                            checked={column.required}
                            onChange={(event) =>
                              setTableColumns((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, required: event.target.checked }
                                    : item
                                )
                              )
                            }
                          />
                          <span>Required</span>
                        </label>
                        <button
                          className="icon-button"
                          type="button"
                          title="Remove column"
                          aria-label={`Remove ${column.name || 'column'}`}
                          disabled={tableColumns.length <= 1}
                          onClick={() =>
                            setTableColumns((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="secondary-button add-column-button"
                    type="button"
                    onClick={() =>
                      setTableColumns((current) => [
                        ...current,
                        {
                          name: `Column ${current.length + 1}`,
                          type: 'text',
                          xStart: 36,
                          xEnd: 150,
                          required: false
                        }
                      ])
                    }
                  >
                    <Plus size={16} /> Add column
                  </button>
                  {tableTemplateInvalid && (
                    <small className="template-error" role="alert">
                      Check column ranges and divider values before extracting.
                    </small>
                  )}
                </div>
              )}
            </section>
          </div>
          {error && (
            <div className="error-banner extraction-error" role="alert">
              <div>
                <strong>Extraction could not complete</strong>
                <span>{error}</span>
              </div>
              {extractionProgress === null && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isAnalyzing || customSettingsInvalid || tableTemplateInvalid}
                  onClick={() => void startExtraction()}
                >
                  Retry extraction
                </button>
              )}
            </div>
          )}
          <div className="flow-footer">
            <span role="status" aria-live="polite" aria-atomic="true">
              {extractionProgress === null
                ? `${modeOptions.find((option) => option.id === mode)?.label} mode selected · OCR: ${ocrLanguages.join(', ')}`
                : `${extractionStage ?? 'Extracting'} · ${Math.round(extractionProgress * 100)}%`}
            </span>
            {extractionProgress === null ? (
              <button
                className="primary-button"
                type="button"
                disabled={isAnalyzing || customSettingsInvalid || tableTemplateInvalid}
                onClick={() => void startExtraction()}
              >
                Extract and review <ArrowRight size={17} />
              </button>
            ) : (
              <button className="secondary-button" type="button" onClick={cancelExtraction}>
                <X size={16} /> Cancel extraction
              </button>
            )}
          </div>
        </main>
      )}

      {screen === 'workspace' && (
        <main className="workspace">
          <div className="workspace-content">
            <div className="split-shell">
              <div className="viewer-pane" style={{ width: `${panePercent}%` }}>
                <PdfViewer
                  ref={pdfViewerRef}
                  key={activeDocument?.path}
                  data={pdfData}
                  fileName={activeDocument?.name ?? 'document'}
                  highlight={viewerHighlight}
                  highlights={viewerHighlights}
                  requestedPage={requestedPdfPage}
                  onPageChange={handlePdfPageChange}
                  onSelectHighlight={selectHighlightEntry}
                  onChangeHighlight={changeViewerHighlight}
                  highlightsVisible={highlightsVisible}
                  highlightEditMode={highlightEditMode}
                  highlightStyleMode={highlightStyleMode}
                  onToggleHighlights={() => setHighlightsVisible((current) => !current)}
                />
              </div>
              <div
                className="pane-resizer"
                role="separator"
                aria-label="Resize PDF and review panes"
                aria-orientation="vertical"
                aria-valuemin={35}
                aria-valuemax={70}
                aria-valuenow={Math.round(panePercent)}
                tabIndex={0}
                onPointerDown={beginResize}
                onPointerMove={resize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onKeyDown={resizeWithKeyboard}
              >
                <GripVertical size={17} aria-hidden="true" />
              </div>
              <RightWorkspace
                mode={workspaceMode}
                warningCount={reviewIssues.length}
                highlightsVisible={highlightsVisible}
                onModeChange={setWorkspaceMode}
                onCommand={handleRightWorkspaceCommand}
                reviewControls={reviewBulkContext}
                entries={
                  <section className="review-results" aria-label="Extracted entries">
                    <div className="review-results-header">
                      <div>
                        <span className="eyebrow">REVIEW QUEUE</span>
                        <strong>
                          {visibleReviewEntries.length}{' '}
                          {viewAllReviewEntries || hasSearchQuery
                            ? 'matching entries in this document'
                            : `entries on pages ${reviewSourcePage}-${reviewPageEnd}`}
                        </strong>
                      </div>
                      <div className="review-source-page-nav" aria-label="Source page navigation">
                        <label className="review-source-page-select">
                          <span>Page</span>
                          <select
                            value={reviewSourcePage}
                            onChange={handleSelectReviewSourcePage}
                            aria-label="Select source PDF page"
                          >
                            {Array.from({ length: sourcePageCount }, (_, index) => index + 1).map(
                              (page) => (
                                <option value={page} key={page}>
                                  {page}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <label className="view-all-toggle">
                          <input
                            type="checkbox"
                            checked={viewAllReviewEntries}
                            onChange={handleToggleViewAllReviewEntries}
                          />
                          <span>View all</span>
                        </label>
                        <label className="review-page-size-control">
                          <span>Show</span>
                          <select
                            value={reviewPageSpan}
                            onChange={handleSelectReviewPageSpan}
                            aria-label="Number of source pages to show"
                          >
                            {['1', '5', '10', '15', '20', '30', '40', '50'].map((size) => (
                              <option value={size} key={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          <span>pages</span>
                        </label>
                      </div>
                      <span className="status-pill">Parser</span>
                    </div>
                    <EntriesList
                      entries={pagedEntries}
                      selectedEntryId={selectedEntryId}
                      selectedEntryIds={selectedReviewIds}
                      issuesByEntry={issuesByEntry}
                      onSelect={navigateToEntry}
                      onToggleSelection={toggleReviewSelection}
                      onSetStatus={setEntryStatus}
                      onEdit={openEntryEditor}
                      onMergeUp={mergeEntryWithRowAbove}
                      canMergeUp={canMergeEntryUp}
                      onPageJump={navigateToReviewPage}
                    />
                    {(project?.entries.length ?? 0) === 0 && (
                      <div className="review-placeholder">
                        <div className="review-empty-icon">
                          <FileSearch size={23} />
                        </div>
                        <h2>No extracted entries</h2>
                        <p>Run extraction from Preflight to populate this queue.</p>
                      </div>
                    )}
                    {(project?.entries.length ?? 0) > 0 && filteredEntries.length === 0 && (
                      <div className="review-placeholder">
                        <h2>No matching entries</h2>
                        <p>Adjust the search or decision filter.</p>
                      </div>
                    )}
                    {editingEntryId &&
                      project?.entries.find((entry) => entry.id === editingEntryId) && (
                        <EntryEditor
                          key={editingEntryId}
                          entry={project.entries.find((entry) => entry.id === editingEntryId)!}
                          onCancel={closeEntryEditor}
                          onSave={handleSaveEditingEntry}
                        />
                      )}
                  </section>
                }
                contexts={{
                  'source-pdf': (
                    <SourcePdfPanel
                      documents={documents}
                      activePath={activeDocument?.path}
                      onSelect={handleSelectSourcePath}
                      onAddPdfs={handleNavAddPdfs}
                    />
                  ),
                  review: null,
                  references: (
                    <ReferenceToolsPanel
                      hasKeptEntries={
                        project?.entries.some((entry) => entry.status === 'keep') ?? false
                      }
                      hasActiveDocument={Boolean(activeDocument)}
                      isScanning={isScanningSourceReferences}
                      isBusy={extractionProgress !== null || exportState.isSaving}
                      ocrLanguages={ocrLanguages}
                      status={referenceCopyStatus}
                      results={referenceToolResults}
                      onCopyExisting={copyKeptReferencesToNotes}
                      onScanPdfText={() => void scanPdfTextReferencesToNotes()}
                      onScanOcr={() => void scanSourceReferencesToNotes()}
                      onCancelScan={cancelSourceReferenceScan}
                      onClearScannedReferences={clearScannedReferences}
                      onToggleOcrLanguage={toggleOcrLanguage}
                    />
                  ),
                  merchants: (
                    <MerchantLibraryPanel
                      records={merchantLibrary.records}
                      isLoading={merchantLibrary.isLoading}
                      isRescanning={merchantLibrary.isRescanning}
                      error={merchantLibrary.error}
                      status={merchantLibrary.status}
                      projectId={project?.id}
                      canRescan={Boolean(project) && extractionProgress === null}
                      onApprove={merchantLibrary.approve}
                      onExclude={merchantLibrary.exclude}
                      onRestore={merchantLibrary.restore}
                      onToggleForecast={merchantLibrary.toggleForecast}
                      onUpdate={merchantLibrary.update}
                      onForget={merchantLibrary.forget}
                      onCreate={merchantLibrary.create}
                      onMergeAlias={merchantLibrary.mergeAlias}
                      onAddScenarioRows={addScenarioRows}
                      onRescanProject={() => {
                        if (project) merchantLibrary.rescanProject(project.id)
                      }}
                      onNavigateToEntry={focusEntryInReview}
                    />
                  ),
                  analysis: (
                    <AnalysisWorkspace
                      entries={project?.entries ?? []}
                      configuration={analysisConfiguration}
                      snapshot={analysisSnapshot}
                      currencyCode={currencyCode}
                      onConfigurationChange={setAnalysisConfiguration}
                      onNavigateToEntry={focusEntryInReview}
                    />
                  ),
                  export: projectSnapshot ? (
                    <ExportPanel
                      snapshot={buildExportSnapshot(projectSnapshot)}
                      status={exportState.status}
                      isSaving={exportState.isSaving}
                      initialTemplateEditorOpen={openKeptConfig === 'text'}
                      initialImageLayoutEditorOpen={openKeptConfig === 'png'}
                      rowHeight={exportRowHeight}
                      onRowHeightChange={setExportRowHeight}
                      onSave={saveExport}
                      onPreview={generatePdfExport}
                      selectedEntryId={selectedEntryId}
                      onSelectEntry={focusEntryInReview}
                      keptEntries={projectSnapshot.entries}
                      onTemplateExport={handleTemplateExport}
                      onOpenKeptTemplateCanvas={handleTemplatePreview}
                      keptExportTemplate={keptExportTemplate}
                      onTemplateApply={applyKeptExportTemplate}
                      currencySymbol={currencySymbol(currencyCode)}
                      onPlaceKeptImages={handlePlaceKeptImages}
                      onOpenKeptCanvas={() => setShowKeptCanvas('png')}
                      onOpenKeptTextCanvas={() => setShowKeptCanvas('text')}
                      placedImageCount={keptEntriesLayout.images?.length ?? 0}
                      onPreviewPlacedImages={() => setShowKeptCanvas('png')}
                      imagePlacementOptions={keptEntriesLayout.imagePlacementOptions}
                      uploadedImageSources={keptEntriesLayout.uploadedImageSources}
                      onImagePlacementConfigurationChange={handleImagePlacementConfigurationChange}
                      keptImagePageNumbers={keptEntriesLayout.pageNumbers}
                      onKeptImagePageNumbersChange={(pageNumbers) =>
                        setKeptEntriesLayout((current) => ({ ...current, pageNumbers }))
                      }
                      canvasBackground={keptEntriesLayout.background}
                      onDetectPageNumbers={detectActivePageNumberStyle}
                      onConfigurationEditorClosed={() => setOpenKeptConfig(null)}
                    />
                  ) : null,
                  style: (
                    <StyleProfilePanel
                      profile={activeStyleProfile}
                      status={styleDetectionStatus}
                      onDetect={() => void detectActiveDocumentStyle()}
                      onApplyBodyStyle={applyStyleProfileTextStyle}
                      onApplyHeaderStyle={applyStyleProfileTextStyle}
                      onApplyDividerStyle={applyStyleProfileDivider}
                    />
                  ),
                  pages: (
                    <PagePreviewStrip
                      pageCount={sourcePageCount}
                      currentPage={reviewSourcePage}
                      onSelectPage={navigateToReviewPage}
                      pageReviewCounts={pageReviewCounts}
                      renderThumbnail={(pageNumber) => (
                        <PageThumbnail
                          data={pdfData}
                          pageNumber={pageNumber}
                          aspectRatio={pageAspectRatios.get(pageNumber)}
                        />
                      )}
                    />
                  ),
                  warnings: (
                    <div className="right-context-warnings" aria-label="Warning details">
                      {reviewIssues.length === 0 ? (
                        <p>No warnings or duplicates.</p>
                      ) : (
                        reviewIssues.map((issue) => (
                          <button
                            type="button"
                            key={issue.id}
                            title={issue.evidence}
                            onClick={() => navigateToEntry(issue.entryIds[0]!)}
                          >
                            <AlertTriangle size={14} aria-hidden="true" />
                            <span>
                              {issue.code === 'duplicate-entry' ? 'Duplicate' : 'Broken row'} · p
                              {issue.pageNumbers.join('/')}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ),
                  'remove-pages': (
                    <RemovePagesPanel
                      currentPage={reviewSourcePage}
                      pageCount={sourcePageCount}
                      isRemoving={isRemovingPages}
                      status={pageRemovalStatus}
                      canUndo={pageRemovalHistory.undoCount > 0}
                      canRedo={pageRemovalHistory.redoCount > 0}
                      onUndo={undoPageRemoval}
                      onRedo={redoPageRemoval}
                      onRemovePages={handleRemovePagesAction}
                    />
                  ),
                  marks: (
                    <HighlightToolPanel
                      visible={highlightsVisible}
                      editMode={highlightEditMode}
                      styleMode={highlightStyleMode}
                      scope={highlightScope}
                      affectedCount={highlightTargets.length}
                      checkedCount={selectedReviewIds.size}
                      measurements={highlightMeasurements}
                      lastResult={highlightResult}
                      onChangeVisible={setHighlightsVisible}
                      onChangeEditMode={setHighlightEditMode}
                      onChangeStyleMode={setHighlightStyleMode}
                      onChangeScope={setHighlightScope}
                      onSetStatus={setHighlightTargetStatus}
                      onApply={applyHighlightEdit}
                    />
                  )
                }}
              />
            </div>
          </div>
        </main>
      )}
    </div>
  )
}

export default App

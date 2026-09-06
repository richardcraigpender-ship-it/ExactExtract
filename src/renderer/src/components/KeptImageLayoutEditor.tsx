import React from 'react'
import { Images } from 'lucide-react'

import type { KeptImagePlan, KeptImageSourceDescriptor } from '../../../export'
import type { ProjectEntry } from '../../../shared/contracts'
import type {
  KeptEntriesOrientation,
  KeptEntriesPageSize,
  KeptImagePlacementOptions
} from '../../../shared/keptEntriesLayout'
import type {
  KeptExportPageNumbers,
  KeptExportRunningBalance
} from '../../../shared/keptExportTemplate'
import type { DetectedPageNumberMatch } from '../../../style'
import { KeptImagePlacementSection } from './KeptImagePlacementSection'

interface KeptImageLayoutEditorProps {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  sessionImageSources: readonly KeptImageSourceDescriptor[]
  keptEntries?: readonly ProjectEntry[]
  runningBalance?: KeptExportRunningBalance
  placedImageCount: number
  onPlaceImages: (plan: KeptImagePlan) => void
  onUploadPngs: (files: File[]) => Promise<KeptImageSourceDescriptor[]>
  onPreviewPlacedImages: () => void
  onClose: () => void
  initialOptions?: KeptImagePlacementOptions
  initialUploadedSources?: readonly KeptImageSourceDescriptor[]
  onConfigurationChange: (
    options: KeptImagePlacementOptions,
    uploadedSources: readonly KeptImageSourceDescriptor[]
  ) => void
  initialPageNumbers?: KeptExportPageNumbers
  onPageNumbersChange?: (pageNumbers: KeptExportPageNumbers) => void
  onDetectPageNumbers?: () => Promise<DetectedPageNumberMatch | undefined>
}

export function KeptImageLayoutEditor({
  pageSize,
  orientation,
  sessionImageSources,
  keptEntries = [],
  runningBalance,
  placedImageCount,
  onPlaceImages,
  onUploadPngs,
  onPreviewPlacedImages,
  onClose,
  initialOptions,
  initialUploadedSources,
  onConfigurationChange,
  initialPageNumbers,
  onPageNumbersChange,
  onDetectPageNumbers
}: KeptImageLayoutEditorProps): React.JSX.Element {
  return (
    <section className="kept-image-layout-editor" aria-labelledby="kept-image-layout-editor-title">
      <header className="kept-image-layout-editor-header">
        <div>
          <span className="eyebrow">KEPT PNG LAYOUT</span>
          <strong id="kept-image-layout-editor-title">Place entry images</strong>
        </div>
        <Images size={18} aria-hidden="true" />
      </header>
      <div className="kept-image-layout-editor-scroll">
        <KeptImagePlacementSection
          pageSize={pageSize}
          orientation={orientation}
          sessionSources={sessionImageSources}
          keptEntries={keptEntries}
          runningBalance={runningBalance}
          onPlaceImages={onPlaceImages}
          onUploadPngs={onUploadPngs}
          placedImageCount={placedImageCount}
          onPreviewPlacedImages={onPreviewPlacedImages}
          initialOptions={initialOptions}
          initialUploadedSources={initialUploadedSources}
          onConfigurationChange={onConfigurationChange}
          initialPageNumbers={initialPageNumbers}
          onPageNumbersChange={onPageNumbersChange}
          onDetectPageNumbers={onDetectPageNumbers}
        />
      </div>
      <footer className="kept-image-layout-editor-footer">
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </footer>
    </section>
  )
}

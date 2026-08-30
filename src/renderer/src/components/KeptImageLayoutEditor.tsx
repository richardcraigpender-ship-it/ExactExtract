import React from 'react'
import { Images } from 'lucide-react'

import type { KeptImagePlan, KeptImageSourceDescriptor } from '../../../export'
import type { KeptEntriesOrientation, KeptEntriesPageSize } from '../../../shared/keptEntriesLayout'
import { KeptImagePlacementSection } from './KeptImagePlacementSection'

interface KeptImageLayoutEditorProps {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  sessionImageSources: readonly KeptImageSourceDescriptor[]
  placedImageCount: number
  onPlaceImages: (plan: KeptImagePlan) => void
  onUploadPngs: (files: File[]) => Promise<KeptImageSourceDescriptor[]>
  onPreviewPlacedImages: () => void
  onClose: () => void
}

export function KeptImageLayoutEditor({
  pageSize,
  orientation,
  sessionImageSources,
  placedImageCount,
  onPlaceImages,
  onUploadPngs,
  onPreviewPlacedImages,
  onClose
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
          onPlaceImages={onPlaceImages}
          onUploadPngs={onUploadPngs}
          placedImageCount={placedImageCount}
          onPreviewPlacedImages={onPreviewPlacedImages}
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

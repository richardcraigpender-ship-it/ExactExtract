import {
  cloneKeptExportTemplateDraft,
  createDefaultKeptExportTemplateDraft,
  type KeptExportPageTemplateDraft,
  type KeptExportTemplateDraft
} from '../components/keptExportTemplateDraft'

/**
 * Three documented export paths (Sprint 3). 'image-archive' does not produce a text template; it
 * routes to the existing PNG snippet board workflow instead.
 */
export type ExportPresetId = 'clean-statement' | 'source-faithful' | 'image-archive'

export interface ExportPresetDefinition {
  id: ExportPresetId
  name: string
  description: string
  includesReferences: boolean
  includesSourceCrops: boolean
  invitesInventedText: boolean
}

export const EXPORT_PRESETS: readonly ExportPresetDefinition[] = [
  {
    id: 'clean-statement',
    name: 'Clean statement',
    description:
      'Normalized payee, date, and amount columns. References are off by default and no source crops are included.',
    includesReferences: false,
    includesSourceCrops: false,
    invitesInventedText: false
  },
  {
    id: 'source-faithful',
    name: 'Source-faithful evidence',
    description:
      'Keeps the reference line and conservative clipping so provenance stays visible; no source images.',
    includesReferences: true,
    includesSourceCrops: false,
    invitesInventedText: false
  },
  {
    id: 'image-archive',
    name: 'Image archive',
    description:
      'Source snippet images and page references only \u2014 opens the PNG snippet board instead of a text layout.',
    includesReferences: false,
    includesSourceCrops: true,
    invitesInventedText: false
  }
]

export type TextExportPresetId = Exclude<ExportPresetId, 'image-archive'>

function withReferenceVisibility(
  template: KeptExportPageTemplateDraft,
  showReference: boolean
): KeptExportPageTemplateDraft {
  return { ...template, showReferenceUnderMainText: showReference }
}

/**
 * Applies a text-based preset over an existing draft (or the shipped default) without touching
 * unrelated fields the user may already have configured, such as fonts, dividers, or backgrounds.
 */
export function applyExportPresetToDraft(
  presetId: TextExportPresetId,
  base?: KeptExportTemplateDraft
): KeptExportTemplateDraft {
  const draft = cloneKeptExportTemplateDraft(base ?? createDefaultKeptExportTemplateDraft())
  const showReference = presetId === 'source-faithful'
  return {
    ...draft,
    pageOneTemplate: withReferenceVisibility(draft.pageOneTemplate, showReference),
    laterPagesTemplate: withReferenceVisibility(draft.laterPagesTemplate, showReference)
  }
}

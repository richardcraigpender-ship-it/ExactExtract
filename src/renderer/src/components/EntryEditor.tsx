import { useState } from 'react'
import { Save, X } from 'lucide-react'
import type { ProjectEntry } from '../../../shared/contracts'

export interface EntryEditPatch {
  normalizedText: string
  category?: string
  numericValue?: number
  date?: string
  notes?: string
  tags: string[]
}

interface EntryEditorProps {
  entry: ProjectEntry
  onCancel: () => void
  onSave: (patch: EntryEditPatch) => void
}

export function EntryEditor({ entry, onCancel, onSave }: EntryEditorProps): React.JSX.Element {
  const [normalizedText, setNormalizedText] = useState(entry.normalizedText)
  const [category, setCategory] = useState(entry.category ?? '')
  const [numericValue, setNumericValue] = useState(
    entry.numericValue === undefined ? '' : String(entry.numericValue)
  )
  const [date, setDate] = useState(entry.date ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [tags, setTags] = useState(entry.tags.join(', '))

  const save = (): void => {
    const cleanTags = [
      ...new Set(
        tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ]
    onSave({
      normalizedText: normalizedText.trim(),
      category: category.trim() || undefined,
      numericValue: numericValue.trim() === '' ? undefined : Number(numericValue),
      date: date || undefined,
      notes: notes.trim() || undefined,
      tags: cleanTags
    })
  }

  return (
    <aside className="entry-editor" aria-label="Edit extracted entry">
      <div className="entry-editor-header">
        <div>
          <span className="eyebrow">EDIT ENTRY</span>
          <strong>Preserve source, refine output</strong>
        </div>
        <button className="icon-button" type="button" title="Close editor" onClick={onCancel}>
          <X size={16} />
        </button>
      </div>
      <div className="entry-editor-body">
        <label>
          <span>Original text</span>
          <textarea value={entry.rawText} readOnly rows={3} />
        </label>
        <label>
          <span>Reviewed text</span>
          <textarea
            value={normalizedText}
            onChange={(event) => setNormalizedText(event.target.value)}
            rows={4}
          />
        </label>
        <label>
          <span>Category</span>
          <input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label>
          <span>Numeric value</span>
          <input
            type="number"
            step="any"
            value={numericValue}
            onChange={(event) => setNumericValue(event.target.value)}
          />
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          <span>Tags</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="invoice, total, needs-review"
          />
        </label>
        <label>
          <span>Notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>
      </div>
      <div className="entry-editor-footer">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={
            !normalizedText.trim() ||
            (numericValue.trim() !== '' && !Number.isFinite(Number(numericValue)))
          }
          onClick={save}
        >
          <Save size={16} /> Save changes
        </button>
      </div>
    </aside>
  )
}

import React, { useState } from 'react'
import { Search } from 'lucide-react'
import {
  isLocalFontAccessSupported,
  listSystemFonts,
  type SystemFontOption
} from '../lib/localFonts'

export interface FontPickerSelection {
  family: string
  style: string
  postscriptName: string
}

interface FontPickerProps {
  value: FontPickerSelection | null
  onChange: (selection: FontPickerSelection) => void
}

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'denied' | 'error'

export function FontPicker({ value, onChange }: FontPickerProps): React.JSX.Element {
  const supported = isLocalFontAccessSupported()
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [fonts, setFonts] = useState<SystemFontOption[]>([])
  const [query, setQuery] = useState('')

  const handleBrowse = async (): Promise<void> => {
    setStatus('loading')
    try {
      const installed = await listSystemFonts()
      setFonts(installed)
      setStatus('loaded')
    } catch (browseError) {
      setStatus(
        browseError instanceof DOMException && browseError.name === 'NotAllowedError'
          ? 'denied'
          : 'error'
      )
    }
  }

  if (!supported) {
    return (
      <p className="font-picker font-picker-unsupported">
        System font browsing isn&apos;t available on this platform. Standard PDF fonts only.
      </p>
    )
  }

  if (status === 'idle') {
    return (
      <button
        className="secondary-button font-picker-browse"
        type="button"
        onClick={() => void handleBrowse()}
      >
        Browse system fonts
      </button>
    )
  }

  if (status === 'loading') {
    return <p className="font-picker font-picker-loading">Loading installed fonts...</p>
  }

  if (status === 'denied' || status === 'error') {
    return (
      <div className="font-picker font-picker-error">
        <p className="error-banner" role="alert">
          {status === 'denied'
            ? 'Font access was denied. Standard PDF fonts only.'
            : "Couldn't read installed fonts. Standard PDF fonts only."}
        </p>
        <button className="secondary-button" type="button" onClick={() => void handleBrowse()}>
          Try again
        </button>
      </div>
    )
  }

  const filtered = fonts.filter((font) =>
    font.family.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  )

  return (
    <div className="font-picker font-picker-list">
      <label className="font-picker-search">
        <Search size={14} aria-hidden="true" />
        <span className="sr-only">Search installed fonts</span>
        <input
          type="search"
          placeholder="Search installed fonts..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul role="listbox" aria-label="Installed fonts">
        {filtered.length === 0 && <li className="font-picker-empty">No matching fonts.</li>}
        {filtered.map((font) => {
          const selected = value?.postscriptName === font.postscriptName
          return (
            <li key={font.postscriptName}>
              <button
                className="font-picker-option"
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() =>
                  onChange({
                    family: font.family,
                    style: font.style,
                    postscriptName: font.postscriptName
                  })
                }
              >
                <span style={{ fontFamily: font.family }}>{font.fullName}</span>
                <small>{font.style}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

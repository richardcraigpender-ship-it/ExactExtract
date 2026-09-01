import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { DocumentStyleProfile } from '../../../shared/documentStyle'
import { StyleProfilePanel } from './StyleProfilePanel'

void React

function profile(overrides: Partial<DocumentStyleProfile> = {}): DocumentStyleProfile {
  return {
    id: 'profile-1',
    documentId: 'document-1',
    generatedAt: '2026-09-01T12:00:00.000Z',
    detectorVersion: 1,
    source: 'pdf-text',
    confidence: 'high',
    textStyles: [
      {
        id: 'header-style',
        fontFamily: 'Helvetica',
        fontFace: 'Helvetica-Bold',
        fontSize: 18,
        fontWeight: 'bold',
        italic: false,
        underline: false,
        colour: { hex: '#17231c', name: 'Text' },
        likelyRole: 'header',
        occurrenceCount: 2,
        characterCount: 24,
        pageNumbers: [1],
        sampleText: ['Statement']
      },
      {
        id: 'body-style',
        fontFamily: 'Helvetica',
        fontSize: 11,
        fontWeight: 'regular',
        italic: false,
        underline: false,
        colour: { hex: '#17231c', name: 'Text' },
        likelyRole: 'body',
        occurrenceCount: 12,
        characterCount: 180,
        pageNumbers: [1, 2],
        sampleText: ['Transaction row']
      }
    ],
    dividerStyles: [
      {
        id: 'divider-1',
        orientation: 'horizontal',
        thickness: 1,
        averageLength: 516,
        colour: { hex: '#17231c', name: 'Text' },
        likelyRole: 'table-rule',
        occurrenceCount: 4,
        pageNumbers: [1, 2]
      }
    ],
    colourPalette: [{ hex: '#17231c', name: 'Text', occurrenceCount: 14, likelyRole: 'text' }],
    pageSummaries: [
      {
        pageNumber: 1,
        textStyleClusterIds: ['header-style', 'body-style'],
        dominantTextStyleId: 'body-style',
        imageObjectCount: 0,
        characterCount: 120
      },
      {
        pageNumber: 2,
        textStyleClusterIds: ['body-style'],
        dominantTextStyleId: 'body-style',
        imageObjectCount: 0,
        characterCount: 84
      }
    ],
    warnings: [],
    ...overrides
  }
}

test('renders an accessible no-profile state with a manual detect action', () => {
  const markup = renderToStaticMarkup(<StyleProfilePanel onDetect={() => undefined} />)

  assert.match(markup, /aria-label="Document style profile"/)
  assert.match(markup, /No style profile yet/)
  assert.match(markup, /Detect style/)
})

test('renders full style profile summaries and explicit apply actions', () => {
  const markup = renderToStaticMarkup(
    <StyleProfilePanel
      profile={profile()}
      status="Style profile updated."
      onDetect={() => undefined}
      onApplyBodyStyle={() => undefined}
      onApplyHeaderStyle={() => undefined}
      onApplyDividerStyle={() => undefined}
    />
  )

  assert.match(markup, /Style profile updated/)
  assert.match(markup, /Confidence/)
  assert.match(markup, />high</)
  assert.match(markup, /Apply body style/)
  assert.match(markup, /Apply header style/)
  assert.match(markup, /Apply divider style/)
  assert.match(markup, /header/)
  assert.match(markup, /body/)
  assert.match(markup, /Helvetica, 11 pt/)
})

test('renders partial profile warnings without enabling unavailable apply actions', () => {
  const partial = profile({
    source: 'ocr-image',
    confidence: 'low',
    textStyles: [],
    dividerStyles: [],
    colourPalette: [],
    warnings: [
      {
        code: 'image-only',
        message: 'No embedded text style metadata was found.'
      }
    ]
  })
  const markup = renderToStaticMarkup(
    <StyleProfilePanel profile={partial} onDetect={() => undefined} />
  )

  assert.match(markup, /No embedded text style metadata was found/)
  assert.match(markup, /disabled=""[^>]*>Apply body style/)
  assert.match(markup, /disabled=""[^>]*>Apply divider style/)
})

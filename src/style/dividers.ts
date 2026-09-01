import type { DividerStyleCluster, DividerStyleRole } from '../shared/contracts'
import type { PageVisualRule } from '../extraction/types'
import { clusterColours, styleColour } from './colors'

function bucket(value: number, step = 0.5): number {
  return Math.max(0, Math.round(value / step) * step)
}

function roleFor(rule: PageVisualRule, pageHeight: number): DividerStyleRole {
  if (rule.orientation === 'vertical') return 'margin-rule'
  if (rule.thickness <= 1.5 && rule.length >= 80 && rule.y > pageHeight * 0.12) return 'table-rule'
  if (rule.length >= 200) return 'section-divider'
  return 'unknown'
}

export function detectDividerStyles(
  pages: readonly { pageNumber: number; height: number; visualRules?: readonly PageVisualRule[] }[]
): DividerStyleCluster[] {
  const clusters = new Map<
    string,
    DividerStyleCluster & { totalLength: number; pages: Set<number> }
  >()

  for (const page of pages) {
    for (const rule of page.visualRules ?? []) {
      if (rule.length < 8) continue
      const colour = styleColour(rule.colour)
      const thickness = bucket(rule.thickness || 1)
      const likelyRole = roleFor(rule, page.height)
      const id = [rule.orientation, thickness.toFixed(1), colour?.hex ?? 'unknown', likelyRole]
        .join('|')
        .replace(/[^a-z0-9|.#-]+/gi, '-')
      const current = clusters.get(id)
      if (current) {
        current.occurrenceCount += 1
        current.totalLength += rule.length
        current.pages.add(page.pageNumber)
      } else {
        clusters.set(id, {
          id,
          orientation: rule.orientation,
          thickness,
          averageLength: rule.length,
          ...(colour ? { colour } : {}),
          likelyRole,
          occurrenceCount: 1,
          pageNumbers: [page.pageNumber],
          totalLength: rule.length,
          pages: new Set([page.pageNumber])
        })
      }
    }
  }

  return [...clusters.values()]
    .map(({ totalLength, pages, ...cluster }) => ({
      ...cluster,
      averageLength: Math.round((totalLength / cluster.occurrenceCount) * 10) / 10,
      pageNumbers: [...pages].sort((left, right) => left - right)
    }))
    .sort(
      (left, right) =>
        right.occurrenceCount - left.occurrenceCount ||
        left.orientation.localeCompare(right.orientation) ||
        left.id.localeCompare(right.id)
    )
}

export function colourPaletteFromDividers(
  dividers: readonly DividerStyleCluster[]
): ReturnType<typeof clusterColours> {
  return clusterColours(
    dividers.flatMap((divider) =>
      Array.from({ length: divider.occurrenceCount }, () => ({
        hex: divider.colour?.hex,
        role: 'divider' as const
      }))
    )
  )
}

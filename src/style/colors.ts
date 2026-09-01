import type { ColourCluster, StyleColour } from '../shared/contracts'

function channel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function normalizeHexColour(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(raw)
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase()
  const long = /^#([\da-f]{6})$/i.exec(raw)
  return long ? `#${long[1].toLowerCase()}` : undefined
}

export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map(channel)
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')}`
}

function parseHex(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16)
  ]
}

export function nearestColourName(hex: string): string {
  const normalized = normalizeHexColour(hex) ?? '#000000'
  const [red, green, blue] = parseHex(normalized)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const chroma = max - min
  if (max < 32) return 'Black'
  if (min > 224 && chroma < 24) return 'White'
  if (chroma < 24) return 'Gray'

  let hue = 0
  if (max === red) hue = ((green - blue) / chroma + (green < blue ? 6 : 0)) * 60
  else if (max === green) hue = ((blue - red) / chroma + 2) * 60
  else hue = ((red - green) / chroma + 4) * 60

  if (hue < 20 || hue >= 345) return 'Red'
  if (hue < 45) return 'Orange'
  if (hue < 70) return 'Yellow'
  if (hue < 165) return 'Green'
  if (hue < 255) return 'Blue'
  if (hue < 310) return 'Purple'
  return 'Red'
}

export function styleColour(hex: string | undefined): StyleColour | undefined {
  const normalized = normalizeHexColour(hex)
  return normalized ? { hex: normalized, name: nearestColourName(normalized) } : undefined
}

export function clusterColours(
  values: readonly { hex?: string; role: ColourCluster['likelyRole'] }[]
): ColourCluster[] {
  const clusters = new Map<string, ColourCluster>()
  for (const value of values) {
    const hex = normalizeHexColour(value.hex)
    if (!hex) continue
    const current = clusters.get(hex)
    if (current) {
      current.occurrenceCount += 1
    } else {
      clusters.set(hex, {
        hex,
        name: nearestColourName(hex),
        occurrenceCount: 1,
        likelyRole: value.role
      })
    }
  }
  return [...clusters.values()].sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount || left.hex.localeCompare(right.hex)
  )
}

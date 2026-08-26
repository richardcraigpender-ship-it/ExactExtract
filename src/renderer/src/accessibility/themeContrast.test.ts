import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

interface RgbColor {
  red: number
  green: number
  blue: number
}

function parseHexColor(value: string): RgbColor {
  const hex = value.replace('#', '')
  const expanded = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join('') : hex
  assert.match(expanded, /^[0-9a-f]{6}$/i)
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16)
  }
}

function luminance(color: RgbColor): number {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(
    luminance(parseHexColor(foreground)),
    luminance(parseHexColor(background))
  )
  const darker = Math.min(
    luminance(parseHexColor(foreground)),
    luminance(parseHexColor(background))
  )
  return (lighter + 0.05) / (darker + 0.05)
}

function themeVariables(css: string, selector: string): Map<string, string> {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))?.[1]
  assert.ok(block, `Missing ${selector} theme block`)
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{3,8})\s*;/gi)].map((match) => [
      match[1]!,
      match[2]!
    ])
  )
}

function assertNormalTextContrast(
  theme: string,
  variables: ReadonlyMap<string, string>,
  foreground: string,
  background: string
): void {
  const foregroundColor = variables.get(foreground)
  const backgroundColor = variables.get(background)
  assert.ok(foregroundColor, `Missing --${foreground}`)
  assert.ok(backgroundColor, `Missing --${background}`)
  assert.ok(
    contrastRatio(foregroundColor, backgroundColor) >= 4.5,
    `${theme} --${foreground} on --${background} must meet WCAG AA`
  )
}

test('light and dark semantic text colors meet WCAG AA contrast', async () => {
  const css = await readFile(join(process.cwd(), 'src/renderer/src/assets/main.css'), 'utf8')
  const themes = [
    ['light', themeVariables(css, ':root')],
    ['dark', themeVariables(css, ":root[data-theme='dark']")]
  ] as const

  for (const [theme, variables] of themes) {
    for (const background of ['studio-bg', 'studio-surface', 'studio-raised', 'studio-muted']) {
      assertNormalTextContrast(theme, variables, 'studio-text', background)
    }
    assertNormalTextContrast(theme, variables, 'studio-text-muted', 'studio-surface')
    assertNormalTextContrast(theme, variables, 'studio-accent', 'studio-accent-soft')
    assertNormalTextContrast(theme, variables, 'studio-error', 'studio-surface')
  }

  assert.ok(contrastRatio('#fff', '#176b4d') >= 4.5, 'Primary buttons must meet WCAG AA')
})

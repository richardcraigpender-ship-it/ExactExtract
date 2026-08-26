import type { ProjectState } from '../shared/contracts'
import { buildExportSnapshot } from './snapshot'
import type { ExportOptions } from './types'

export function exportProjectJson(project: ProjectState, options: ExportOptions = {}): string {
  return `${JSON.stringify(buildExportSnapshot(project, options), null, 2)}\n`
}

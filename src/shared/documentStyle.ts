import type { DividerStyleCluster, TextStyleCluster } from './contracts'
import type { KeptExportDivider, KeptExportTextStyle } from './keptExportTemplate'

export type {
  ColourCluster,
  DividerStyleCluster,
  DocumentStyleProfile,
  TextStyleCluster
} from './contracts'

export function textStyleToKeptExportTextStyle(style: TextStyleCluster): KeptExportTextStyle {
  return {
    fontRef: {
      kind: 'standard-14',
      family: /courier/i.test(style.fontFamily)
        ? 'Courier'
        : /times|serif/i.test(style.fontFamily)
          ? 'Times-Roman'
          : style.fontWeight === 'bold'
            ? 'Helvetica-Bold'
            : 'Helvetica'
    },
    fontSize: style.fontSize,
    color: style.colour?.hex ?? '#17231c',
    fontWeight: style.fontWeight === 'bold' || style.fontWeight === 'semibold' ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal'
  }
}

export function dividerStyleToKeptExportDivider(style: DividerStyleCluster): KeptExportDivider {
  return {
    enabled: true,
    startX: 48,
    endX: 564,
    width: style.averageLength || 516,
    thickness: style.thickness,
    color: style.colour?.hex ?? '#17231c',
    opacity: 0.45
  }
}

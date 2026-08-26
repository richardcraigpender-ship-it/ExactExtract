import type { ClassifiedPage, ParsedPage } from './types'

export function classifyPage(page: ParsedPage): ClassifiedPage {
  const { characterCount, imageObjectCount, rotation } = page

  if (rotation !== 0) {
    return {
      ...page,
      kind: 'rotated',
      classificationConfidence: 0.98,
      ocrRecommended: characterCount < 24
    }
  }

  if (characterCount === 0) {
    const hasImages = imageObjectCount > 0
    return {
      ...page,
      kind: hasImages ? 'image' : 'unknown',
      classificationConfidence: hasImages ? 0.98 : 0.6,
      ocrRecommended: hasImages
    }
  }

  if (characterCount < 24) {
    return {
      ...page,
      kind: 'sparse',
      classificationConfidence: 0.9,
      ocrRecommended: true
    }
  }

  const likelyMixed = imageObjectCount >= 2 || (imageObjectCount === 1 && characterCount < 200)
  if (likelyMixed) {
    return {
      ...page,
      kind: 'mixed',
      classificationConfidence: 0.85,
      ocrRecommended: characterCount < 120
    }
  }

  return {
    ...page,
    kind: 'text',
    classificationConfidence: characterCount >= 200 ? 0.98 : 0.88,
    ocrRecommended: false
  }
}

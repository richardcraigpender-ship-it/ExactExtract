export interface OcrPreprocessingOptions {
  grayscale?: boolean
  threshold?: number
}

function validateThreshold(threshold: number): void {
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
    throw new Error('OCR threshold must be an integer between 0 and 255.')
  }
}

export function preprocessImageData(
  source: ImageData,
  options: OcrPreprocessingOptions
): ImageData {
  const copiedData = new Uint8ClampedArray(source.data)
  const output =
    typeof ImageData === 'undefined'
      ? ({ data: copiedData, width: source.width, height: source.height } as ImageData)
      : new ImageData(copiedData, source.width, source.height)
  if (options.threshold !== undefined) validateThreshold(options.threshold)
  if (!options.grayscale && options.threshold === undefined) return output

  for (let index = 0; index < output.data.length; index += 4) {
    const luminance = Math.round(
      output.data[index]! * 0.299 +
        output.data[index + 1]! * 0.587 +
        output.data[index + 2]! * 0.114
    )
    const value =
      options.threshold === undefined ? luminance : luminance >= options.threshold ? 255 : 0
    output.data[index] = value
    output.data[index + 1] = value
    output.data[index + 2] = value
  }
  return output
}

export function preprocessCanvas(
  canvas: HTMLCanvasElement,
  options: OcrPreprocessingOptions
): void {
  if (!options.grayscale && options.threshold === undefined) return
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A 2D canvas context is required for OCR preprocessing.')
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  context.putImageData(preprocessImageData(image, options), 0, 0)
}

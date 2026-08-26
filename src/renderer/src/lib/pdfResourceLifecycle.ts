export interface DestroyablePdfDocument {
  destroy(): Promise<void> | void
}

export async function withPdfDocument<TDocument extends DestroyablePdfDocument, TResult>(
  load: () => Promise<TDocument>,
  consume: (document: TDocument) => Promise<TResult>
): Promise<TResult> {
  const document = await load()
  try {
    return await consume(document)
  } finally {
    await document.destroy()
  }
}

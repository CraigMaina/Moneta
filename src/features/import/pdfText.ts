import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { reconstructLines, type PositionedText } from './pdfLines'

/**
 * pdf.js glue for the statement PDF path (PRD F5). Kept in its own module that
 * is ONLY reached via `await import('./pdfText')` from the import panel, so
 * pdf.js (~1 MB + worker) is a lazy chunk that never touches the initial bundle
 * — the cost is paid only by someone who actually imports a PDF.
 *
 * Fully on-device: the PDF bytes and its password never leave the browser. The
 * password is a per-statement code M-PESA texts the user (no longer their ID);
 * it lives only in transient component state and is passed straight to pdf.js.
 */

// The worker is emitted as its own asset by Vite (`?url`) and loaded at runtime.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** Thrown when the PDF needs a password (`incorrect: false`) or the one given was wrong (`true`). */
export class PdfPasswordError extends Error {
  readonly incorrect: boolean
  constructor(incorrect: boolean) {
    super(incorrect ? 'Incorrect PDF password' : 'PDF password required')
    this.name = 'PdfPasswordError'
    this.incorrect = incorrect
  }
}

/** Extract statement text from a PDF `File`, reconstructing lines for `parseStatement`. */
export async function extractPdfText(file: File, password?: string): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjsLib.getDocument({ data, password })

  try {
    const doc = await loadingTask.promise
    const lines: string[] = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const items: PositionedText[] = []
      for (const item of content.items) {
        if (!('str' in item)) continue // skip marked-content items (no text)
        items.push({ str: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0 })
      }
      lines.push(...reconstructLines(items))
    }
    return lines.join('\n')
  } catch (error) {
    if ((error as { name?: string }).name === 'PasswordException') {
      // pdf.js PasswordResponses: NEED_PASSWORD = 1, INCORRECT_PASSWORD = 2.
      throw new PdfPasswordError((error as { code?: number }).code === 2)
    }
    throw error
  } finally {
    // Destroys the loading task and its document, freeing the worker's memory.
    await loadingTask.destroy()
  }
}

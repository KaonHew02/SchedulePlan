/**
 * PDFs drawn by the app itself, one page at a time, as pictures.
 *
 * The browser's own viewer in a frame was the first answer, and it was not
 * one. On a desktop it was a 400px window onto an A4 page, with a toolbar in
 * it. On an iPhone it is worse: Safari draws the first page of a framed PDF
 * and nothing after it, and pinching zooms the whole app rather than the
 * page. A ticket you cannot read is not much of an attachment.
 *
 * So the pages are drawn here, with PDF.js, into pictures the app lays out
 * itself — at whatever size the screen and the zoom ask for, on every phone
 * the same. The library is a megabyte, so it is fetched the first time a PDF
 * is opened and not before.
 */

type Library = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

/**
 * The most pixels one page is drawn with. An A4 page at about 3000 × 4200.
 *
 * Safari on an iPhone refuses a canvas bigger than 16.7 million pixels and
 * takes the tab down when too many large ones are alive at once. Past this,
 * zooming further only enlarges the picture.
 */
const MAX_PIXELS = 12_000_000

let library: Promise<Library> | null = null

/*
 * The legacy build, as the holiday script uses: the modern one leans on
 * JavaScript newer than some iPhones still in use. The worker is one of this
 * site's own files, which is what the security policy in vite.config.ts
 * allows a worker to be.
 */
function load(): Promise<Library> {
  library ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(
    ([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    },
    (err: unknown) => {
      // Offline before the files were ever kept: let the next try fetch again.
      library = null
      throw err
    },
  )
  return library
}

export interface Pdf {
  pages: number
  /** Width over height for each page, so the layout is right before anything is drawn. */
  shapes: number[]
  /**
   * One page as a PNG about `width` pixels wide, or null if `wanted` said no
   * by the time its turn came.
   *
   * Pages are drawn one after another, not all at once: a phone asked to draw
   * five big pages together runs out of memory, not just time.
   */
  draw(page: number, width: number, wanted?: () => boolean): Promise<Blob | null>
  close(): void
}

export async function openPdf(blob: Blob): Promise<Pdf> {
  const pdfjs = await load()
  const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`
  const task = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    // Never compile a font into a function. The site's policy forbids it
    // anyway, and this is the setting that keeps a hostile PDF's fonts as
    // data rather than code.
    isEvalSupported: false,
    // A Chinese ticket often names its font rather than carrying it, and these
    // tables are how such a font's text is found. Fetched only by a PDF that
    // needs them, from where the OCR data already comes from.
    cMapUrl: `${cdn}/cmaps/`,
    cMapPacked: true,
    // No standardFontDataUrl, on purpose. Given one, PDF.js asks the browser
    // to load a font from it, which the site's policy refuses (font-src is
    // 'self'). Without it, Helvetica and Times come from the phone's own
    // fonts, which every phone has.
  })
  const doc = await task.promise

  const shapes: number[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const viewport = (await doc.getPage(n)).getViewport({ scale: 1 })
    shapes.push(viewport.width / viewport.height)
  }

  let closed = false
  let queue: Promise<unknown> = Promise.resolve()

  async function paint(page: number, width: number): Promise<Blob> {
    const proxy = await doc.getPage(page + 1)
    const natural = proxy.getViewport({ scale: 1 })
    let scale = width / natural.width
    const pixels = natural.width * natural.height * scale * scale
    if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels)
    const viewport = proxy.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    try {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No canvas')
      await proxy.render({ canvasContext: context, viewport, background: '#ffffff' }).promise
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('No picture'))), 'image/png'),
      )
    } finally {
      // Safari keeps a canvas's memory until it is shrunk to nothing, even
      // after nothing refers to it.
      canvas.width = 0
      canvas.height = 0
    }
  }

  return {
    pages: doc.numPages,
    shapes,
    draw(page, width, wanted) {
      const job = queue.then(() =>
        closed || (wanted && !wanted()) ? null : paint(page, Math.round(width)),
      )
      queue = job.catch(() => undefined)
      return job
    },
    close() {
      closed = true
      void task.destroy()
    },
  }
}

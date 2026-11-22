import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * pdf.js, loaded the first time a PDF is opened — not with the page: it is
 * a large library, and most visits never open one.
 *
 * The legacy build: it carries what older browsers lack, and the machines of
 * a university lab are not always the newest. Its worker is a file of this
 * origin, so the site's policy (`script-src 'self'`) lets it run.
 */
type PdfLib = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let lib: Promise<PdfLib> | null = null;

export function loadPdfLib(): Promise<PdfLib> {
  lib ??= Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ])
    .then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })
    .catch((e) => {
      lib = null; // a failed load (offline, an old cache) may succeed next time
      throw e;
    });
  return lib;
}

/**
 * Opens the bytes of a PDF. Its contents never run: no scripts, no forms
 * filled. `close` lets go of it, and of the worker reading it.
 */
export async function openPdf(bytes: ArrayBuffer): Promise<{ doc: PDFDocumentProxy; close: () => Promise<void> }> {
  const pdfjs = await loadPdfLib();
  // Served by this site (vite.config: pdfjsAssets). Absolute: the worker
  // that fetches them resolves a relative address against its own file.
  const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, location.href).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    enableXfa: false,
    // A font the PDF names but does not carry is drawn with pdf.js's own,
    // not with whatever the machine has: the same page on every computer,
    // and letters where they belong.
    useSystemFonts: false,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
  });
  try {
    return { doc: await task.promise, close: () => task.destroy() };
  } catch (e) {
    void task.destroy();
    throw e;
  }
}

/** A PDF that asks for a password: it cannot be shown here, only downloaded. */
export const isPasswordError = (e: unknown) => (e as { name?: string })?.name === "PasswordException";

export type { PDFDocumentProxy };

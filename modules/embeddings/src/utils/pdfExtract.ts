import { existsSync } from 'node:fs';
import path from 'node:path';
import { Worker, isMainThread } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

export interface PdfExtractLimits {
  maxPages: number;
  maxExtractedBytes: number;
  timeoutMs: number;
}

const ENCRYPT_MARKER = Buffer.from('/Encrypt');
const ENCRYPT_SCAN_WINDOW = 64 * 1024;

export function resolvePdfExtractWorkerPath(moduleUrl = import.meta.url): string {
  const candidates = [
    fileURLToPath(new URL('./pdfExtract.worker.js', moduleUrl)),
    path.join(path.dirname(fileURLToPath(moduleUrl)), 'pdfExtract.worker.js'),
    path.join(process.cwd(), 'bundle', 'pdfExtract.worker.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('PDF extraction worker is not available beside the production bundle');
}

export function pdfContainsEncryptMarker(bytes: Buffer): boolean {
  if (bytes.length <= ENCRYPT_SCAN_WINDOW * 2) {
    return bytes.includes(ENCRYPT_MARKER);
  }
  const head = bytes.subarray(0, ENCRYPT_SCAN_WINDOW);
  const tail = bytes.subarray(bytes.length - ENCRYPT_SCAN_WINDOW);
  return head.includes(ENCRYPT_MARKER) || tail.includes(ENCRYPT_MARKER);
}

export function assertSafePdfEnvelope(bytes: Buffer): void {
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error('PDF magic bytes are missing');
  }
  if (pdfContainsEncryptMarker(bytes)) {
    throw new Error('Encrypted PDFs are not supported');
  }
  if (bytes.length < 8) {
    throw new Error('PDF payload is malformed');
  }
}

export async function extractPdfText(
  bytes: Buffer,
  limits: PdfExtractLimits,
): Promise<string> {
  assertSafePdfEnvelope(bytes);
  if (!isMainThread) {
    return extractPdfTextInProcess(bytes, limits);
  }
  return extractPdfTextInWorker(bytes, limits);
}

async function extractPdfTextInWorker(
  bytes: Buffer,
  limits: PdfExtractLimits,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(resolvePdfExtractWorkerPath(), {
      workerData: { bytes: Uint8Array.from(bytes), limits },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error(`PDF extraction timed out after ${limits.timeoutMs}ms`));
    }, limits.timeoutMs);
    worker.once('message', message => {
      clearTimeout(timer);
      void worker.terminate();
      if (message?.ok && typeof message.text === 'string') resolve(message.text);
      else reject(new Error(message?.error ?? 'PDF extraction failed'));
    });
    worker.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function extractPdfTextInProcess(
  bytes: Buffer,
  limits: PdfExtractLimits,
): Promise<string> {
  assertSafePdfEnvelope(bytes);
  if (limits.maxPages < 1) {
    throw new Error(`PDF exceeds the ${limits.maxPages} page limit`);
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    isOffscreenCanvasSupported: false,
    useWasm: false,
    verbosity: 0,
  }).promise;
  try {
    if (document.numPages > limits.maxPages) {
      throw new Error(`PDF exceeds the ${limits.maxPages} page limit`);
    }
    const pages: string[] = [];
    let extracted = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      extracted += Buffer.byteLength(text, 'utf8');
      if (extracted > limits.maxExtractedBytes) {
        throw new Error(
          `Extracted text exceeds the ${limits.maxExtractedBytes} byte limit`,
        );
      }
      if (text) pages.push(text);
    }
    return pages.join('\n\n');
  } finally {
    const loaded = document as {
      destroy?: () => Promise<void>;
      cleanup?: () => Promise<void>;
    };
    await loaded.destroy?.();
    await loaded.cleanup?.();
  }
}

import { parentPort, workerData } from 'node:worker_threads';
import { extractPdfTextInProcess } from './pdfExtract.js';

const bytes = Buffer.from(workerData.bytes);
extractPdfTextInProcess(bytes, workerData.limits)
  .then(text => parentPort?.postMessage({ ok: true, text }))
  .catch(error =>
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'PDF extraction failed',
    }),
  );

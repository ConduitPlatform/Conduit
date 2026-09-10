import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafePdfEnvelope,
  extractPdfText,
  extractPdfTextInProcess,
  pdfContainsEncryptMarker,
  resolvePdfExtractWorkerPath,
} from './pdfExtract.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PDF_HEAD = Buffer.from('%PDF-1.4\n');
const ENCRYPTED = Buffer.concat([
  PDF_HEAD,
  Buffer.from('/Encrypt 2 0 R\ntrailer<<>>\n%%EOF'),
]);
const MALFORMED = Buffer.from('%PDF-');

describe('bounded PDF extraction', () => {
  it('rejects missing magic, encrypted envelopes, and truncated payloads', () => {
    assert.throws(() => assertSafePdfEnvelope(Buffer.from('not-a-pdf')));
    assert.throws(() => assertSafePdfEnvelope(ENCRYPTED), /Encrypted/);
    assert.throws(() => assertSafePdfEnvelope(MALFORMED), /malformed/);
    const trailerOnly = Buffer.concat([
      PDF_HEAD,
      Buffer.alloc(70 * 1024, 0x20),
      Buffer.from('\ntrailer<< /Size 4 /Encrypt 2 0 R >>\nstartxref\n0\n%%EOF\n'),
    ]);
    assert.equal(pdfContainsEncryptMarker(trailerOnly.subarray(0, 64 * 1024)), false);
    assert.throws(() => assertSafePdfEnvelope(trailerOnly), /Encrypted/);
    const workerPath = resolvePdfExtractWorkerPath(import.meta.url);
    assert.equal(existsSync(workerPath), true);
    assert.equal(workerPath.endsWith('pdfExtract.worker.js'), true);
    assert.equal(
      fileURLToPath(new URL('./pdfExtract.worker.js', import.meta.url)),
      workerPath,
    );
  });

  it('rejects page and timeout guards before unbounded parse work', async () => {
    const body = Buffer.concat([PDF_HEAD, Buffer.from('1 0 obj<<>>endobj\n%%EOF')]);
    await assert.rejects(
      () =>
        extractPdfTextInProcess(body, {
          maxPages: 0,
          maxExtractedBytes: 1024,
          timeoutMs: 15_000,
        }),
      /page limit/,
    );
    await assert.rejects(
      () =>
        extractPdfText(body, {
          maxPages: 50,
          maxExtractedBytes: 1024,
          timeoutMs: 0,
        }),
      /timed out|PDF/,
    );
  });
});

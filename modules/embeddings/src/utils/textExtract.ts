import { decodeUtf8 } from './mimeSniff.js';

export function extractUtf8Text(bytes: Buffer, maxExtractedBytes: number): string {
  const text = decodeUtf8(bytes);
  const encoded = Buffer.from(text, 'utf8');
  if (encoded.length > maxExtractedBytes) {
    throw new Error(`Extracted text exceeds the ${maxExtractedBytes} byte limit`);
  }
  return text.replace(/^\uFEFF/, '');
}

export function extractJsonText(bytes: Buffer, maxExtractedBytes: number): string {
  const text = extractUtf8Text(bytes, maxExtractedBytes);
  JSON.parse(text);
  return text;
}

export function extractCsvText(bytes: Buffer, maxExtractedBytes: number): string {
  return extractUtf8Text(bytes, maxExtractedBytes);
}

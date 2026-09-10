import { AUTOMATIC_STORAGE_MIME_TYPES } from './storageSelectors.js';

const ARCHIVE_MAGICS = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x1f, 0x8b]),
  Buffer.from('Rar!\x1a\x07'),
  Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
];

const OFFICE_MAGICS = [Buffer.from([0xd0, 0xcf, 0x11, 0xe0])];

export type SniffedMime =
  | (typeof AUTOMATIC_STORAGE_MIME_TYPES)[number]
  | 'application/zip'
  | 'application/octet-stream';

export function sniffMimeType(bytes: Buffer): SniffedMime {
  if (hasPrefix(bytes, Buffer.from('%PDF-'))) return 'application/pdf';
  if (ARCHIVE_MAGICS.some(magic => hasPrefix(bytes, magic))) return 'application/zip';
  if (OFFICE_MAGICS.some(magic => hasPrefix(bytes, magic)))
    return 'application/octet-stream';
  if (looksLikeJson(bytes)) return 'application/json';
  if (looksLikeCsv(bytes)) return 'text/csv';
  if (looksLikeMarkdown(bytes)) return 'text/markdown';
  if (looksLikeUtf8Text(bytes)) return 'text/plain';
  return 'application/octet-stream';
}

export function assertAutomaticExtractable(args: {
  declaredMime?: string;
  sniffed: SniffedMime;
}): (typeof AUTOMATIC_STORAGE_MIME_TYPES)[number] {
  const declared = (args.declaredMime ?? '').toLowerCase();
  if (!isAutomaticStorageMime(args.sniffed)) {
    throw new Error(`Unsupported or binary payload (${args.sniffed})`);
  }
  if (declared && isAutomaticStorageMime(declared) && declared !== args.sniffed) {
    if (!compatibleTextMismatch(declared, args.sniffed)) {
      throw new Error(`Declared MIME ${declared} does not match sniffed ${args.sniffed}`);
    }
  }
  return args.sniffed;
}

function isAutomaticStorageMime(
  mime: string,
): mime is (typeof AUTOMATIC_STORAGE_MIME_TYPES)[number] {
  return (AUTOMATIC_STORAGE_MIME_TYPES as readonly string[]).includes(mime);
}

function compatibleTextMismatch(declared: string, sniffed: SniffedMime): boolean {
  const texty = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);
  return texty.has(declared) && texty.has(sniffed);
}

function hasPrefix(bytes: Buffer, magic: Buffer): boolean {
  return bytes.subarray(0, magic.length).equals(magic);
}

function looksLikeUtf8Text(bytes: Buffer): boolean {
  if (!bytes.length) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

function looksLikeJson(bytes: Buffer): boolean {
  if (!looksLikeUtf8Text(bytes)) return false;
  const text = decodeUtf8(bytes).trim();
  return (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  );
}

function looksLikeCsv(bytes: Buffer): boolean {
  if (!looksLikeUtf8Text(bytes)) return false;
  const text = decodeUtf8(bytes);
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 5);
  if (lines.length < 2) return false;
  const commas = lines.map(line => line.split(',').length);
  return commas.every(count => count > 1 && count === commas[0]);
}

function looksLikeMarkdown(bytes: Buffer): boolean {
  if (!looksLikeUtf8Text(bytes)) return false;
  return /^#{1,6}\s|^\*\s|^-\s|^\[[^\]]+\]\(/m.test(decodeUtf8(bytes));
}

export function decodeUtf8(bytes: Buffer): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

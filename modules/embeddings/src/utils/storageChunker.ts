import { createHash } from 'node:crypto';

export interface StorageChunk {
  chunkKey: string;
  ordinal: number;
  text: string;
  metadata: {
    locator: string;
    start: number;
    end: number;
  };
}

export interface StorageChunkerLimits {
  maxChunkBytes: number;
  maxChunksPerFile: number;
  overlapBytes: number;
}

const PAGE = /\n{2,}/;
const PARAGRAPH = /\n/;
const SENTENCE = /(?<=[.!?])\s+/;

export function chunkExtractedText(
  text: string,
  limits: StorageChunkerLimits,
  locatorPrefix = 'text',
): StorageChunk[] {
  if (!text.trim()) return [];
  const overlap = Math.max(0, Math.min(limits.overlapBytes, limits.maxChunkBytes - 1));
  const windows = splitToWindows(text, limits.maxChunkBytes, overlap);
  if (windows.length > limits.maxChunksPerFile) {
    throw new Error(`File exceeds the ${limits.maxChunksPerFile} chunk limit`);
  }
  return windows.map((window, ordinal) => ({
    chunkKey: chunkKeyFor(locatorPrefix, ordinal, window.text),
    ordinal,
    text: window.text,
    metadata: {
      locator: `${locatorPrefix}:${ordinal}:${window.start}-${window.end}`,
      start: window.start,
      end: window.end,
    },
  }));
}

function splitToWindows(
  text: string,
  maxChunkBytes: number,
  overlapBytes: number,
): Array<{ text: string; start: number; end: number }> {
  const units = splitPreferringBoundaries(text);
  const windows: Array<{ text: string; start: number; end: number }> = [];
  let current = '';
  let start = 0;
  let cursor = 0;
  const flush = () => {
    if (!current) return;
    windows.push({ text: current, start, end: start + current.length });
    if (overlapBytes > 0 && byteLength(current) > overlapBytes) {
      current = tailByBytes(current, overlapBytes);
      start = windows[windows.length - 1].end - current.length;
    } else {
      current = '';
      start = cursor;
    }
  };
  for (const unit of units) {
    if (byteLength(unit) > maxChunkBytes) {
      flush();
      for (const piece of hardSplit(unit, maxChunkBytes)) {
        windows.push({
          text: piece,
          start: cursor,
          end: cursor + piece.length,
        });
        cursor += piece.length;
      }
      current = '';
      start = cursor;
      continue;
    }
    if (current && byteLength(current + unit) > maxChunkBytes) {
      flush();
    }
    if (!current) start = cursor;
    current += unit;
    cursor += unit.length;
  }
  flush();
  return windows;
}

function splitPreferringBoundaries(text: string): string[] {
  return text
    .split(PAGE)
    .flatMap(page => page.split(PARAGRAPH))
    .flatMap(paragraph => paragraph.split(SENTENCE))
    .map(part => part.trim())
    .filter(Boolean)
    .map((part, index, all) => (index < all.length - 1 ? `${part}\n` : part));
}

function hardSplit(text: string, maxChunkBytes: number): string[] {
  const parts: string[] = [];
  let remaining = text;
  while (remaining) {
    let take = remaining.length;
    while (take > 1 && byteLength(remaining.slice(0, take)) > maxChunkBytes) {
      take -= 1;
    }
    parts.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
  }
  return parts;
}

function tailByBytes(text: string, maxBytes: number): string {
  let start = text.length;
  while (start > 0 && byteLength(text.slice(start)) < maxBytes) {
    start -= 1;
  }
  return text.slice(start);
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function chunkKeyFor(prefix: string, ordinal: number, text: string): string {
  const digest = createHash('sha256')
    .update(`${prefix}\n${ordinal}\n${text}`)
    .digest('hex');
  return `c${ordinal}-${digest.slice(0, 16)}`;
}

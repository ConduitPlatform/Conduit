import fs from 'fs';
import os from 'os';
import path from 'path';
import winston from 'winston';

const DEFAULT_LOG_FILE_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_LOG_FILE_MAX_FILES = 5;

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return fallback;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) return fallback;
  return value;
}

function formatMeta(meta: unknown): string {
  if (Array.isArray(meta)) {
    if (meta.length === 0) return '';
    return meta.map(item => JSON.stringify(item)).join(' ');
  }
  if (meta !== null && typeof meta === 'object') {
    if (Object.keys(meta).length === 0) return '';
    return JSON.stringify(meta);
  }
  return '';
}

function createFileFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.printf(info => {
      const metaText = formatMeta(info.meta);
      const line = `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}`;
      if (info.stack) {
        return `${line} ${info.stack}`;
      }
      return metaText ? `${line} ${metaText}` : line;
    }),
  );
}

export function createFileLogTransports(): winston.transport[] {
  if (process.env.LOG_TO_FILE !== 'true') {
    return [];
  }

  const logDir =
    process.env.LOG_FILE_DIR?.trim() || path.join(os.tmpdir(), 'conduit-logs');
  fs.mkdirSync(logDir, { recursive: true });

  const maxsize = positiveIntFromEnv(
    process.env.LOG_FILE_MAX_SIZE,
    DEFAULT_LOG_FILE_MAX_BYTES,
  );
  const maxFiles = positiveIntFromEnv(
    process.env.LOG_FILE_MAX_FILES,
    DEFAULT_LOG_FILE_MAX_FILES,
  );

  return [
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'info',
      maxsize,
      maxFiles,
      tailable: true,
      format: createFileFormat(),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'errors.log'),
      level: 'error',
      maxsize,
      maxFiles,
      tailable: true,
      format: createFileFormat(),
    }),
  ];
}

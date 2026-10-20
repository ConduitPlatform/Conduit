import fs from 'fs';
import os from 'os';
import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const DEFAULT_RETENTION_DAYS = 3;
const DEFAULT_MAX_SIZE = '20m';
const SIZE_STRING = /^(?:0\.)?\d+[kmg]$/i;

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return fallback;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) return fallback;
  return value;
}

function logFileMaxSize(): string | number {
  const raw = process.env.LOG_FILE_MAX_SIZE?.trim();
  if (!raw) return DEFAULT_MAX_SIZE;
  if (SIZE_STRING.test(raw)) return raw.toLowerCase();
  if (/^[0-9]+$/.test(raw)) {
    const bytes = Number(raw);
    if (Number.isSafeInteger(bytes) && bytes > 0) return bytes;
  }
  return DEFAULT_MAX_SIZE;
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

function rotateTransport(
  logDir: string,
  name: 'combined' | 'errors',
  level: string,
): DailyRotateFile {
  return new DailyRotateFile({
    dirname: logDir,
    filename: `${name}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    level,
    maxFiles: `${positiveIntFromEnv(process.env.LOG_RETENTION_DAYS, DEFAULT_RETENTION_DAYS)}d`,
    maxSize: logFileMaxSize(),
    zippedArchive: false,
    auditFile: path.join(logDir, `.${name}-audit.json`),
    format: createFileFormat(),
  });
}

export function createFileLogTransports(): winston.transport[] {
  if (process.env.LOG_TO_FILE?.trim() === 'false') {
    return [];
  }

  const logDir =
    process.env.LOG_FILE_DIR?.trim() || path.join(os.tmpdir(), 'conduit-logs');
  fs.mkdirSync(logDir, { recursive: true });

  return [
    rotateTransport(logDir, 'combined', 'info'),
    rotateTransport(logDir, 'errors', 'error'),
  ];
}

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import winston from 'winston';
import { createFileLogTransports } from './fileTransports.ts';

const ENV_KEYS = [
  'LOG_TO_FILE',
  'LOG_FILE_DIR',
  'LOG_FILE_MAX_SIZE',
  'LOG_FILE_MAX_FILES',
] as const;

type FileTransportState = winston.transport & {
  filename?: string;
  dirname?: string;
  maxsize?: number | null;
  maxFiles?: number | null;
  tailable?: boolean;
  level?: string;
};

const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
const tempDirs: string[] = [];

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function makeLogDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-file-logs-'));
  tempDirs.push(dir);
  return dir;
}

function asFileTransport(transport: winston.transport): FileTransportState {
  return transport as FileTransportState;
}

async function closeTransports(transports: winston.transport[]): Promise<void> {
  await Promise.all(
    transports.map(
      transport =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('timed out closing log transport')),
            2000,
          );
          transport.once('finish', () => {
            clearTimeout(timeout);
            resolve();
          });
          transport.once('error', err => {
            clearTimeout(timeout);
            reject(err);
          });
          transport.end();
        }),
    ),
  );
}

async function endLogger(logger: winston.Logger): Promise<void> {
  if (logger.writableEnded) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out closing logger')), 2000);
    logger.once('finish', () => {
      clearTimeout(timeout);
      resolve();
    });
    logger.once('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
    logger.end();
  });
}

afterEach(async () => {
  restoreEnv();
  await Promise.all(
    tempDirs.splice(0).map(async dir => {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe('file log transports', { concurrency: 1 }, () => {
  it('does not create file transports unless LOG_TO_FILE=true', () => {
    delete process.env.LOG_TO_FILE;
    assert.deepEqual(createFileLogTransports(), []);

    process.env.LOG_TO_FILE = 'false';
    assert.deepEqual(createFileLogTransports(), []);

    process.env.LOG_TO_FILE = 'TRUE';
    assert.deepEqual(createFileLogTransports(), []);

    process.env.LOG_TO_FILE = '1';
    assert.deepEqual(createFileLogTransports(), []);
  });

  it('writes rotated files under LOG_FILE_DIR with single-line meta', async () => {
    const logDir = makeLogDir();
    const nestedDir = path.join(logDir, 'nested');
    process.env.LOG_TO_FILE = 'true';
    process.env.LOG_FILE_DIR = nestedDir;
    process.env.LOG_FILE_MAX_SIZE = '4096';
    process.env.LOG_FILE_MAX_FILES = '3';

    const transports = createFileLogTransports();
    let closed = false;
    try {
      assert.equal(fs.existsSync(nestedDir), true);
      assert.equal(transports.length, 2);

      const combined = asFileTransport(transports[0]);
      const errors = asFileTransport(transports[1]);
      assert.equal(combined.dirname, nestedDir);
      assert.equal(combined.filename, 'combined.log');
      assert.equal(combined.level, 'info');
      assert.equal(combined.maxsize, 4096);
      assert.equal(combined.maxFiles, 3);
      assert.equal(combined.tailable, true);
      assert.equal(errors.dirname, nestedDir);
      assert.equal(errors.filename, 'errors.log');
      assert.equal(errors.level, 'error');
      assert.equal(errors.maxsize, 4096);
      assert.equal(errors.maxFiles, 3);
      assert.equal(errors.tailable, true);
      assert.equal(combined.dirname?.includes(`${path.sep}.logs`), false);

      const logger = winston.createLogger({
        format: winston.format.printf(info => {
          const pretty = info.meta ? JSON.stringify(info.meta, null, 2) : '';
          return `PRETTY ${info.message}\n${pretty}`;
        }),
        transports,
      });

      logger.log({
        level: 'info',
        message: 'hello',
        meta: { id: 'abc', nested: { n: 1 } },
      });
      logger.log({
        level: 'error',
        message: 'boom',
        meta: [{ code: 7 }, { ok: false }],
      });
      await endLogger(logger);
      closed = true;

      const combinedText = fs.readFileSync(path.join(nestedDir, 'combined.log'), 'utf8');
      const errorText = fs.readFileSync(path.join(nestedDir, 'errors.log'), 'utf8');
      const combinedLines = combinedText.trim().split('\n');
      assert.equal(combinedLines.length, 2);
      assert.match(
        combinedLines[0],
        /\[INFO\]: hello \{"id":"abc","nested":\{"n":1\}\}$/,
      );
      assert.match(combinedLines[1], /\[ERROR\]: boom \{"code":7\} \{"ok":false\}$/);
      assert.equal(combinedText.includes('PRETTY'), false);
      assert.equal(combinedText.includes('\n  '), false);
      assert.match(errorText.trim(), /\[ERROR\]: boom \{"code":7\} \{"ok":false\}$/);
      assert.equal(errorText.includes('hello'), false);
    } finally {
      if (!closed) await closeTransports(transports);
    }
  });

  it('defaults the directory, size, and file count', async () => {
    delete process.env.LOG_FILE_DIR;
    process.env.LOG_TO_FILE = 'true';
    process.env.LOG_FILE_MAX_SIZE = 'nope';
    process.env.LOG_FILE_MAX_FILES = '0';

    const transports = createFileLogTransports();
    try {
      const combined = asFileTransport(transports[0]);
      assert.equal(combined.dirname, path.join(os.tmpdir(), 'conduit-logs'));
      assert.equal(combined.maxsize, 10 * 1024 * 1024);
      assert.equal(combined.maxFiles, 5);
      assert.equal(combined.tailable, true);
      assert.equal(fs.existsSync(path.join(os.tmpdir(), 'conduit-logs')), true);
    } finally {
      await closeTransports(transports);
    }
  });
});

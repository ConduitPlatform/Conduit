import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import winston from 'winston';
import { createFileLogTransports } from './fileTransports.ts';

const ENV_KEYS = [
  'LOG_TO_FILE',
  'LOG_FILE_DIR',
  'LOG_FILE_MAX_SIZE',
  'LOG_RETENTION_DAYS',
] as const;

type RotateState = winston.transport & {
  filename?: string;
  dirname?: string;
  level?: string;
  logStream?: NodeJS.WritableStream;
  options?: {
    maxFiles?: string | number;
    maxSize?: string | number;
    zippedArchive?: boolean;
    datePattern?: string;
    auditFile?: string;
  };
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

function asRotate(transport: winston.transport): RotateState {
  return transport as RotateState;
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
          const done = () => {
            clearTimeout(timeout);
            resolve();
          };
          const stream = asRotate(transport).logStream;
          if (stream) {
            stream.once('error', err => {
              clearTimeout(timeout);
              reject(err);
            });
            stream.end(done);
            return;
          }
          transport.once('finish', done);
          transport.once('error', err => {
            clearTimeout(timeout);
            reject(err);
          });
          transport.end();
        }),
    ),
  );
}

function datedLog(dir: string, prefix: string): string {
  const name = fs
    .readdirSync(dir)
    .find(entry => new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.log$`).test(entry));
  assert.ok(name, `expected a ${prefix} dated log in ${dir}`);
  return path.join(dir, name!);
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
  it('writes rolling files unless LOG_TO_FILE=false', async () => {
    delete process.env.LOG_TO_FILE;
    delete process.env.LOG_FILE_DIR;
    const enabled = createFileLogTransports();
    try {
      assert.equal(enabled.length, 2);
    } finally {
      await closeTransports(enabled);
    }

    for (const value of ['true', 'TRUE', '1', 'yes']) {
      process.env.LOG_TO_FILE = value;
      process.env.LOG_FILE_DIR = makeLogDir();
      const transports = createFileLogTransports();
      try {
        assert.equal(transports.length, 2, value);
      } finally {
        await closeTransports(transports);
      }
    }

    process.env.LOG_TO_FILE = 'false';
    assert.deepEqual(createFileLogTransports(), []);
  });

  it('writes one file per day with single-line meta', async () => {
    const logDir = makeLogDir();
    const nestedDir = path.join(logDir, 'nested');
    delete process.env.LOG_TO_FILE;
    process.env.LOG_FILE_DIR = nestedDir;
    process.env.LOG_FILE_MAX_SIZE = '1m';
    process.env.LOG_RETENTION_DAYS = '3';

    const transports = createFileLogTransports();
    let closed = false;
    try {
      assert.equal(fs.existsSync(nestedDir), true);
      const combined = asRotate(transports[0]);
      const errors = asRotate(transports[1]);
      assert.equal(combined.dirname, nestedDir);
      assert.equal(combined.filename, 'combined-%DATE%.log');
      assert.equal(combined.level, 'info');
      assert.equal(combined.options?.datePattern, 'YYYY-MM-DD');
      assert.equal(combined.options?.maxFiles, '3d');
      assert.equal(combined.options?.maxSize, '1m');
      assert.equal(combined.options?.zippedArchive, false);
      assert.equal(
        combined.options?.auditFile,
        path.join(nestedDir, '.combined-audit.json'),
      );
      assert.equal(errors.filename, 'errors-%DATE%.log');
      assert.equal(errors.level, 'error');
      assert.equal(errors.options?.auditFile, path.join(nestedDir, '.errors-audit.json'));
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
      await closeTransports(transports);
      closed = true;

      const combinedText = fs.readFileSync(datedLog(nestedDir, 'combined'), 'utf8');
      const errorText = fs.readFileSync(datedLog(nestedDir, 'errors'), 'utf8');
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
      assert.equal(fs.existsSync(path.join(nestedDir, '.combined-audit.json')), true);
      assert.equal(fs.existsSync(path.join(nestedDir, '.errors-audit.json')), true);
    } finally {
      if (!closed) await closeTransports(transports);
    }
  });

  it('deletes files older than the retention recorded in the log dir audit', async () => {
    const logDir = makeLogDir();
    const oldName = path.join(logDir, 'combined-2000-01-01.log');
    const oldDate = Date.now() - 10 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(oldName, 'stale\n');
    const auditFile = path.join(logDir, '.combined-audit.json');
    fs.writeFileSync(
      auditFile,
      JSON.stringify({
        keep: { days: true, amount: 3 },
        auditLog: auditFile,
        files: [
          {
            date: oldDate,
            name: oldName,
            hash: crypto
              .createHash('sha256')
              .update(oldName + 'LOG_FILE' + oldDate)
              .digest('hex'),
          },
        ],
      }),
    );

    delete process.env.LOG_TO_FILE;
    process.env.LOG_FILE_DIR = logDir;
    process.env.LOG_RETENTION_DAYS = '3';
    const transports = createFileLogTransports();
    try {
      assert.equal(fs.existsSync(oldName), false);
      const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8')) as {
        files: { name: string }[];
      };
      assert.equal(
        audit.files.some(file => file.name === oldName),
        false,
      );
      assert.equal(path.dirname(auditFile), logDir);
    } finally {
      await closeTransports(transports);
    }
  });

  it('defaults the directory, retention, and size cap', async () => {
    delete process.env.LOG_FILE_DIR;
    delete process.env.LOG_TO_FILE;
    process.env.LOG_FILE_MAX_SIZE = 'nope';
    process.env.LOG_RETENTION_DAYS = '0';
    process.env.LOG_FILE_MAX_FILES = '1';

    const transports = createFileLogTransports();
    try {
      const combined = asRotate(transports[0]);
      assert.equal(combined.dirname, path.join(os.tmpdir(), 'conduit-logs'));
      assert.equal(combined.options?.maxFiles, '3d');
      assert.equal(combined.options?.maxSize, '20m');
      assert.equal(combined.options?.zippedArchive, false);
      assert.equal(
        combined.options?.auditFile,
        path.join(os.tmpdir(), 'conduit-logs', '.combined-audit.json'),
      );
    } finally {
      delete process.env.LOG_FILE_MAX_FILES;
      await closeTransports(transports);
    }

    process.env.LOG_FILE_DIR = makeLogDir();
    process.env.LOG_RETENTION_DAYS = '10';
    process.env.LOG_FILE_MAX_SIZE = '4096';
    const byteSized = createFileLogTransports();
    try {
      const combined = asRotate(byteSized[0]);
      assert.equal(combined.options?.maxFiles, '10d');
      assert.equal(combined.options?.maxSize, 4096);
    } finally {
      await closeTransports(byteSized);
    }

    process.env.LOG_FILE_MAX_SIZE = '5m';
    const sized = createFileLogTransports();
    try {
      assert.equal(asRotate(sized[0]).options?.maxSize, '5m');
    } finally {
      await closeTransports(sized);
    }
  });
});

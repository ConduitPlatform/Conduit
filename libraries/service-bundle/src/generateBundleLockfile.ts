import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface GenerateBundleLockfileOptions {
  serviceRoot?: string;
}

export function generateBundleLockfile(
  options: GenerateBundleLockfileOptions = {},
): string {
  const serviceRoot = path.resolve(options.serviceRoot ?? process.cwd());
  const manifestPath = path.join(serviceRoot, 'package.bundle.json');
  const lockPath = path.join(serviceRoot, 'package.bundle-lock.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing ${manifestPath}. Run generate-manifest before generate-lockfile.`,
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-bundle-lock-'));
  try {
    fs.copyFileSync(manifestPath, path.join(tmpDir, 'package.json'));
    execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
      cwd: tmpDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    fs.copyFileSync(path.join(tmpDir, 'package-lock.json'), lockPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return lockPath;
}

import fs from 'node:fs';
import path from 'node:path';
import { loadServiceBundleConfig } from './generateBundleManifest.js';
import { findWorkspaceRoot, moduleToolsProtoDir } from './paths.js';

export interface CopyBundleAssetsOptions {
  serviceRoot?: string;
}

const MODULE_PROTOS = ['module.proto', 'grpc_health_check.proto'] as const;

function copyFileFlat(src: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, path.basename(src)));
}

function copyMatchingFlat(srcDir: string, destDir: string, ext: string): void {
  if (!fs.existsSync(srcDir)) {
    return;
  }
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const full = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      copyMatchingFlat(full, destDir, ext);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      copyFileFlat(full, destDir);
    }
  }
}

export function copyBundleAssets(options: CopyBundleAssetsOptions = {}): void {
  const serviceRoot = path.resolve(options.serviceRoot ?? process.cwd());
  const bundleDir = path.join(serviceRoot, 'bundle');
  const srcDir = path.join(serviceRoot, 'src');
  const workspaceRoot = findWorkspaceRoot(serviceRoot);
  const moduleProtosDir = moduleToolsProtoDir(workspaceRoot);

  fs.mkdirSync(bundleDir, { recursive: true });

  copyMatchingFlat(srcDir, bundleDir, '.proto');
  copyMatchingFlat(srcDir, bundleDir, '.json');

  for (const proto of MODULE_PROTOS) {
    const src = path.join(moduleProtosDir, proto);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing shared proto: ${src}`);
    }
    copyFileFlat(src, bundleDir);
  }

  const config = loadServiceBundleConfig(serviceRoot);
  for (const asset of config.extraAssets ?? []) {
    const src = path.join(serviceRoot, asset.from);
    if (!fs.existsSync(src)) {
      continue;
    }
    const dest = path.join(bundleDir, asset.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

export { MODULE_PROTOS };

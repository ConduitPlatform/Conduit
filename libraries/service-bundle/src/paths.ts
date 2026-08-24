import fs from 'node:fs';
import path from 'node:path';

export function findWorkspaceRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find workspace root from ${startDir}`);
    }
    dir = parent;
  }
}

export function moduleToolsProtoDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'libraries/module-tools/src');
}

export function grpcSdkPackageJsonPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'libraries/grpc-sdk/package.json');
}

export function moduleToolsPackageJsonPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'libraries/module-tools/package.json');
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

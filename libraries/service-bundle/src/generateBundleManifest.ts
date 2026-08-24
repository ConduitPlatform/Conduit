import fs from 'node:fs';
import path from 'node:path';
import { SHARED_BUNDLE_EXTERNALS } from './externals.js';
import {
  findWorkspaceRoot,
  grpcSdkPackageJsonPath,
  moduleToolsPackageJsonPath,
  readJsonFile,
} from './paths.js';

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  engines?: Record<string, string>;
  conduit?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export interface ServiceBundleAssetCopy {
  from: string;
  to: string;
}

export interface ServiceBundleConfig {
  /** Extra npm packages kept external (must match extraExternal in tsup.config.ts). */
  extraDependencies?: string[];
  /** Non-proto/json assets copied into bundle/ beside index.js. */
  extraAssets?: ServiceBundleAssetCopy[];
  /** Additional package.json paths (relative to service root) for dependency version resolution. */
  dependencySources?: string[];
}

export interface GenerateBundleManifestOptions {
  serviceRoot?: string;
  extraDependencies?: string[];
}

export function loadServiceBundleConfig(serviceRoot: string): ServiceBundleConfig {
  const configPath = path.join(serviceRoot, 'service-bundle.config.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }
  return readJsonFile<ServiceBundleConfig>(configPath);
}

function readPackageJson(serviceRoot: string): PackageJson {
  return readJsonFile<PackageJson>(path.join(serviceRoot, 'package.json'));
}

function resolveFromPnpmLock(
  lockContent: string,
  packageName: string,
): string | undefined {
  const lines = lockContent.split('\n');
  const candidates: string[] = [];

  for (const line of lines) {
    const exact = line.match(
      new RegExp(`^  ${escapeRegExp(packageName)}@(\\d+\\.\\d+\\.\\d+):`),
    );
    if (exact) {
      return exact[1];
    }

    const match = line.match(new RegExp(`^  ${escapeRegExp(packageName)}@([^:]+):`));
    if (match) {
      candidates.push(match[1].split('(')[0]);
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  return [...new Set(candidates)].sort().at(-1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveDependencyVersion(
  packageName: string,
  servicePkg: PackageJson,
  grpcSdkPkg: PackageJson,
  moduleToolsPkg: PackageJson,
  extraSourcePkgs: PackageJson[],
  lockContent: string,
): string {
  const declared =
    servicePkg.dependencies?.[packageName] ??
    servicePkg.devDependencies?.[packageName] ??
    grpcSdkPkg.dependencies?.[packageName] ??
    moduleToolsPkg.dependencies?.[packageName] ??
    extraSourcePkgs
      .map(pkg => pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName])
      .find(Boolean);

  if (declared && !declared.startsWith('workspace:')) {
    return declared;
  }

  const fromLock = resolveFromPnpmLock(lockContent, packageName);
  if (fromLock) {
    return fromLock;
  }

  throw new Error(
    `Cannot resolve bundle dependency version for "${packageName}". ` +
      'Add it to the service or grpc-sdk package.json, or ensure it exists in pnpm-lock.yaml.',
  );
}

export function generateBundleManifest(
  options: GenerateBundleManifestOptions = {},
): string {
  const serviceRoot = path.resolve(options.serviceRoot ?? process.cwd());
  const workspaceRoot = findWorkspaceRoot(serviceRoot);
  const servicePkg = readPackageJson(serviceRoot);
  const grpcSdkPkg = readJsonFile<PackageJson>(grpcSdkPackageJsonPath(workspaceRoot));
  const moduleToolsPkg = readJsonFile<PackageJson>(
    moduleToolsPackageJsonPath(workspaceRoot),
  );
  const lockContent = fs.readFileSync(path.join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');

  const fileConfig = loadServiceBundleConfig(serviceRoot);
  const extraSourcePkgs = (fileConfig.dependencySources ?? []).map(relPath =>
    readPackageJson(path.resolve(serviceRoot, relPath)),
  );
  const externalNames = [
    ...SHARED_BUNDLE_EXTERNALS,
    ...(fileConfig.extraDependencies ?? []),
    ...(options.extraDependencies ?? []),
  ];

  const dependencies: Record<string, string> = {};
  for (const name of externalNames) {
    dependencies[name] = resolveDependencyVersion(
      name,
      servicePkg,
      grpcSdkPkg,
      moduleToolsPkg,
      extraSourcePkgs,
      lockContent,
    );
  }

  const manifest = {
    name: servicePkg.name,
    version: servicePkg.version ?? '1.0.0',
    private: true,
    type: 'module',
    main: 'bundle/index.js',
    engines: servicePkg.engines ?? { node: '>=24' },
    ...(servicePkg.conduit ? { conduit: servicePkg.conduit } : {}),
    dependencies,
  };

  const outPath = path.join(serviceRoot, 'package.bundle.json');
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return outPath;
}

export function listBundleExternals(extraDependencies: string[] = []): string[] {
  return [...SHARED_BUNDLE_EXTERNALS, ...extraDependencies];
}

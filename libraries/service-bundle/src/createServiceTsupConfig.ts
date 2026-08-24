import type { Options } from 'tsup';
import { SHARED_BUNDLE_EXTERNALS } from './externals.js';

export interface CreateServiceTsupConfigOptions {
  extraExternal?: string[];
  entry?: Options['entry'];
}

/**
 * Default tsup config for Conduit service bundles.
 * Inlines @conduitplatform workspace packages; npm deps stay external.
 */
export function createServiceTsupConfig(
  options: CreateServiceTsupConfigOptions = {},
): Options {
  const external = [...SHARED_BUNDLE_EXTERNALS, ...(options.extraExternal ?? [])];

  return {
    entry: options.entry ?? ['src/index.ts'],
    format: ['esm'],
    target: 'node24',
    platform: 'node',
    bundle: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false,
    shims: true,
    // esbuild rewrites `class User` to `class _User`; without keepNames,
    // User.name (used as Conduit schema names) becomes "_User" and
    // cross-module relations to "User" fail at runtime.
    keepNames: true,
    outDir: 'bundle',
    outExtension() {
      return { js: '.js' };
    },
    noExternal: [/@conduitplatform\//],
    external,
    esbuildOptions(esbuildOptions) {
      esbuildOptions.packages = undefined;
      esbuildOptions.keepNames = true;
    },
  };
}

#!/usr/bin/env node
import { copyBundleAssets } from './copyBundleAssets.js';
import { generateBundleLockfile } from './generateBundleLockfile.js';
import { generateBundleManifest } from './generateBundleManifest.js';

const USAGE = `Usage: service-bundle <command> [serviceRoot]

Commands:
  generate-manifest   Write package.bundle.json from service + workspace deps
  copy-assets         Copy protos/json into bundle/ (flat layout)
  generate-lockfile   Write package.bundle-lock.json via npm --package-lock-only
`;

function parseArgs(argv: string[]): { command: string; serviceRoot?: string } {
  const [, , command, serviceRoot] = argv;
  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }
  return { command, serviceRoot };
}

const { command, serviceRoot } = parseArgs(process.argv);
const opts = serviceRoot ? { serviceRoot } : {};

switch (command) {
  case 'generate-manifest':
    generateBundleManifest(opts);
    break;
  case 'copy-assets':
    copyBundleAssets(opts);
    break;
  case 'generate-lockfile':
    generateBundleLockfile(opts);
    break;
  default:
    console.error(`Unknown command: ${command}\n\n${USAGE}`);
    process.exit(1);
}

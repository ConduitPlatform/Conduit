#!/usr/bin/env node

import { appendFileSync } from 'node:fs';

const SHARED_BUILD_PATHS = [
  'Dockerfile',
  'docker-bake.hcl',
  'scripts/Dockerfile.builder',
];

const SERVICE_BUNDLE_PATHS = ['libraries/service-bundle/**'];

const LIBRARY_BUILD_PATHS = [
  'libraries/grpc-sdk/**',
  'libraries/module-tools/**',
];

const IMAGE_TARGETS = [
  {
    target: 'conduit',
    image: 'conduit',
    name: 'Build core',
    buildingService: 'packages/core',
    isBundle: true,
    paths: [
      'packages/core/**',
      ...SERVICE_BUNDLE_PATHS,
      'libraries/grpc-sdk/**',
      'libraries/hermes/**',
      'libraries/module-tools/**',
      'libraries/node-2fa/**',
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'authentication',
    image: 'authentication',
    name: 'Build authentication',
    buildingService: 'modules/authentication',
    isBundle: true,
    paths: [
      'modules/authentication/**',
      ...SERVICE_BUNDLE_PATHS,
      'libraries/node-2fa/**',
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'authorization',
    image: 'authorization',
    name: 'Build authorization',
    buildingService: 'modules/authorization',
    isBundle: true,
    paths: [
      'modules/authorization/**',
      ...SERVICE_BUNDLE_PATHS,
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'chat',
    image: 'chat',
    name: 'Build chat',
    buildingService: 'modules/chat',
    isBundle: true,
    paths: [
      'modules/chat/**',
      ...SERVICE_BUNDLE_PATHS,
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'communications',
    image: 'communications',
    name: 'Build communications',
    buildingService: 'modules/communications',
    isBundle: true,
    paths: [
      'modules/communications/**',
      ...SERVICE_BUNDLE_PATHS,
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'database',
    image: 'database',
    name: 'Build database',
    buildingService: 'modules/database',
    isBundle: true,
    paths: [
      'modules/database/**',
      ...SERVICE_BUNDLE_PATHS,
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'functions',
    image: 'functions',
    name: 'Build functions',
    buildingService: 'modules/functions',
    isBundle: true,
    paths: [
      'modules/functions/**',
      ...SERVICE_BUNDLE_PATHS,
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'router',
    image: 'router',
    name: 'Build router',
    buildingService: 'modules/router',
    isBundle: true,
    paths: [
      'modules/router/**',
      ...SERVICE_BUNDLE_PATHS,
      'libraries/grpc-sdk/**',
      'libraries/hermes/**',
      'libraries/module-tools/**',
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'storage',
    image: 'storage',
    name: 'Build storage',
    buildingService: 'modules/storage',
    isBundle: true,
    paths: [
      'modules/storage/**',
      ...SERVICE_BUNDLE_PATHS,
      ...LIBRARY_BUILD_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
  {
    target: 'conduit-standalone',
    image: 'conduit-standalone',
    name: 'Build standalone',
    buildingService: '',
    isBundle: true,
    paths: [
      'modules/**',
      'packages/core/**',
      'libraries/grpc-sdk/**',
      'libraries/hermes/**',
      'libraries/module-tools/**',
      'libraries/node-2fa/**',
      'standalone/**',
      'standalone.Dockerfile',
      ...SERVICE_BUNDLE_PATHS,
      ...SHARED_BUILD_PATHS,
    ],
  },
];

function globMatch(file, pattern) {
  const normalized = file.replace(/\\/g, '/');
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§§')
        .replace(/\*/g, '[^/]*')
        .replace(/§§/g, '.*') +
      '$',
  );
  return regex.test(normalized);
}

function matchesAnyPath(file, patterns) {
  return patterns.some((pattern) => globMatch(file, pattern));
}

function parseChangedFiles() {
  const raw = process.env.CHANGED_FILES ?? '';
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shouldBuildAll() {
  return process.env.FORCE_ALL === 'true';
}

function resolveTargets() {
  if (shouldBuildAll()) {
    return IMAGE_TARGETS;
  }

  const changed = parseChangedFiles();
  if (changed.length === 0) {
    return IMAGE_TARGETS;
  }

  const selected = IMAGE_TARGETS.filter((entry) =>
    changed.some((file) => matchesAnyPath(file, entry.paths)),
  );

  return selected;
}

function writeOutput(matrix, channel) {
  const payload = JSON.stringify({ include: matrix });
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `matrix=${payload}\n`, 'utf8');
    appendFileSync(outputFile, `channel=${channel}\n`, 'utf8');
    appendFileSync(outputFile, `has_targets=${matrix.length > 0}\n`, 'utf8');
  } else {
    console.log(JSON.stringify({ matrix: payload, channel, has_targets: matrix.length > 0 }, null, 2));
  }
}

const channel =
  process.env.GITHUB_EVENT_NAME === 'release' ? 'release' : 'dev';

const matrix = resolveTargets().map(
  ({ target, image, name, buildingService, isBundle }) => ({
    target,
    image,
    name,
    building_service: buildingService,
    is_bundle: isBundle === true,
  }),
);

writeOutput(matrix, channel);

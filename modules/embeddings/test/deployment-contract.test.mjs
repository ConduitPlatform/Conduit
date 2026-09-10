import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  IMAGE_TARGETS,
  resolveTargets,
} from '../../../scripts/resolve-docker-targets.mjs';

const repo = new URL('../../..', import.meta.url);
const readRepo = relativePath => readFileSync(new URL(relativePath, repo), 'utf8');

const runbook = readRepo('deploy/embeddings.md');
const moduleReadme = readRepo('modules/embeddings/README.md');
const composeSource = readRepo('docker/docker-compose.yml');
const standaloneCompose = readRepo('docker/docker-compose.standalone.yml');
const dockerReadme = readRepo('deploy/docker/README.md');
const k8sReadme = readRepo('deploy/k8s/README.md');
const convictConfig = readRepo('modules/embeddings/src/config/index.ts');
const tsupConfig = readRepo('modules/embeddings/tsup.config.ts');
const dockerfile = readRepo('modules/embeddings/Dockerfile');
const workflow = readRepo('.github/workflows/embeddings-test.yml');

const PROFILE_ENABLEMENT_DOCS = [
  ['deploy/embeddings.md', runbook],
  ['modules/embeddings/README.md', moduleReadme],
  ['docker/docker-compose.yml', composeSource],
  ['docker/docker-compose.standalone.yml', standaloneCompose],
  ['deploy/docker/README.md', dockerReadme],
];

function assertProfileExamplesRequireGrpcKey(source, label) {
  const lines = source.split('\n');
  let seen = 0;
  for (const [index, line] of lines.entries()) {
    if (!line.includes('--profile embeddings')) {
      continue;
    }
    if (/omit `--profile embeddings`|omit --profile embeddings/.test(line)) {
      continue;
    }
    seen += 1;
    const window = lines.slice(Math.max(0, index - 3), index + 3).join('\n');
    assert.match(
      window,
      /export GRPC_KEY=|non-empty `GRPC_KEY`|non-empty GRPC_KEY/,
      `${label}:${index + 1} profile enablement must require/export a non-empty GRPC_KEY`,
    );
  }
  assert.ok(seen > 0, `${label} must document --profile embeddings`);
}

test('compose profile enablement examples require a non-empty GRPC_KEY', () => {
  for (const [label, source] of PROFILE_ENABLEMENT_DOCS) {
    assertProfileExamplesRequireGrpcKey(source, label);
  }
});

test('runbook distinguishes Helm workload install.embeddings.enabled from convict enabled', () => {
  assert.match(runbook, /Helm workload `install\.embeddings\.enabled`/);
  assert.match(runbook, /Module convict `enabled`/);
  assert.match(runbook, /install\.embeddings\.enabled=false/);
  assert.match(runbook, /This is not `install\.embeddings\.enabled`/);
  assert.doesNotMatch(runbook, /Helm: `install\.embeddings: false`/);
  assert.match(k8sReadme, /install\.embeddings\.enabled/);
  assert.match(moduleReadme, /install\.embeddings\.enabled/);
});

test('rollback retains vector, index, config, and Redis state', () => {
  assert.match(runbook, /Rollback \*\*retains\*\*/);
  assert.match(runbook, /vector fields, indexes, `EmbeddingConfig` documents/);
  assert.match(runbook, /Redis\/BullMQ queue state/);
  assert.match(runbook, /embeddings-storage-queue/);
  assert.match(
    k8sReadme,
    /retained vector\/index\/config\/\nRedis state|retained vector/,
  );
});

test('module settings omit gRPC-key and host allowlists in favor of a model catalogue', () => {
  assert.doesNotMatch(convictConfig, /requireGrpcKey/);
  assert.doesNotMatch(convictConfig, /allowedHosts/);
  assert.match(convictConfig, /defaultModel/);
  assert.match(convictConfig, /Operator-managed embedding models/);
});

test('docs stay default-off and do not claim a published embeddings image', () => {
  assert.match(convictConfig, /default: false/);
  assert.match(runbook, /not published/);
  assert.match(moduleReadme, /not published until a compatible release/);
  assert.doesNotMatch(
    runbook,
    /Image: `docker\.io\/conduitplatform\/embeddings:\$\{IMAGE_TAG\}`/,
  );
  assert.match(composeSource, /profiles: \['embeddings'\]/);
});

test('runbook covers Storage extraction operations and trusted ingest', () => {
  assert.match(runbook, /trustedIngestModules/);
  assert.match(runbook, /CompleteFileUpload/);
  assert.match(runbook, /Office/);
  assert.match(runbook, /OCR/);
  assert.match(runbook, /pdfjs-dist/);
  assert.match(runbook, /storage_extracted_total/);
  assert.match(runbook, /Extracted and submitted chunk text is embedded then discarded|No-text retention/i);
  assert.match(runbook, /POST \/embeddings\/sources\/:id\/reconcile/);
  assert.match(moduleReadme, /trustedIngestModules/);
  assert.match(moduleReadme, /Office/);
  assert.doesNotMatch(runbook, /sk-live|sas=/);
});

test('compose maps container GRPC_PORT through EMBEDDINGS_GRPC_PORT', () => {
  assert.match(composeSource, /GRPC_PORT: '\$\{EMBEDDINGS_GRPC_PORT:-55165\}'/);
  assert.match(
    composeSource,
    /SERVICE_URL: 'conduit-embeddings:\$\{EMBEDDINGS_GRPC_PORT:-55165\}'/,
  );
  assert.match(
    composeSource,
    /'\$\{EMBEDDINGS_GRPC_PORT:-55165\}:\$\{EMBEDDINGS_GRPC_PORT:-55165\}'/,
  );
});

test('PR CI runs compose render and target discovery', () => {
  assert.match(
    workflow,
    /docker compose --profile mongodb --profile embeddings config --services/,
  );
  assert.match(workflow, /docker compose --profile mongodb config --services/);
  assert.match(
    workflow,
    /env -u GITHUB_OUTPUT node scripts\/resolve-docker-targets\.mjs/,
  );
  assert.match(workflow, /docker\/\*\*/);
  assert.match(workflow, /scripts\/resolve-docker-targets\.mjs/);
});

test('embeddings-only changes select embeddings and exclude standalone', () => {
  const standalone = IMAGE_TARGETS.find(entry => entry.target === 'conduit-standalone');
  assert.deepEqual(standalone?.excludePaths, ['modules/embeddings/**']);

  const selected = resolveTargets({
    changedFiles: ['modules/embeddings/src/index.ts'],
    forceAll: false,
  }).map(entry => entry.target);

  assert.ok(selected.includes('embeddings'));
  assert.ok(!selected.includes('conduit-standalone'));
  assert.ok(!selected.includes('chat'));
});

test('other module rebuilds still select standalone', () => {
  const chatSelected = resolveTargets({
    changedFiles: ['modules/chat/src/Chat.ts'],
    forceAll: false,
  }).map(entry => entry.target);
  assert.ok(chatSelected.includes('chat'));
  assert.ok(chatSelected.includes('conduit-standalone'));
  assert.ok(!chatSelected.includes('embeddings'));

  const mixed = resolveTargets({
    changedFiles: ['modules/embeddings/src/index.ts', 'modules/storage/src/Storage.ts'],
    forceAll: false,
  }).map(entry => entry.target);
  assert.ok(mixed.includes('embeddings'));
  assert.ok(mixed.includes('storage'));
  assert.ok(mixed.includes('conduit-standalone'));

  const shared = resolveTargets({
    changedFiles: ['docker-bake.hcl'],
    forceAll: false,
  }).map(entry => entry.target);
  assert.ok(shared.includes('embeddings'));
  assert.ok(shared.includes('conduit-standalone'));
});

test('production bundle emits pdfExtract.worker beside the entry', () => {
  assert.match(tsupConfig, /'pdfExtract\.worker': 'src\/utils\/pdfExtract\.worker\.ts'/);
  assert.match(dockerfile, /COPY --from=conduit-base \/app\/modules\/embeddings\/bundle/);
  assert.match(dockerfile, /CMD \["node", "bundle\/index\.js"\]/);
  const moduleRoot = fileURLToPath(new URL('..', import.meta.url));
  const bundleIndex = fileURLToPath(new URL('../bundle/index.js', import.meta.url));
  const bundleWorker = fileURLToPath(
    new URL('../bundle/pdfExtract.worker.js', import.meta.url),
  );
  const canBuild =
    existsSync(new URL('../node_modules', import.meta.url)) ||
    existsSync(new URL('../../../node_modules', import.meta.url));
  if ((!existsSync(bundleIndex) || !existsSync(bundleWorker)) && canBuild) {
    const result = spawnSync('pnpm', ['build:bundle'], {
      cwd: moduleRoot,
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(
      result.status,
      0,
      `pnpm build:bundle failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  if (existsSync(bundleIndex) || canBuild) {
    assert.equal(existsSync(bundleIndex), true, 'production bundle index is missing');
    assert.equal(
      existsSync(bundleWorker),
      true,
      'built bundle must include pdfExtract.worker.js beside index.js',
    );
  }
});

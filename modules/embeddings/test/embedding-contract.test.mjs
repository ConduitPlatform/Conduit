import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const protoSource = readFileSync(new URL('../src/embeddings.proto', import.meta.url), 'utf8');
const readmeSource = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('embeddings module exposes configuration, backfill, and semantic search RPCs', () => {
  assert.match(protoSource, /rpc upsertConfig/);
  assert.match(protoSource, /rpc getConfigs/);
  assert.match(protoSource, /rpc startBackfill/);
  assert.match(protoSource, /rpc semanticSearch/);
});

test('deployment docs describe provider configuration and rollout workflow', () => {
  assert.match(readmeSource, /openai-compatible/);
  assert.match(readmeSource, /backfill/);
  assert.match(readmeSource, /semanticSearch/);
});

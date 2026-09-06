import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const protoSource = readFileSync(
  new URL('../src/embeddings.proto', import.meta.url),
  'utf8',
);
const readmeSource = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const sdkSource = readFileSync(
  new URL('../../../libraries/grpc-sdk/src/modules/embeddings/index.ts', import.meta.url),
  'utf8',
);

test('embeddings proto exposes typed config, status, backfill, and search RPCs', () => {
  assert.match(
    protoSource,
    /rpc upsertConfig\(UpsertConfigRequest\) returns \(UpsertConfigResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc getConfigs\(GetConfigsRequest\) returns \(GetConfigsResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc deleteConfig\(DeleteEmbeddingConfigRequest\) returns \(DeleteEmbeddingConfigResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc getCapabilities\(GetCapabilitiesRequest\) returns \(GetCapabilitiesResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc getStatus\(GetStatusRequest\) returns \(GetStatusResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc startBackfill\(StartBackfillRequest\) returns \(StartBackfillResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc getBackfill\(GetBackfillRequest\) returns \(BackfillRun\)/,
  );
  assert.match(
    protoSource,
    /rpc listBackfills\(ListBackfillsRequest\) returns \(ListBackfillsResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc cancelBackfill\(CancelBackfillRequest\) returns \(BackfillMutationResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc resumeBackfill\(ResumeBackfillRequest\) returns \(BackfillMutationResponse\)/,
  );
  assert.match(
    protoSource,
    /rpc semanticSearch\(SemanticSearchRequest\) returns \(SemanticSearchResponse\)/,
  );
  assert.doesNotMatch(
    protoSource,
    /message EmbeddingConfigResponse \{\n  string result = 1;/,
  );
  assert.doesNotMatch(protoSource, /message EmbeddingsQueryResponse/);
});

test('grpc-sdk embeddings client maps typed proto messages instead of JSON-string envelopes', () => {
  assert.match(sdkSource, /upsertConfig\(/);
  assert.match(sdkSource, /deleteConfig\(/);
  assert.match(sdkSource, /getCapabilities\(/);
  assert.match(sdkSource, /getStatus\(/);
  assert.match(sdkSource, /getBackfill\(/);
  assert.match(sdkSource, /listBackfills\(/);
  assert.match(sdkSource, /cancelBackfill\(/);
  assert.match(sdkSource, /resumeBackfill\(/);
  assert.doesNotMatch(sdkSource, /JSON\.parse\(res\.result\)/);
  assert.match(sdkSource, /JSON\.parse\(hit\.document\)/);
});

test('deployment docs describe provider configuration and rollout workflow', () => {
  assert.match(readmeSource, /openai-compatible/);
  assert.match(readmeSource, /backfill/);
  assert.match(readmeSource, /semanticSearch/);
  assert.match(readmeSource, /\/embeddings\//);
});

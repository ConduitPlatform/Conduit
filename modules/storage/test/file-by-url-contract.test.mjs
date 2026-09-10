import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const proto = readFileSync(new URL('../src/storage.proto', import.meta.url), 'utf8');
const sdk = readFileSync(
  new URL('../../../libraries/grpc-sdk/src/modules/storage/index.ts', import.meta.url),
  'utf8',
);

test('FileByUrlResponse exposes upload status, content version, and size', () => {
  assert.match(
    proto,
    /message FileByUrlResponse \{[\s\S]*optional string uploadStatus = 6;[\s\S]*optional string contentVersion = 7;[\s\S]*optional int32 size = 8;/,
  );
  assert.match(sdk, /Promise<FileByUrlResponse>/);
  assert.match(sdk, /createFileByUrl\(/);
  assert.match(sdk, /updateFileByUrl\(/);
});

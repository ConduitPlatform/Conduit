import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

test('MongooseAdapter createView uses distributed lock and local coalescing', () => {
  const adapterSource = readFileSync(join(here, 'index.ts'), 'utf8');
  const schemaSource = readFileSync(join(here, 'MongooseSchema.ts'), 'utf8');

  assert.match(adapterSource, /pendingViewCreations/);
  assert.match(adapterSource, /tryAcquireLock/);
  assert.match(adapterSource, /waitForViewReadiness/);
  assert.match(adapterSource, /state\.withLock/);
  assert.match(adapterSource, /createViewLocked/);
  assert.match(adapterSource, /createPhysicalMongoView/);
  assert.match(adapterSource, /upsertViewMetadata/);
  assert.match(adapterSource, /clearStaleLocalViewModel/);
  assert.doesNotMatch(adapterSource, /err\.codeName === 'NamespaceExists'/);
  assert.doesNotMatch(schemaSource, /OverwriteModelError/);
});

test('createView callers route through adapter createView', () => {
  const databaseAdapter = readFileSync(
    join(here, '..', 'DatabaseAdapter.ts'),
    'utf8',
  );
  const databaseModule = readFileSync(
    join(here, '..', '..', 'Database.ts'),
    'utf8',
  );

  assert.match(databaseAdapter, /await this\.createView\(/);
  assert.match(databaseModule, /createViewFromAdapter/);
  assert.match(databaseModule, /database:create:view/);
});

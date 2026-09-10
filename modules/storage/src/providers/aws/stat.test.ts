import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapHeadObjectToStat } from './index.js';

describe('mapHeadObjectToStat', () => {
  it('maps HeadObject metadata used for upload completion', () => {
    const lastModified = new Date('2026-03-01T00:00:00.000Z');
    assert.deepEqual(
      mapHeadObjectToStat({
        ContentLength: 42,
        ETag: '"abc"',
        ContentType: 'text/plain',
        LastModified: lastModified,
        ChecksumSHA256: 'sha',
      }),
      {
        exists: true,
        size: 42,
        etag: '"abc"',
        contentType: 'text/plain',
        lastModified,
        checksum: 'sha',
      },
    );
  });

  it('defaults missing size to zero', () => {
    assert.equal(mapHeadObjectToStat({}).size, 0);
    assert.equal(mapHeadObjectToStat({}).exists, true);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapGcsMetadataToStat } from './index.js';

describe('mapGcsMetadataToStat', () => {
  it('parses string sizes and checksum metadata from GCS head', () => {
    const stat = mapGcsMetadataToStat({
      size: '18',
      etag: 'gcs-etag',
      contentType: 'application/pdf',
      updated: '2026-02-01T00:00:00.000Z',
      md5Hash: 'md5',
    });
    assert.equal(stat.exists, true);
    assert.equal(stat.size, 18);
    assert.equal(stat.etag, 'gcs-etag');
    assert.equal(stat.checksum, 'md5');
    assert.equal(stat.lastModified?.toISOString(), '2026-02-01T00:00:00.000Z');
  });
});

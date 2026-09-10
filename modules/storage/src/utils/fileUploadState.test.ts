import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContentVersion,
  FILE_UPLOAD_STATUS,
  isFileBytesReady,
  normalizeEtag,
  objectIsPendingPlaceholder,
  PENDING_UPLOAD_PLACEHOLDER_BYTES,
} from './fileUploadState.js';

describe('isFileBytesReady', () => {
  it('treats missing uploadStatus as ready for legacy File documents', () => {
    assert.equal(isFileBytesReady({}), true);
    assert.equal(isFileBytesReady({ uploadStatus: undefined }), true);
    assert.equal(isFileBytesReady({ uploadStatus: FILE_UPLOAD_STATUS.ready }), true);
  });

  it('does not treat pending placeholders as ready', () => {
    assert.equal(isFileBytesReady({ uploadStatus: FILE_UPLOAD_STATUS.pending }), false);
  });
});

describe('normalizeEtag / buildContentVersion', () => {
  it('prefers etag without quotes as the content version', () => {
    assert.equal(normalizeEtag('"abc123"'), 'abc123');
    assert.equal(
      buildContentVersion({
        exists: true,
        size: 12,
        etag: '"abc123"',
        checksum: 'md5',
      }),
      'abc123',
    );
  });

  it('falls back to checksum then size and mtime', () => {
    assert.equal(
      buildContentVersion({ exists: true, size: 4, checksum: 'deadbeef' }),
      'deadbeef',
    );
    const lastModified = new Date('2026-01-02T00:00:00.000Z');
    assert.equal(
      buildContentVersion({ exists: true, size: 8, lastModified }),
      `8:${lastModified.getTime()}`,
    );
    assert.equal(buildContentVersion({ exists: true, size: 3 }), 'size:3');
    assert.equal(buildContentVersion({ exists: false }), undefined);
  });
});

describe('objectIsPendingPlaceholder', () => {
  it('treats missing or empty objects as incomplete', async () => {
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.pending },
        { exists: false },
      ),
      true,
    );
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.pending },
        { exists: true, size: 0 },
      ),
      true,
    );
  });

  it('uses stored placeholder etag when the object has not been replaced', async () => {
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.pending, etag: '"ph"' },
        { exists: true, size: 14, etag: 'ph' },
      ),
      true,
    );
  });

  it('reads bytes only when a 14-byte pending object cannot be distinguished by etag', async () => {
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.pending },
        { exists: true, size: PENDING_UPLOAD_PLACEHOLDER_BYTES.length },
        async () => PENDING_UPLOAD_PLACEHOLDER_BYTES,
      ),
      true,
    );
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.pending, etag: 'old' },
        {
          exists: true,
          size: PENDING_UPLOAD_PLACEHOLDER_BYTES.length,
          etag: 'new',
        },
      ),
      false,
    );
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.pending },
        { exists: true, size: 1024, etag: 'real' },
      ),
      false,
    );
  });

  it('does not treat already-ready files as placeholders', async () => {
    assert.equal(
      await objectIsPendingPlaceholder(
        { uploadStatus: FILE_UPLOAD_STATUS.ready, etag: 'abc' },
        { exists: true, size: 14, etag: 'abc' },
      ),
      false,
    );
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { fileMatchesSelectors, parseStorageSelectors } from './storageSelectors.js';

const selectors = parseStorageSelectors({
  container: 'docs',
  folderPrefix: 'inbox/',
  mimeTypes: ['text/plain', 'application/pdf'],
});

describe('storage source selectors', () => {
  it('requires a container and an automatic MIME allowlist subset', () => {
    assert.throws(
      () => parseStorageSelectors({}),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => parseStorageSelectors({ container: 'docs', mimeTypes: ['image/png'] }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
  });

  it('matches container, optional folder prefix, and MIME allowlist', () => {
    assert.equal(
      fileMatchesSelectors(
        {
          container: 'docs',
          folder: 'inbox/notes/',
          mimeType: 'text/plain',
        },
        selectors,
      ),
      true,
    );
    assert.equal(
      fileMatchesSelectors(
        {
          container: 'other',
          folder: 'inbox/notes/',
          mimeType: 'text/plain',
        },
        selectors,
      ),
      false,
    );
    assert.equal(
      fileMatchesSelectors(
        {
          container: 'docs',
          folder: 'outbox/',
          mimeType: 'text/plain',
        },
        selectors,
      ),
      false,
    );
    assert.equal(
      fileMatchesSelectors(
        {
          container: 'docs',
          folder: 'inbox/',
          mimeType: 'application/json',
        },
        selectors,
      ),
      false,
    );
  });

  it('ignores pending uploads and treats missing status as ready', () => {
    assert.equal(
      fileMatchesSelectors(
        {
          container: 'docs',
          folder: 'inbox/',
          mimeType: 'text/plain',
          uploadStatus: 'pending',
        },
        selectors,
      ),
      false,
    );
    assert.equal(
      fileMatchesSelectors(
        {
          container: 'docs',
          folder: 'inbox/',
          mimeType: 'text/plain',
        },
        selectors,
      ),
      true,
    );
  });
});

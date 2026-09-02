import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { _StorageContainer } from '../models/index.js';
import {
  sanitizeFilesForResponse,
  stripPrivateContainerUrls,
  validateFilePrivacy,
} from './index.js';

const originalGetInstance = _StorageContainer.getInstance.bind(_StorageContainer);

afterEach(() => {
  _StorageContainer.getInstance = originalGetInstance;
});

function stubContainers(docs: Array<{ name: string; isPublic?: boolean }>) {
  _StorageContainer.getInstance = (() => ({
    findOne: async (query: { name: string }) =>
      docs.find(doc => doc.name === query.name) ?? null,
    findMany: async (query: { name?: { $in: string[] } }) => {
      const names = query.name?.$in;
      return names ? docs.filter(doc => names.includes(doc.name)) : docs;
    },
  })) as unknown as typeof _StorageContainer.getInstance;
}

describe('validateFilePrivacy', () => {
  it('rejects a private or omitted file in a public container', async () => {
    stubContainers([{ name: 'public-bucket', isPublic: true }]);

    await assert.rejects(
      () => validateFilePrivacy('public-bucket', false),
      (error: unknown) =>
        error instanceof GrpcError &&
        error.code === status.INVALID_ARGUMENT &&
        error.message === 'Files in public containers must be public',
    );
    await assert.rejects(
      () => validateFilePrivacy('public-bucket'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.INVALID_ARGUMENT,
    );
  });

  it('allows a public file in a public container and any file in a private container', async () => {
    stubContainers([
      { name: 'public-bucket', isPublic: true },
      { name: 'private-bucket', isPublic: false },
    ]);

    await validateFilePrivacy('public-bucket', true);
    await validateFilePrivacy('private-bucket', true);
    await validateFilePrivacy('private-bucket', false);
    await validateFilePrivacy('private-bucket');
  });
});

describe('sanitizeFileForResponse', () => {
  it('strips url and sourceUrl for files in private containers', async () => {
    stubContainers([{ name: 'private-bucket', isPublic: false }]);

    const [sanitized] = await sanitizeFilesForResponse([
      {
        _id: 'file-1',
        name: 'secret.png',
        container: 'private-bucket',
        url: 'https://stale.example/secret.png',
        sourceUrl: 'https://s3.example/secret.png',
        uri: '/storage/getFileUrl/file-1',
      } as never,
    ]);

    assert.equal(sanitized.uri, '/storage/getFileUrl/file-1');
    assert.equal(sanitized.url, undefined);
    assert.equal(sanitized.sourceUrl, undefined);
  });

  it('keeps provider/CDN urls for files in public containers', async () => {
    stubContainers([{ name: 'public-bucket', isPublic: true }]);

    const [sanitized] = await sanitizeFilesForResponse([
      {
        _id: 'file-2',
        name: 'banner.png',
        container: 'public-bucket',
        url: 'https://cdn.example/banner.png',
        sourceUrl: 'https://s3.example/banner.png',
        uri: '/storage/getFileUrl/file-2',
      } as never,
    ]);

    assert.equal(sanitized.url, 'https://cdn.example/banner.png');
    assert.equal(sanitized.sourceUrl, 'https://s3.example/banner.png');
  });

  it('treats an unknown container as private when stripping urls', () => {
    const sanitized = stripPrivateContainerUrls(
      {
        url: 'https://stale.example/file.png',
        sourceUrl: 'https://s3.example/file.png',
      },
      false,
    );
    assert.equal(sanitized.url, undefined);
    assert.equal(sanitized.sourceUrl, undefined);
  });
});

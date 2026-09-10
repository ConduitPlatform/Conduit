import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { objectPathForFile, readBoundedFileBytes } from './fileBytes.js';
import { FILE_UPLOAD_STATUS } from './fileUploadState.js';

describe('bounded storage file bytes', () => {
  it('rejects pending files and oversized metadata before reading objects', async () => {
    let reads = 0;
    await assert.rejects(
      () =>
        readBoundedFileBytes({
          file: {
            name: 'a.txt',
            folder: 'inbox/',
            container: 'docs',
            size: 12,
            uploadStatus: FILE_UPLOAD_STATUS.pending,
          },
          maxBytes: 100,
          readObject: async () => {
            reads += 1;
            return Buffer.from('secret');
          },
        }),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    await assert.rejects(
      () =>
        readBoundedFileBytes({
          file: {
            name: 'big.bin',
            folder: '/',
            container: 'docs',
            size: 200,
            uploadStatus: FILE_UPLOAD_STATUS.ready,
          },
          maxBytes: 100,
          readObject: async () => {
            reads += 1;
            return Buffer.alloc(200);
          },
        }),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.RESOURCE_EXHAUSTED,
    );
    assert.equal(reads, 0);
  });

  it('treats missing uploadStatus as ready and returns raw bytes without urls', async () => {
    const result = await readBoundedFileBytes({
      file: {
        name: 'note.txt',
        folder: 'inbox/',
        container: 'docs',
        mimeType: 'text/plain',
        size: 5,
        contentVersion: 'v1',
      },
      maxBytes: 32,
      readObject: async () => Buffer.from('hello'),
    });
    assert.deepEqual(result.data, Buffer.from('hello'));
    assert.equal(result.size, 5);
    assert.equal(result.container, 'docs');
    assert.equal(result.folder, 'inbox/');
    assert.equal(objectPathForFile({ folder: '/', name: 'a.txt' }), 'a.txt');
    assert.equal(objectPathForFile({ folder: 'inbox/', name: 'a.txt' }), 'inbox/a.txt');
  });

  it('exposes GetFileBytes on the Storage gRPC contract without URL fields', () => {
    const proto = readFileSync(
      new URL('../../src/storage.proto', import.meta.url),
      'utf8',
    );
    assert.match(
      proto,
      /rpc GetFileBytes\(GetFileBytesRequest\) returns \(GetFileBytesResponse\)/,
    );
    assert.match(proto, /bytes data = 1;/);
    assert.doesNotMatch(
      proto.slice(
        proto.indexOf('message GetFileBytesResponse'),
        proto.indexOf('message DeleteFileResponse'),
      ),
      /url|sourceUrl/,
    );
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StorageParamAdapter } from './StorageParamAdapter.js';

describe('StorageParamAdapter.getFileByUrlResponse', () => {
  const adapter = new StorageParamAdapter();

  it('sets fileUrl from the provider/CDN url only', () => {
    const response = adapter.getFileByUrlResponse({
      url: 'https://uploads.example/presign',
      file: {
        _id: 'file-1',
        url: 'https://cdn.example/public.png',
        uri: '/storage/getFileUrl/file-1',
        name: 'public.png',
      },
    });

    assert.equal(response.fileUrl, 'https://cdn.example/public.png');
    assert.equal(response.uri, '/storage/getFileUrl/file-1');
    assert.equal(response.uploadUrl, 'https://uploads.example/presign');
  });

  it('does not copy uri into fileUrl when url is empty', () => {
    const response = adapter.getFileByUrlResponse({
      url: 'https://uploads.example/presign',
      file: {
        _id: 'file-2',
        url: '',
        uri: '/storage/getFileUrl/file-2',
        name: 'private-container.png',
      },
    });

    assert.equal(response.fileUrl, '');
    assert.equal(response.uri, '/storage/getFileUrl/file-2');
  });

  it('does not copy uri into fileUrl when url is missing', () => {
    const response = adapter.getFileByUrlResponse({
      url: 'https://uploads.example/presign',
      file: {
        _id: 'file-3',
        uri: '/storage/getFileUrl/file-3',
        name: 'no-url.png',
      },
    });

    assert.equal(response.fileUrl, '');
    assert.equal(response.uri, '/storage/getFileUrl/file-3');
  });
});

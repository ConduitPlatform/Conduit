import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { constructAzureContentDisposition, constructDispositionHeader } from './index.js';

describe('constructAzureContentDisposition', () => {
  it('omits the header when no disposition was requested', () => {
    assert.equal(constructAzureContentDisposition('photo.jpg'), undefined);
    assert.equal(
      constructAzureContentDisposition('photo.jpg', { download: false }),
      undefined,
    );
  });

  it('sends a Latin-1 filename without filename*', () => {
    assert.equal(
      constructAzureContentDisposition('blob-id', {
        download: false,
        fileName: 'my file.jpg',
      }),
      'inline; filename="my file.jpg"',
    );
    assert.equal(
      constructAzureContentDisposition('blob-id', {
        download: true,
        fileName: 'café.pdf',
      }),
      'attachment; filename="café.pdf"',
    );
  });

  it('strips quotes and control characters before checking Latin-1', () => {
    assert.equal(
      constructAzureContentDisposition('blob-id', {
        fileName: 'say "hi".jpg\r\n',
      }),
      'inline; filename="say hi.jpg"',
    );
  });

  it('omits the header when any character is outside Latin-1', () => {
    assert.equal(
      constructAzureContentDisposition('blob-id', {
        download: true,
        fileName: 'Εικόνα.jpg',
      }),
      undefined,
    );
    assert.equal(
      constructAzureContentDisposition('blob-id', {
        fileName: 'report-Εικόνα.pdf',
      }),
      undefined,
    );
  });

  it('omits the header when stripping leaves nothing', () => {
    assert.equal(
      constructAzureContentDisposition('blob-id', { fileName: '"\r\n"' }),
      undefined,
    );
  });

  it('falls back to the object name when only download is set', () => {
    assert.equal(
      constructAzureContentDisposition('folder/photo.jpg', { download: true }),
      'attachment; filename="folder/photo.jpg"',
    );
  });
});

describe('constructDispositionHeader', () => {
  it('keeps filename* for providers that accept it', () => {
    assert.equal(
      constructDispositionHeader('blob-id', { fileName: 'my file.jpg' }),
      'inline; filename="my file.jpg"; filename*=UTF-8\'\'my%20file.jpg',
    );
  });
});

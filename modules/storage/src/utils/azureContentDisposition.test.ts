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

  it('sends a printable ASCII filename without filename*', () => {
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
        fileName: 'report (1).pdf',
      }),
      'attachment; filename="report (1).pdf"',
    );
  });

  it('strips quotes, backslashes, and control characters', () => {
    assert.equal(
      constructAzureContentDisposition('blob-id', {
        fileName: 'say "hi".jpg\r\n',
      }),
      'inline; filename="say hi.jpg"',
    );
    assert.equal(
      constructAzureContentDisposition('blob-id', { fileName: 'a\\b.jpg' }),
      'inline; filename="ab.jpg"',
    );
  });

  it('omits the header when any character is outside printable ASCII', () => {
    assert.equal(
      constructAzureContentDisposition('blob-id', { fileName: 'café.pdf' }),
      undefined,
    );
    assert.equal(
      constructAzureContentDisposition('blob-id', { fileName: 'file\u0085.pdf' }),
      undefined,
    );
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

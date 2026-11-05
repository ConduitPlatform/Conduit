import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IStorageProvider, UrlOptions } from '../interfaces/index.js';
import { _StorageContainer } from '../models/index.js';
import { constructDispositionHeader, resolvePublicFileAccessUrl } from './index.js';

const originalGetInstance = _StorageContainer.getInstance.bind(_StorageContainer);

afterEach(() => {
  _StorageContainer.getInstance = originalGetInstance;
});

function quotedFilename(header: string): string {
  const match = header.match(/filename="([^"]*)"/);
  assert.ok(match);
  return match[1];
}

function extendedFilename(header: string): { encoded: string; decoded: string } {
  const match = header.match(/filename\*=UTF-8''([^;]*)$/);
  assert.ok(match);
  return { encoded: match[1], decoded: decodeURIComponent(match[1]) };
}

function assertQuotedAscii(header: string): void {
  const quoted = quotedFilename(header);
  assert.match(quoted, /^[\x20-\x7E]*$/);
  assert.equal(quoted.includes('"'), false);
  assert.equal(quoted.includes('\\'), false);
  assert.match(header, /^[\x20-\x7E]+$/);
}

describe('constructDispositionHeader', () => {
  it('uses an ASCII fallback for a decomposed name and preserves it in filename*', () => {
    const name = 'Rene\u0301e Resume\u0301.pdf';
    const header = constructDispositionHeader('stored.pdf', { fileName: name });

    assert.ok(header);
    assertQuotedAscii(header);
    assert.equal(quotedFilename(header), 'Renee Resume.pdf');
    assert.equal(extendedFilename(header).decoded, name);
    assert.match(header, /^inline; /);
  });

  it('uses an ASCII fallback for a precomposed name', () => {
    const name = 'Renée Resumé.pdf';
    const header = constructDispositionHeader('stored.pdf', { fileName: name });

    assert.ok(header);
    assertQuotedAscii(header);
    assert.equal(quotedFilename(header), 'Renee Resume.pdf');
    assert.equal(extendedFilename(header).decoded, name);
  });

  it('replaces quotes and backslashes in the quoted filename', () => {
    const name = 'a"b\\c.pdf';
    const header = constructDispositionHeader('stored.pdf', { fileName: name });

    assert.ok(header);
    assertQuotedAscii(header);
    assert.equal(quotedFilename(header), 'a_b_c.pdf');
    assert.equal(extendedFilename(header).decoded, name);
  });

  it('leaves a plain ASCII name unchanged', () => {
    const header = constructDispositionHeader('stored.pdf', { fileName: 'notes.txt' });

    assert.equal(header, `inline; filename="notes.txt"; filename*=UTF-8''notes.txt`);
  });

  it('selects attachment or inline from the download flag', () => {
    assert.equal(
      constructDispositionHeader('notes.txt', { download: false, fileName: 'notes.txt' }),
      `inline; filename="notes.txt"; filename*=UTF-8''notes.txt`,
    );
    assert.equal(
      constructDispositionHeader('notes.txt', { download: true, fileName: 'notes.txt' }),
      `attachment; filename="notes.txt"; filename*=UTF-8''notes.txt`,
    );
    assert.equal(
      constructDispositionHeader('notes.txt', { download: true }),
      `attachment; filename="notes.txt"; filename*=UTF-8''notes.txt`,
    );
  });

  it('encodes RFC 5987 attr-char exclusions in filename*', () => {
    const name = "plan (it's final)*.pdf";
    const header = constructDispositionHeader('stored.pdf', { fileName: name });

    assert.ok(header);
    const { encoded, decoded } = extendedFilename(header);
    assert.equal(decoded, name);
    assert.equal(encoded, 'plan%20%28it%27s%20final%29%2A.pdf');
    assert.equal(quotedFilename(header), name);
  });

  it('falls back when stripping leaves the basename empty', () => {
    assert.equal(
      quotedFilename(
        constructDispositionHeader('stored.pdf', { fileName: '\u0301.pdf' })!,
      ),
      'file.pdf',
    );
    assert.equal(
      quotedFilename(constructDispositionHeader('stored.pdf', { fileName: '\u0301' })!),
      'file',
    );
  });

  it('signs a non-ASCII alias and keeps the stored name ASCII', async () => {
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ name: 'docs', isPublic: false }),
    })) as unknown as typeof _StorageContainer.getInstance;

    const alias = 'Renée Resumé.pdf';
    const storedName = 'f8c2a1.pdf';
    let captured: { fileName: string; options?: UrlOptions } | undefined;
    const provider = {
      container() {
        return this;
      },
      getSignedUrl(fileName: string, options?: UrlOptions) {
        captured = { fileName, options };
        return Promise.resolve(constructDispositionHeader(fileName, options) ?? '');
      },
    } as unknown as IStorageProvider;

    const header = await resolvePublicFileAccessUrl(provider, {
      name: storedName,
      alias,
      folder: 'reports/',
      container: 'docs',
    } as never);

    assert.equal(captured?.fileName, `reports/${storedName}`);
    assert.equal(captured?.options?.fileName, alias);
    assert.equal(captured?.options?.download, false);
    assertQuotedAscii(header);
    assert.equal(quotedFilename(header), 'Renee Resume.pdf');
    assert.equal(extendedFilename(header).decoded, alias);
    assert.equal(header.includes(storedName), false);
  });
});

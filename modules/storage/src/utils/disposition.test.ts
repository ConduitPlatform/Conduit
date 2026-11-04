import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { constructDispositionHeader, dispositionFileName } from './disposition.js';

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

function parts(header: string | undefined): {
  disposition: string;
  filename: string;
  filenameStar: string;
} {
  assert.equal(typeof header, 'string');
  assert.match(header!, PRINTABLE_ASCII);
  const match =
    /^(attachment|inline); filename="([^"]*)"; filename\*=UTF-8''([\x21-\x7E]+)$/.exec(
      header!,
    );
  assert.ok(match, header);
  const filename = match[2];
  assert.match(filename, PRINTABLE_ASCII);
  assert.equal(filename.includes('"'), false);
  assert.equal(filename.includes('\\'), false);
  return {
    disposition: match[1],
    filename,
    filenameStar: match[3],
  };
}

describe('constructDispositionHeader', () => {
  it('quotes an ASCII fallback for a decomposed name and round-trips filename*', () => {
    const name = 'Rene\u0301e Resume\u0301.pdf';
    const parsed = parts(
      constructDispositionHeader(name, { download: true, fileName: name }),
    );
    assert.equal(parsed.disposition, 'attachment');
    assert.equal(parsed.filename, 'Renee Resume.pdf');
    assert.equal(decodeURIComponent(parsed.filenameStar), name);
  });

  it('quotes an ASCII fallback for a precomposed name and round-trips filename*', () => {
    const name = 'Renée Resumé.pdf';
    const parsed = parts(
      constructDispositionHeader(name, { download: false, fileName: name }),
    );
    assert.equal(parsed.disposition, 'inline');
    assert.equal(parsed.filename, 'Renee Resume.pdf');
    assert.equal(decodeURIComponent(parsed.filenameStar), name);
  });

  it('replaces quotes and backslashes in the quoted filename', () => {
    const name = 'budget "q3"\\notes.pdf';
    const parsed = parts(
      constructDispositionHeader(name, { download: true, fileName: name }),
    );
    assert.equal(parsed.filename, 'budget _q3__notes.pdf');
    assert.equal(decodeURIComponent(parsed.filenameStar), name);
  });

  it('replaces characters that do not decompose to ASCII', () => {
    const parsed = parts(
      constructDispositionHeader('x', { download: true, fileName: '报告.pdf' }),
    );
    assert.equal(parsed.filename, '__.pdf');
    assert.equal(decodeURIComponent(parsed.filenameStar), '报告.pdf');
  });

  it('leaves a plain ASCII name unchanged', () => {
    const name = 'quarterly-report.pdf';
    const parsed = parts(
      constructDispositionHeader(name, { download: true, fileName: name }),
    );
    assert.equal(parsed.filename, name);
    assert.equal(decodeURIComponent(parsed.filenameStar), name);
  });

  it('uses attachment for download and inline otherwise', () => {
    const name = 'quarterly-report.pdf';
    assert.equal(
      parts(constructDispositionHeader(name, { download: true, fileName: name }))
        .disposition,
      'attachment',
    );
    assert.equal(
      parts(constructDispositionHeader(name, { download: false, fileName: name }))
        .disposition,
      'inline',
    );
  });

  it('encodes RFC 5987 attr-char exclusions in filename*', () => {
    const name = "notes (draft)'s copy*.txt";
    const parsed = parts(
      constructDispositionHeader(name, { download: true, fileName: name }),
    );
    assert.equal(parsed.filename, name);
    assert.match(parsed.filenameStar, /%27/);
    assert.match(parsed.filenameStar, /%28/);
    assert.match(parsed.filenameStar, /%29/);
    assert.match(parsed.filenameStar, /%2A/);
    assert.doesNotMatch(parsed.filenameStar, /['()*]/);
    assert.equal(decodeURIComponent(parsed.filenameStar), name);
  });

  it('falls back when the sanitized name is empty and keeps an ASCII extension', () => {
    assert.equal(
      parts(constructDispositionHeader('x', { download: true, fileName: '\u0301' }))
        .filename,
      'file',
    );
    assert.equal(
      parts(constructDispositionHeader('x', { download: true, fileName: '\u0301.pdf' }))
        .filename,
      'file.pdf',
    );
    assert.equal(
      parts(constructDispositionHeader('x', { download: false, fileName: '.pdf' }))
        .filename,
      '.pdf',
    );
  });

  it('builds the disposition from a non-ASCII alias when the stored name is ASCII', () => {
    const file = {
      name: 'resume.pdf',
      alias: 'Rene\u0301e Resume\u0301.pdf',
    };
    const storageKey = `docs/${file.name}`;
    const parsed = parts(
      constructDispositionHeader(storageKey, {
        download: true,
        fileName: dispositionFileName(file),
      }),
    );
    assert.equal(parsed.disposition, 'attachment');
    assert.equal(parsed.filename, 'Renee Resume.pdf');
    assert.notEqual(parsed.filename, storageKey);
    assert.notEqual(parsed.filename, file.name);
    assert.equal(decodeURIComponent(parsed.filenameStar), file.alias);

    const storedName = dispositionFileName({ name: 'resume.pdf' });
    const inline = parts(
      constructDispositionHeader(storageKey, { download: false, fileName: storedName }),
    );
    assert.equal(inline.disposition, 'inline');
    assert.equal(inline.filename, 'resume.pdf');
    assert.equal(decodeURIComponent(inline.filenameStar), 'resume.pdf');
  });

  it('returns undefined when no disposition was requested', () => {
    assert.equal(constructDispositionHeader('resume.pdf'), undefined);
    assert.equal(
      constructDispositionHeader('resume.pdf', { download: false }),
      undefined,
    );
  });
});

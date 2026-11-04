import path from 'path';

const QUOTED_FILENAME_UNSAFE = /[^\x20-\x7E]|["\\]/gu;

function sanitizeAscii(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(QUOTED_FILENAME_UNSAFE, '_');
}

function toAsciiFallbackFilename(name: string): string {
  const extension = path.posix.extname(name);
  const base = name.slice(0, name.length - extension.length);
  const sanitizedExtension = sanitizeAscii(extension);
  let sanitizedBase = sanitizeAscii(base);
  if (sanitizedBase === '' && base !== '') sanitizedBase = 'file';
  const ascii = `${sanitizedBase}${sanitizedExtension}`;
  return ascii === '' ? 'file' : ascii;
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, char => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

export function dispositionFileName(file: {
  name: string;
  alias?: string | null;
}): string {
  return file.alias ?? file.name;
}

export const constructDispositionHeader = (
  fileName: string,
  options?: { download?: boolean; fileName?: string },
): string | undefined => {
  if (!options || (!options.download && !options.fileName)) {
    return undefined;
  }
  const displayName = options.fileName ?? fileName;
  const disposition = options.download ? 'attachment' : 'inline';
  const asciiName = toAsciiFallbackFilename(displayName);
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987Value(
    displayName,
  )}`;
};

const PEM_PATTERN = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/;

/**
 * Normalizes a PEM private key as entered through the admin panel or env/config.
 *
 * Handles escaped newlines (`\n` as two characters, as found in service account JSON
 * copied verbatim), CRLF line endings, surrounding quotes and keys whose line breaks
 * were stripped or turned into spaces (e.g. pasted into a single-line input).
 */
export function normalizePrivateKey(privateKey: string): string {
  let key = (privateKey ?? '').trim();
  if (
    key.length > 1 &&
    (key[0] === '"' || key[0] === "'") &&
    key[key.length - 1] === key[0]
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\r\\n|\\n/g, '\n').replace(/\r\n?/g, '\n');

  const match = key.match(PEM_PATTERN);
  if (!match) return key;
  const label = match[1];
  const body = match[2].replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

import { generateSecret } from './index';

describe('generateSecret', () => {
  it('returns a local PNG data URL for qr', async () => {
    const result = await generateSecret({ name: 'Conduit', account: 'user@example.com' });
    expect(result.qr.startsWith('data:image/png')).toBe(true);
    expect(result.uri.startsWith('otpauth://totp/')).toBe(true);
    expect(result.secret.length).toBeGreaterThan(0);
  });
});

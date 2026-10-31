import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import { generateSecret } from '@conduitplatform/node-2fa';
import authConfig from '../config/config.js';
import {
  DEFAULT_TOTP_ISSUER,
  TOTP_ISSUER_MAX_LENGTH,
  resolveTotpIssuer,
  sanitizeTotpIssuer,
} from './totpIssuer.js';

describe('twoFa issuer config', () => {
  it('defaults the issuer to conduit and the allowlist to empty', () => {
    assert.equal(authConfig.twoFa.issuer.default, DEFAULT_TOTP_ISSUER);
    assert.equal(authConfig.twoFa.issuer.format, 'String');
    assert.equal(typeof authConfig.twoFa.issuer.doc, 'string');
    assert.ok(authConfig.twoFa.issuer.doc.length > 0);
    assert.deepEqual(authConfig.twoFa.allowedIssuers.default, []);
    assert.equal(authConfig.twoFa.allowedIssuers.format, 'Array');
    assert.equal(authConfig.twoFa.allowedIssuers.children.format, 'String');
    assert.ok(authConfig.twoFa.allowedIssuers.doc.length > 0);

    const loaded = convict(authConfig);
    loaded.validate({ allowed: 'warn' });
    const properties = loaded.getProperties();
    assert.equal(properties.twoFa.issuer, 'conduit');
    assert.deepEqual(properties.twoFa.allowedIssuers, []);
    assert.equal(resolveTotpIssuer(properties.twoFa), 'conduit');
  });

  it('accepts an issuer and allowlist through the config schema', () => {
    const loaded = convict(authConfig);
    loaded.load({
      twoFa: {
        issuer: 'Acme',
        allowedIssuers: ['Acme', 'Acme Mobile'],
      },
    });
    loaded.validate({ allowed: 'warn' });
    const properties = loaded.getProperties();
    assert.equal(properties.twoFa.issuer, 'Acme');
    assert.deepEqual(properties.twoFa.allowedIssuers, ['Acme', 'Acme Mobile']);
    assert.equal(resolveTotpIssuer(properties.twoFa), 'Acme');
  });
});

describe('resolveTotpIssuer', () => {
  it('uses the default issuer when none is configured', () => {
    assert.equal(resolveTotpIssuer({}), 'conduit');
    assert.equal(resolveTotpIssuer({ issuer: '   ' }), 'conduit');
    assert.equal(resolveTotpIssuer({ issuer: ':::\n' }), 'conduit');
  });

  it('uses the configured issuer', () => {
    assert.equal(resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: [] }), 'Acme');
  });

  it('uses an allowlisted client issuer', () => {
    assert.equal(
      resolveTotpIssuer(
        { issuer: 'conduit', allowedIssuers: ['Acme Mobile'] },
        'Acme Mobile',
      ),
      'Acme Mobile',
    );
  });

  it('ignores a client issuer that is not allowlisted', () => {
    assert.equal(
      resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: ['Acme Mobile'] }, 'Other App'),
      'Acme',
    );
    assert.equal(
      resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: [] }, 'Acme'),
      'Acme',
    );
    assert.equal(
      resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: ['Acme'] }, ' Acme '),
      'Acme',
    );
  });

  it('sanitizes the issuer used in the otpauth URI', () => {
    assert.equal(sanitizeTotpIssuer('  Acme:Corp\n'), 'AcmeCorp');
    assert.equal(sanitizeTotpIssuer('\u0000\u0007\u007f\u0085Acme'), 'Acme');
    assert.equal(sanitizeTotpIssuer('A'.repeat(80)).length, TOTP_ISSUER_MAX_LENGTH);
    assert.equal(sanitizeTotpIssuer('A'.repeat(80)), 'A'.repeat(TOTP_ISSUER_MAX_LENGTH));

    assert.equal(resolveTotpIssuer({ issuer: '  Acme: Corp\t' }), 'Acme Corp');
    assert.equal(
      resolveTotpIssuer(
        { issuer: 'conduit', allowedIssuers: ['  Foo:Bar\t'] },
        '  Foo:Bar\t',
      ),
      'FooBar',
    );
    assert.equal(
      resolveTotpIssuer({ issuer: 'conduit', allowedIssuers: [':\n\t'] }, ':\n\t'),
      'conduit',
    );
  });

  it('url-encodes the issuer in the otpauth label prefix and issuer parameter', async () => {
    const issuer = resolveTotpIssuer({ issuer: '  Acme: Corp/R&D\n' });
    assert.equal(issuer, 'Acme Corp/R&D');
    const encoded = encodeURIComponent(issuer);
    const { uri } = await generateSecret({
      name: issuer,
      account: 'user@example.com',
    });
    assert.equal(encoded, 'Acme%20Corp%2FR%26D');
    assert.ok(
      uri.startsWith(`otpauth://totp/${encoded}`),
      `label prefix missing from ${uri}`,
    );
    assert.ok(uri.includes(`&issuer=${encoded}`), `issuer param missing from ${uri}`);
  });
});

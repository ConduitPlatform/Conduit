const cookieOptions = {
  httpOnly: {
    format: 'Boolean',
    default: true,
  },
  secure: {
    format: 'Boolean',
    default: false,
  },
  signed: {
    format: 'Boolean',
    default: false,
  },
  domain: {
    format: 'String',
    default: '',
  },
  path: {
    format: 'String',
    default: '',
  },
  sameSite: {
    format: 'String',
    default: 'Lax',
  },
};

export default {
  clients: {
    multipleUserSessions: {
      doc: 'Defines if a user can login multiple times from a single client',
      format: 'Boolean',
      default: false,
    },
    multipleClientLogins: {
      doc: 'Defines if a user can be logged in from multiple clients',
      format: 'Boolean',
      default: true,
    },
  },

  accessTokens: {
    jwtSecret: {
      doc: 'The secret to use when generating an access token. Generated on first configure when empty.',
      format: 'String',
      default: '',
    },
    mode: {
      doc: "Access token mode: 'session' (opaque-registry backed, one AccessToken row per token) or 'jwt' (stateless signed tokens; requires a 60000..300000 ms expiryPeriod).",
      format: 'String',
      enum: ['session', 'jwt'],
      default: 'session',
    },
    strictRevocation: {
      doc: 'In jwt mode, every request also checks the session registry, so logout is immediate.',
      format: 'Boolean',
      default: false,
    },
    tokenVersion: {
      doc: 'Bumped on a mode switch; tokens issued with an older version are rejected.',
      format: 'Number',
      default: 1,
    },
    signing: {
      kid: {
        doc: 'Id of the current signing key. Generated in jwt mode when empty.',
        format: 'String',
        default: '',
      },
      publicKey: {
        doc: 'PEM-encoded Ed25519 public key (SPKI) of the current signing key.',
        format: 'String',
        default: '',
      },
      privateKey: {
        doc: 'PEM-encoded Ed25519 private key (PKCS8) of the current signing key.',
        format: 'String',
        default: '',
        sensitive: true,
      },
      previousKid: {
        doc: 'Id of the previous signing key, kept until previousRetiredAt after a rotation.',
        format: 'String',
        default: '',
      },
      previousPublicKey: {
        doc: 'PEM-encoded public key of the previous signing key.',
        format: 'String',
        default: '',
      },
      previousRetiredAt: {
        doc: 'Absolute ms epoch after which the previous signing key is no longer accepted. 0 = none.',
        format: 'Number',
        default: 0,
      },
    },
    expiryPeriod: {
      doc: 'How long should the generated access tokens be valid for',
      format: 'Number',
      // 1 hour
      default: 3600000,
    },
    setCookie: {
      format: 'Boolean',
      default: false,
    },
    cookieOptions,
  },
  refreshTokens: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
    expiryPeriod: {
      doc: 'How long should the generated refresh tokens be valid for',
      format: 'Number',
      // 1 week
      default: 86400000 * 7,
    },
    extendable: {
      doc: 'Whether refresh tokens can be extended through POST /renew/extend.',
      format: 'Boolean',
      default: true,
    },
    maxLifetime: {
      doc: 'Absolute cap on a refresh token lifetime, counted from its original issue. Extension never passes it.',
      format: 'Number',
      // 30 days
      default: 86400000 * 30,
    },
    setCookie: {
      format: 'Boolean',
      default: false,
    },
    cookieOptions,
  },
};

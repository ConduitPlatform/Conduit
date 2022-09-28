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
  cookieOptions: {
    httpOnly: {
      format: 'Boolean',
      default: false,
    },
    secure: {
      format: 'Boolean',
      default: false,
    },
    signed: {
      format: 'Boolean',
      default: false,
    },
    maxAge: {
      format: 'Number',
      default: 900000,
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
  },
  accessTokens: {
    jwtSecret: {
      doc: 'The secret to use when generating an access token',
      format: 'String',
      default: 'S3CR3T',
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
    cookieOptions: {
      httpOnly: {
        format: 'Boolean',
        default: false,
      },
      secure: {
        format: 'Boolean',
        default: false,
      },
      signed: {
        format: 'Boolean',
        default: false,
      },
      maxAge: {
        format: 'Number',
        default: 900000,
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
    },
  },
  refreshTokens: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
    setCookie: {
      format: 'Boolean',
      default: false,
    },
    cookieOptions: {
      httpOnly: {
        format: 'Boolean',
        default: false,
      },
      secure: {
        format: 'Boolean',
        default: false,
      },
      signed: {
        format: 'Boolean',
        default: false,
      },
      maxAge: {
        format: 'Number',
        default: 900000,
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
    },
    expiryPeriod: {
      doc: 'How long should the generated refresh tokens be valid for',
      format: 'Number',
      // 1 week
      default: 86400000 * 7,
    },
  },
};

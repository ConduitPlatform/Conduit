export default {
  active: {
    format: 'Boolean',
    default: true,
  },
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
  local: {
    enabled: {
      doc: 'Defines if this strategy is active or not',
      format: 'Boolean',
      default: true,
    },
    verification: {
      required: {
        doc: 'Defines if email verification is required for login',
        format: 'Boolean',
        default: false,
      },
      send_email: {
        doc: 'Defines if the authenticator should automatically send a verification e-mail to the user',
        format: 'Boolean',
        default: false,
      },
      redirect_uri: {
        format: 'String',
        default: '',
      },
    },
    forgot_password_redirect_uri: {
      format: 'String',
      default: '',
    },
  },
  google: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'The client id that is provided by google developer console for a specific app',
      format: 'String',
      default: '',
      nullable: true,
    },
    clientSecret: {
      format: 'String',
      default: '',
      optional: true,
    },
    redirect_uri: {
      format: 'String',
      default: '',
      optional: true,
    },
    accountLinking: {
      doc: 'When enabled, if a new google user matches with an existing email on the database, they will be enriched with google details',
      format: 'Boolean',
      default: true,
    },
  },
  passwordless_login: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    redirect_uri: {
      format: 'String',
      default: '',
      optional: true,
    },
  },
  facebook: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'Facebook client id',
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
      optional: true,
    },
    redirect_uri: {
      format: 'String',
      default: '',
      optional: true,
    },
    accountLinking: {
      doc: 'When enabled, if a new github user matches with an existing email on the database, they will be enriched with github details',
      format: 'Boolean',
      default: true,
    },
  },
  github: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'Github client id',
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
      optional: true,
    },
    redirect_uri: {
      format: 'String',
      default: '',
      optional: true,
    },
    accountLinking: {
      doc: 'When enabled, if a new github user matches with an existing email on the database, they will be enriched with github details',
      format: 'Boolean',
      default: true,
    },
  },
  slack: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
    },
    redirect_uri: {
      format: 'String',
      default: '',
    },
    accountLinking: {
      doc: 'When enabled, if a new slack user matches with an existing email on the database, they will be enriched with slack details',
      format: 'Boolean',
      default: true,
    },
  },
  figma: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
    },
    redirect_uri: {
      format: 'String',
      default: '',
    },
    accountLinking: {
      doc: 'When enabled, if a new figma user matches with an existing email on the database, they will be enriched with figma details',
      format: 'Boolean',
      default: true,
    },
  },
  microsoft: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
    },
    redirect_uri: {
      format: 'String',
      default: '',
    },
    accountLinking: {
      doc: 'When enabled, if a new microsoft user matches with an existing email on the database, they will be enriched with microsoft details',
      format: 'Boolean',
      default: true,
    },
  },
  twitch: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
    },
    redirect_uri: {
      format: 'String',
      default: '',
    },
    accountLinking: {
      doc: 'When enabled, if a new twitch user matches with an existing email on the database, they will be enriched with twitch details',
      format: 'Boolean',
      default: true,
    },
  },
  service: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
  },
  twofa: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
  phoneAuthentication: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
  setCookies: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    options: {
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
  generateRefreshToken: {
    doc: 'If the module should generate refresh tokens along with the access tokens',
    format: 'Boolean',
    default: false,
  },
  rateLimit: {
    doc: 'If the module should limit the authentication tries/requests by clients',
    format: 'Number',
    default: 3,
  },
  tokenInvalidationPeriod: {
    doc: 'How long should the generated access tokens be valid for',
    format: 'Number',
    default: 86400000,
  },
  refreshTokenInvalidationPeriod: {
    doc: 'How long should the generated refresh tokens be valid for',
    format: 'Number',
    default: 86400000 * 7,
  },
  jwtSecret: {
    doc: 'The secret to use when generating an access token',
    format: 'String',
    default: 'S3CR3T',
  },
};

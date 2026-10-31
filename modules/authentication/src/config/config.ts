export default {
  active: {
    format: 'Boolean',
    default: true,
  },
  twoFa: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    methods: {
      sms: {
        format: 'Boolean',
        default: false,
      },
      authenticator: {
        format: 'Boolean',
        default: true,
      },
    },
    issuer: {
      doc: 'Issuer shown in authenticator apps when a user enables TOTP. Used as the otpauth label prefix and issuer parameter.',
      format: 'String',
      default: 'Conduit',
    },
    allowedIssuers: {
      doc: 'Issuer names a client may request on the 2FA enable route. Any other requested issuer is rejected, so an empty list rejects every client-supplied issuer.',
      format: 'Array',
      children: {
        format: 'String',
      },
      default: [],
    },
    backUpCodes: {
      enabled: {
        format: 'Boolean',
        default: true,
      },
    },
  },
  phoneAuthentication: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
  biometricAuthentication: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
  },
  captcha: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    routes: {
      login: {
        format: 'Boolean',
        default: false,
      },
      register: {
        format: 'Boolean',
        default: false,
      },
      oAuth2: {
        format: 'Boolean',
        default: false,
      },
    },
    acceptablePlatform: {
      android: {
        format: 'Boolean',
        default: false,
      },
      web: {
        format: 'Boolean',
        default: true,
      },
    },
  },
  redirectUris: {
    allowAny: {
      format: 'Boolean',
      default: false,
    },
    whitelistedUris: {
      format: 'Array',
      children: {
        format: 'String',
      },
      default: [],
    },
  },
  anonymousUsers: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
};

export default {
  active: {
    format: 'Boolean',
    default: true,
  },
  service: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
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
  username: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
};

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
  captcha: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    provider: {
      format: 'String',
      default: 'recaptcha',
      enum: ['recaptcha', 'hcaptcha'],
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
    secretKey: {
      format: 'String',
      default: '',
    },
  },
};

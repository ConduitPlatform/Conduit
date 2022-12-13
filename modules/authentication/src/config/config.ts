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
    },
    recaptcha: {
      active: {
        format: 'Boolean',
        default: false,
      },
      secretKey: {
        format: 'String',
        default: '',
      },
    },
    hcaptcha: {
      active: {
        format: 'Boolean',
        default: false,
      },
      secretKey: {
        format: 'String',
        default: '',
      },
    },
  },
};

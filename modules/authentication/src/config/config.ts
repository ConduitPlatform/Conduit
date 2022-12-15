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
    platform: {
      format: 'String',
      default: 'anonymous-client',
    },
    secretKey: {
      format: 'String',
      default: '',
    },
  },
};

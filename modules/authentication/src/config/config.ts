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
  phoneAuthentication: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
};

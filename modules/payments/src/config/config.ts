export default {
  doc: 'Options for conduit payments provider',
  active: {
    format: 'Boolean',
    default: false,
  },
  stripe: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    secret_key: {
      format: 'String',
      default: null,
      nullable: true,
    },
  },
  iamport: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    api_key: {
      format: 'String',
      default: null,
      nullable: true,
    },
    secret_key: {
      format: 'String',
      default: null,
      nullable: true,
    },
  },
};

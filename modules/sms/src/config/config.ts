export default {
  doc: 'The options for the conduit sms provider',
  active: {
    format: 'Boolean',
    default: false,
  },
  providerName: {
    format: 'String',
    default: 'twilio',
  },
  twilio: {
    phoneNumber: {
      format: 'String',
      default: null,
      nullable: true,
    },
    accountSID: {
      format: 'String',
      default: null,
      nullable: true,
    },
    authToken: {
      format: 'String',
      default: null,
      nullable: true,
    },
    verify: {
      active: {
        format: 'Boolean',
        default: false,
      },
      serviceSid: {
        format: 'String',
        default: null,
        nullable: true,
      },
    },
  },
};

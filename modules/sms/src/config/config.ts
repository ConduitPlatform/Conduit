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
      default: undefined,
    },
    accountSID: {
      format: 'String',
      default: undefined,
    },
    authToken: {
      format: 'String',
      default: undefined,
    },
    verify: {
      active: {
        format: 'Boolean',
        default: false,
      },
      serviceSid: {
        format: 'String',
        default: undefined,
      },
    },
  },
};

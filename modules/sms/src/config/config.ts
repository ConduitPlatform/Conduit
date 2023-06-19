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
      default: '',
    },
    accountSID: {
      format: 'String',
      default: '',
    },
    authToken: {
      format: 'String',
      default: '',
    },
    verify: {
      active: {
        format: 'Boolean',
        default: false,
      },
      serviceSid: {
        format: 'String',
        default: '',
      },
    },
  },
  AwsSns: {
    region: {
      format: 'String',
      default: '',
    },
    accessKeyId: {
      format: 'String',
      default: '',
    },
    secretAccessKey: {
      format: 'String',
      default: '',
    },
  },
  messageBird: {
    accessKeyId: {
      format: 'String',
      default: '',
    },
    originatorName: {
      format: 'String',
      default: '',
    },
  },
  clickSend: {
    username: {
      format: 'String',
      default: '',
    },
    clicksendApiKey: {
      format: 'String',
      default: '',
    },
  },
};

export default {
  active: {
    format: 'Boolean',
    default: false,
  },
  providerName: {
    format: 'String',
    default: 'firebase',
  },
  firebase: {
    projectId: {
      format: 'String',
      default: '',
    },
    privateKey: {
      format: 'String',
      default: '',
    },
    clientEmail: {
      format: 'String',
      default: '',
    },
  },
  onesignal: {
    appId: {
      format: 'String',
      default: '',
    },
    apiKey: {
      format: 'String',
      default: '',
    },
  },
};

export default {
  push: {
    providerName: {
      format: 'String',
      default: 'basic',
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
  },
};

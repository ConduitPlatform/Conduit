export default {
  active: {
    format: 'Boolean',
    default: true,
  },
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
  sns: {
    accessKeyId: {
      format: 'String',
      default: '',
    },
    secretAccessKey: {
      format: 'String',
      default: '',
    },
    region: {
      format: 'String',
      default: '',
    },
    platformApplications: {
      format: 'Object',
      default: {},
    },
  },
  brevo: {
    accessToken: {
      format: 'String',
      default: '',
    },
    apiUrl: {
      format: 'String',
      default: '',
    },
  },
  pushowl: {
    apiKey: {
      format: 'String',
      default: '',
    },
    endpoint: {
      format: 'String',
      default: '',
    },
  },
};

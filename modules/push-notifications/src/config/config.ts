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
      default: 'project-id',
    },
    privateKey: {
      format: 'String',
      default: 'private-key',
    },
    clientEmail: {
      format: 'String',
      default: 'client-email',
    },
  },
};

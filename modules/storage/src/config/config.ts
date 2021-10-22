export default {
  active: {
    type: Boolean,
    default: false,
  },
  provider: {
    type: String,
    default: 'local',
  },
  storagePath: {
    type: String,
    default: '/var/tmp',
  },
  defaultContainer: {
    type: String,
    default: 'conduit',
  },
  allowContainerCreation: {
    type: Boolean,
    default: true,
  },
  google: {
    serviceAccountKeyPath: {
      type: String,
      default: '',
    },
  },
  azure: {
    connectionString: { type: String, default: '' },
  },
};

export default {
  active: {
    type: Boolean,
    default: false,
  },
  provider: {
    type: String,
    default: 'local',
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
  aws: {
    region: {
      type: String,
      default: '',
    },
    accessKeyId: {
      type: String,
      default: '',
    },
    secretAccessKey: {
      type: String,
      default: '',
    },
    accountId: {
      type: String,
      default: '',
    },
  },
  local: {
    storagePath: {
      type: String,
      default: '/var/tmp',
    },
  },
};

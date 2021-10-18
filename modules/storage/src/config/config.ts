export default {
  active: {
    type: Boolean,
    default: true,
  },
  provider: {
    type: String,
    default: 'local',
  },
  storagePath: {
    type: String,
    default: '/var/tmp',
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

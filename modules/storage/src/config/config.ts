export default {
  active: {
    format: 'Boolean',
    default: false,
  },
  provider: {
    format: 'String',
    default: 'local',
  },
  defaultContainer: {
    format: 'String',
    default: 'conduit',
  },
  allowContainerCreation: {
    format: 'Boolean',
    default: true,
  },
  google: {
    serviceAccountKeyPath: {
      format: 'String',
      default: '',
    },
  },
  azure: {
    connectionString: { format: 'String', default: '' },
  },
  aws: {
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
    accountId: {
      format: 'String',
      default: '',
    },
    endpoint: {
      format: 'String',
      default: '',
    },
  },
  aliyun: {
    region: {
      format: 'String',
      default: '',
    },
    accessKeyId: {
      format: 'String',
      default: '',
    },
    accessKeySecret: {
      format: 'String',
      default: '',
    },
  },
  local: {
    storagePath: {
      format: 'String',
      default: '/var/tmp',
    },
  },
};

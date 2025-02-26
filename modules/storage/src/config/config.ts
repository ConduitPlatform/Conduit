export default {
  active: {
    format: 'Boolean',
    default: false,
  },
  provider: {
    format: 'String',
    default: 'local',
  },
  authorization: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
  defaultContainer: {
    format: 'String',
    default: 'conduit',
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
  suffixOnNameConflict: {
    format: 'Boolean',
    doc: 'Defines if a suffix should be appended to the name of a file, upon creation, when name already exists',
    default: false,
  },
};

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
    usePathStyle: {
      description:
        'Use path style addressing for S3 buckets (only for non-AWS S3 compatible providers)',
      format: 'Boolean',
      default: true,
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
  /**
   * cdnConfiguration: {
   *   my_container: 'cdn.myhost.com'
   * }
   * Maps container names to their CDN host (single CDN per container)
   */
  cdnConfiguration: {
    format: 'Object',
    doc: 'Defines CDN host for each container (single CDN URL per container)',
    default: {},
  },
};

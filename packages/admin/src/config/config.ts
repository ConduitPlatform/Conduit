export default {
  auth: {
    tokenSecret: {
      type: 'String',
      default: '', // to be generated in set config
    },
    hashRounds: {
      type: 'Number',
      default: 11,
    },
    tokenExpirationTime: {
      type: 'Number',
      default: 72000,
    },
  },
  cors: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
    origin: {
      format: 'String',
      default: '*',
    },
    methods: {
      format: 'String',
      default: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    },
    allowedHeaders: {
      format: 'String',
      default: 'Content-Type,Authorization,Cache-Control',
    },
    exposedHeaders: {
      format: 'String',
      default: 'Content-Type,Authorization,Cache-Control',
    },
    credentials: {
      format: 'Boolean',
      default: true,
    },
    maxAge: {
      format: 'Number',
      default: 86400,
    },
  },
  hostUrl: {
    // set initial value with __DEFAULT_HOST_URL, defaults to http://localhost:(ADMIN_HTTP_PORT ?? 3030)
    type: 'String',
    default: '',
  },
  transports: {
    rest: {
      type: 'Boolean',
      default: true,
    },
    graphql: {
      type: 'Boolean',
      default: false,
    },
    sockets: {
      type: 'Boolean',
      default: false,
    },
    proxy: {
      format: 'Boolean',
      default: true,
    },
  },
};

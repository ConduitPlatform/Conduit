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

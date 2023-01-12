export default {
  hostUrl: {
    // set initial value with __DEFAULT_HOST_URL, defaults to http://localhost:(CLIENT_HTTP_PORT ?? 3000)
    format: 'String',
    default: '',
  },
  transports: {
    rest: {
      format: 'Boolean',
      default: true,
    },
    graphql: {
      format: 'Boolean',
      default: true,
    },
    sockets: {
      format: 'Boolean',
      default: true,
    },
    proxy: {
      format: 'Boolean',
      default: true,
    },
  },
  security: {
    clientValidation: {
      format: 'Boolean',
      default: false,
    },
  },
};

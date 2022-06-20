export default {
  hostUrl: {
    format: 'String',
    default: 'http://localhost:3000',
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
  },
  security: {
    clientValidation: {
      enabled: {
        format: 'Boolean',
        default: false,
      },
    },
  },
};

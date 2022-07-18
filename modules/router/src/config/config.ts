export default {
  hostUrl: {
    format: 'String',
    default: '', //to be generated on initial configuration
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
      format: 'Boolean',
      default: false,
    },
  },
};

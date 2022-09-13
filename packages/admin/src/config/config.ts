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
  twofa: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
  },
  hostUrl: {
    type: 'String',
    default: '', // to be generated in set config
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
  },
};

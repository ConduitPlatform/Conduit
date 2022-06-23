export default {
  auth: {
    tokenSecret: {
      type: 'String',
      default: 'fjeinqgwenf',
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
    type: 'String',
    default: 'http://localhost:3030',
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

export default {
  env: {
    format: String,
    default: 'development',
    enum: ['production', 'development', 'test'],
  },
  hostUrl: {
    type: String,
    default: 'http://localhost:3000',
  },
  transports: {
    rest: {
      enabled: {
        type: Boolean,
        default: true,
      },
    },
    graphql: {
      enabled: {
        type: Boolean,
        default: true,
      },
    },
  },
  port: {
    type: Number,
    default: 8080,
  },
};

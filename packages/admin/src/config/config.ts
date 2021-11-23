export default {
  auth: {
    tokenSecret: {
      type: String,
      default: 'fjeinqgwenf',
    },
    hashRounds: {
      type: Number,
      default: 11,
    },
    tokenExpirationTime: {
      type: Number,
      default: 72000,
    },
  },
};

export default {
  admin: {
    auth: {
      tokenSecret: {
        doc: 'The secret to be used to sing the admin tokens',
        format: 'String',
        default: 'fjeinqgwenf'
      },
      hashRounds: {
        doc: 'The hash rounds to be used for bcrypt when hashing admin password',
        format: 'Number',
        default: 11
      },
      tokenExpirationTime: {
        doc: 'Milliseconds after which the admin tokens expire',
        format: 'Number',
        default: 21600
      },
      masterkey: {
        doc: 'The key that admin users need to have to interact with the admin service',
        format: 'String',
        default: 'M4ST3RK3Y'
      }
    }
  }
};

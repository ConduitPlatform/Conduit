import { TYPE } from '@conduit/sdk';

export default {
  admin: {
    auth: {
      tokenSecret: {
        type: TYPE.String,
        default: 'fjeinqgwenf',
        systemRequired: true
      },
      hashRounds: {
        type: TYPE.Number,
        default: 11,
        systemRequired: true
      },
      tokenExpirationTime: {
        type: TYPE.Number,
        default: 21600,
        systemRequired: true
      },
      masterkey: {
        type: TYPE.String,
        default: 'M4ST3RK3Y',
        systemRequired: true
      }
    }
  }
};

import { TYPE } from '@conduit/grpc-sdk';

export default {
  storage: {
    default: {active: true},
    type: {
      active: {
        type: TYPE.Boolean,
        default: true
      },
      provider: {
        type: TYPE.String,
        default: 'local'
      },
      storagePath: {
        type: TYPE.String,
        default: '/var/tmp'
      },
      google: {
        serviceAccountKeyPath: {
          type: TYPE.String,
          default: '~/google_storage_service_account.json'
        },
        bucketName: {
          type: TYPE.String,
          default: 'conduit'
        }
      }
    }
  },
}

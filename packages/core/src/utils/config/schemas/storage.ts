export default {
  storage: {
    doc: 'The config of the storage module',
    active: {
      format: 'Boolean',
      default: true
    },
    provider: {
      doc: 'The provider to use for storage',
      format: 'String',
      default: 'local'
    },
    storagePath: {
      doc: 'The path used for local storage',
      format: 'String',
      default: '/var/tmp'
    },
    google: {
      doc: 'The config for the google storage provider',
      serviceAccountKeyPath: {
        doc: 'The path to the service account key',
        format: 'String',
        default: '~/google_storage_service_account.json'
      },
      bucketName: {
        doc: 'The name of the storage bucket',
        format: 'String',
        default: 'conduit'
      }
    }
  },
};

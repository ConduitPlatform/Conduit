export default {
    active: {
        type: Boolean,
        default: true
    },
    provider: {
        type: String,
        default: 'local'
    },
    storagePath: {
        type: String,
        default: '/var/tmp'
    },
    google: {
        serviceAccountKeyPath: {
            type: String,
            default: '~/google_storage_service_account.json'
        },
        bucketName: {
            type: String,
            default: 'conduit'
        }
    }
}

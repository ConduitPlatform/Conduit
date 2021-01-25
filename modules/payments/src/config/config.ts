export default {
    doc: 'Options for conduit payments provider',
    active: {
        format: 'Boolean',
        default: false
    },
    providerName: {
        format: 'String',
        default: 'stripe'
    },
    stripe: {
        publishable_key: {
            format: 'String',
            default: undefined
        },
        secret_key: {
            format: 'String',
            default: undefined
        }
    }
}
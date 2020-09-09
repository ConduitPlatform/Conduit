export default {

    active: {
        format: 'Boolean',
        default: true
    },
    local: {
        identifier: {
            doc: 'The field name to use for id for a user logging in with local strategy ex. email/username',
            format: 'String',
            default: 'email'
        },
        enabled: {
            doc: 'Defines if this strategy is active or not',
            format: 'Boolean',
            default: true
        },
        sendVerificationEmail: {
            doc: 'Defines if the authenticator should automatically send a verification e-mail to the user',
            format: 'Boolean',
            default: true
        },
        verificationRequired: {
            doc: 'Defines if email verification is required for login',
            format: 'Boolean',
            default: true
        }
    },
    google: {
        enabled: {
            format: 'Boolean',
            default: false
        },
        clientId: {
            doc: 'The client id that is provided by google developer console for a specific app',
            format: 'String',
            default: '407408718192.apps.googleusercontent.com'
        },
        accountLinking: {
            doc: 'When enabled, if a new google user matches with an existing email on the database, they will be enriched with google details',
            format: 'Boolean',
            default: true
        }
    },
    facebook: {
        enabled: {
            format: 'Boolean',
            default: false
        },
        clientId: {
            doc: 'Facebook client id',
            format: 'String',
            default: ''
        },
        accountLinking: {
            doc: 'When enabled, if a new facebook user matches with an existing email on the database, they will be enriched with facebook details',
            format: 'Boolean',
            default: true
        }
    },
    generateRefreshToken: {
        doc: 'If the module should generate refresh tokens along with the access tokens',
        format: 'Boolean',
        default: false
    },
    rateLimit: {
        doc: 'If the module should limit the authentication tries/requests by clients',
        format: 'Number',
        default: 3
    },
    tokenInvalidationPeriod: {
        doc: 'How long should the generated access tokens be valid for',
        format: 'Number',
        default: 86400000
    },
    refreshTokenInvalidationPeriod: {
        doc: 'How long should the generated refresh tokens be valid for',
        format: 'Number',
        default: 86400000 * 7
    },
    jwtSecret: {
        doc: 'The secret to use when generating an access token',
        format: 'String',
        default: 'S3CR3T'
    }
};

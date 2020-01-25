module.exports = {
    env: {
        doc: 'The application environment.',
        format: [
            'production',
            'development',
            'test'
        ],
        default: 'development',
        env: 'NODE_ENV'
    },
    mongoConnection: {
        doc: 'The connection string for MongoDB',
        format: "String",
        default: 'mongodb://localhost:27017,localhost:27018,localhost:27019/Parse?replicaSet=rs',
        env: 'MONGO_CONNECTION_STRING'
    },
    port: {
        doc: 'The port to bind.',
        format: 'port',
        default: 8080,
        env: 'PORT',
        arg: 'port'
    },
    authentication: {
        local: {
            identifier: {
                doc: 'The field name to use for id for a user logging in with local strategy ex. email/username',
                format: 'String',
                default: 'email'
            },
            active: {
                doc: 'Defines if this strategy is active or not',
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
            default: ''
        }
    }
};

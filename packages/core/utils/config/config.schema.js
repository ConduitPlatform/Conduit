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
    database: {
        doc: 'The connection details for Prisma',
        type: {
            format: "String",
            default: 'mongodb'
        },
        databaseURL: {
            format: "String",
            default: 'mongodb://localhost:27017/conduit'
        }
    },
    hostUrl: {
        doc: 'The base host url',
        format: 'String',
        default: 'http://localhost:3000'
    },
    transports: {
        rest: {
            enabled: {
                doc: 'If the REST API should be enabled -this does not affect admin endpoints',
                format: 'Boolean',
                default: true
            }
        },
        graphql: {
            enabled: {
                doc: 'If the GraphQL API should be enabled -this does not affect admin endpoints',
                format: 'Boolean',
                default: true
            }
        }
    },
    email: {
        doc: 'The options for the conduit email provider',
        transport: {
            format: 'String',
            default: 'smtp'
        },
        transportSettings: {
            doc: 'The settings for the transport',
            apiKey: {
                doc: 'The email service API key',
                format: 'String',
                default: 'nadda'
            },
            domain: {
                doc: 'The domain for the emails',
                format: 'String',
                default: '***REMOVED***'
            },
            host: {
                doc: 'The host for email service',
                format: 'String',
                default: undefined
            },
            proxy: {
                doc: 'The email proxy',
                format: 'String',
                default: undefined
            },
            smtp: {
                doc: 'The SMTP transport settings',
                port: {
                    doc: 'The port the SMTP server is listening on',
                    format: 'Number',
                    default: undefined
                },
                host: {
                    doc: 'The SMTP server address',
                    format: 'String',
                    default: undefined
                },
                auth: {
                    doc: 'The SMTP server auth details',
                    username: {
                        format: 'String',
                        default: undefined
                    },
                    password: {
                        format: 'String',
                        default: undefined
                    },
                    method: {
                        format: 'String',
                        default: undefined
                    }
                }
            }
        }
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
    },
};

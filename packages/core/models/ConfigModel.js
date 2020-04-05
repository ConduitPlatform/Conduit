const ConduitSchema = require("@conduit/sdk").ConduitSchema;
const ConduitTypes = require("@conduit/sdk").TYPE;


module.exports = new ConduitSchema(
    'Config', {
        hostUrl: {
            type: ConduitTypes.String,
            default: 'http://localhost:3000'
        },
        authentication: {
            local: {
                identifier: {
                    type: ConduitTypes.String,
                    default: 'email',
                },
                active: {
                    type: ConduitTypes.Boolean,
                    default: true
                },
                sendVerificationEmail: {
                    type: ConduitTypes.Boolean,
                    default: true
                },
                verificationRequired: {
                    type: ConduitTypes.Boolean,
                    default: true
                },
                passwordResetHost: {
                    type: ConduitTypes.String,
                    default: 'http://localhost:3000/authentication/reset-password/'
                },
                verifyEmailHost: {
                    type: ConduitTypes.String,
                    default: 'http://localhost:3000/hook/verify-email/'
                }
            },
            google: {
                clientId: {
                    type: ConduitTypes.String
                },
                accountLinking: {
                    type: ConduitTypes.Boolean,
                    default: true
                }
            },
            facebook: {
                clientId: ConduitTypes.String,
                accountLinking: {
                    type: ConduitTypes.Boolean,
                    default: true
                }
            },
            generateRefreshToken: {
                type: ConduitTypes.Boolean,
                default: false
            },
            rateLimit: {
                type: ConduitTypes.Number,
                default: 3
            },
            tokenInvalidationPeriod: {
                type: ConduitTypes.Number,
                default: 86400000
            },
            refreshTokenInvalidationPeriod: {
                type: ConduitTypes.Number,
                default: 86400000 * 7
            },
            jwtSecret: {
                type: ConduitTypes.String,
                default: 'S3CR3T'
            }
        },
        admin: {
            auth: {
                tokenSecret: {
                    type: ConduitTypes.String,
                    default: 'bsvhiuvseh'
                },
                hashRounds: {
                    type: ConduitTypes.Number,
                    default: 11
                },
                tokenExpirationTime: {
                    type: ConduitTypes.Number,
                    default: 21600
                },
                masterkey: {
                    type: ConduitTypes.String,
                    default: 'M4ST3RK3Y'
                }
            }
        },
        email: {
            transport: ConduitTypes.String,
            transportSettings: {
                apiKey: {
                    type: ConduitTypes.String,
                    default: 'nadda'
                },
                domain: {
                    type: ConduitTypes.String,
                    default: '***REMOVED***'
                },
                proxy: ConduitTypes.String,
                host: ConduitTypes.String
            }
        }
    },
    {
        timestamps: true
    });

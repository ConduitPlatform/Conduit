import { ConduitSchema, TYPE } from '@conduit/sdk';

export const ConfigModel = new ConduitSchema(
  'Config',
  {
    config: {
      inMemoryStore: {
        providerName: {
          type: TYPE.String,
          default: 'local'
        },
        settings: {
          redis: {
            host: {
              type: TYPE.String,
              default: '127.0.0.1'
            },
            port: {
              type: TYPE.Number,
              default: 6379
            },
            password: {
              type: TYPE.String,
              default: 'password'
            },
            url: {
              type: TYPE.String
            },
            path: TYPE.String
          }
        }
      },
      hostUrl: {
        type: TYPE.String,
        default: 'http://localhost:3000'
      },
      authentication: {
        local: {
          identifier: {
            type: TYPE.String,
            default: 'email',
          },
          active: {
            type: TYPE.Boolean,
            default: true
          },
          sendVerificationEmail: {
            type: TYPE.Boolean,
            default: true
          },
          verificationRequired: {
            type: TYPE.Boolean,
            default: true
          },
          passwordResetHost: {
            type: TYPE.String,
            default: 'http://localhost:3000/authentication/reset-password/'
          },
          verifyEmailHost: {
            type: TYPE.String,
            default: 'http://localhost:3000/hook/verify-email/'
          }
        },
        google: {
          clientId: {
            type: TYPE.String
          },
          accountLinking: {
            type: TYPE.Boolean,
            default: true
          },
          active: {
            type: TYPE.Boolean,
            default: false
          }
        },
        facebook: {
          clientId: TYPE.String,
          accountLinking: {
            type: TYPE.Boolean,
            default: true
          },
          active: {
            type: TYPE.Boolean,
            default: false
          }
        },
        generateRefreshToken: {
          type: TYPE.Boolean,
          default: false
        },
        rateLimit: {
          type: TYPE.Number,
          default: 3
        },
        tokenInvalidationPeriod: {
          type: TYPE.Number,
          default: 86400000
        },
        refreshTokenInvalidationPeriod: {
          type: TYPE.Number,
          default: 86400000 * 7
        },
        jwtSecret: {
          type: TYPE.String,
          default: 'S3CR3T'
        }
      },
      storage: {
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
      },
      admin: {
        auth: {
          tokenSecret: {
            type: TYPE.String,
            default: 'bsvhiuvseh'
          },
          hashRounds: {
            type: TYPE.Number,
            default: 11
          },
          tokenExpirationTime: {
            type: TYPE.Number,
            default: 21600
          },
          masterkey: {
            type: TYPE.String,
            default: 'M4ST3RK3Y'
          }
        }
      },
      email: {
        transport: TYPE.String,
        transportSettings: {
          apiKey: {
            type: TYPE.String,
            default: 'nadda'
          },
          domain: {
            type: TYPE.String,
            default: '***REMOVED***'
          },
          proxy: TYPE.String,
          smtp: {
            port: TYPE.Number,
            auth: {
              username: TYPE.String,
              password: TYPE.String,
              method: TYPE.String
            }
          },
          host: TYPE.String
        }
      },
      pushNotifications: {
        providerName: {
          type: TYPE.String,
          default: 'firebase'
        },
        firebase: {
          projectId: {
            type: TYPE.String,
            default: 'project-id'
          },
          privateKey: {
            type: TYPE.String,
            default: 'private-key'
          },
          clientEmail: {
            type: TYPE.String,
            default: 'client-email'
          }
        }
      }
    }
  },
  {
    timestamps: true
  }
);

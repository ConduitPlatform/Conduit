module.exports = {
  name: 'Config',
  modelSchema: {
    config: {
      hostUrl: {
        type: String,
        default: 'http://localhost:3000'
      },
      authentication: {
        local: {
          identifier: {
            type: String,
            default: 'email',
          },
          active: {
            type: Boolean,
            default: true
          },
          sendVerificationEmail: {
            type: Boolean,
            default: true
          },
          verificationRequired: {
            type: Boolean,
            default: true
          },
          passwordResetHost: {
            type: String,
            default: 'http://localhost:3000/authentication/reset-password/'
          },
          verifyEmailHost: {
            type: String,
            default: 'http://localhost:3000/hook/verify-email/'
          }
        },
        google: {
          clientId: {
            type: String
          },
          accountLinking: {
            type: Boolean,
            default: true
          }
        },
        facebook: {
          clientId: String,
          accountLinking: {
            type: Boolean,
            default: true
          }
        },
        generateRefreshToken: {
          type: Boolean,
          default: false
        },
        rateLimit: {
          type: Number,
          default: 3
        },
        tokenInvalidationPeriod: {
          type: Number,
          default: 86400000
        },
        refreshTokenInvalidationPeriod: {
          type: Number,
          default: 86400000 * 7
        },
        jwtSecret: {
          type: String,
          default: 'S3CR3T'
        }
      },
      admin: {
        auth: {
          tokenSecret: {
            type: String,
            default: 'bsvhiuvseh'
          },
          hashRounds: {
            type: Number,
            default: 11
          },
          tokenExpirationTime: {
            type: Number,
            default: 21600
          },
          masterkey: {
            type: String,
            default: 'M4ST3RK3Y'
          }
        }
      },
      email: {
        transport: String,
        transportSettings: {
          apiKey: {
            type: String,
            default: 'nadda'
          },
          domain: {
            type: String,
            default: '***REMOVED***'
          },
          proxy: String,
          host: String
        }
      }
    }
  },
  modelOptions: {
    timestamps: true
  }
};

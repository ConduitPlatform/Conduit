module.exports = {
  name: 'Config',
  modelSchema: {
    config: {
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
      }
    }
  },
  modelOptions: {
    timestamps: true
  }
};

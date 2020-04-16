module.exports = {
  email: {
    doc: 'The options for the conduit email provider',
    active: {
      format: 'Boolean',
      default: false
    },
    transport: {
      format: 'String',
      default: 'smtp'
    },
    transportSettings: {
      doc: 'The settings for the transport',
      apiKey: {
        doc: 'The email service API key',
        format: 'String',
        default: undefined
      },
      domain: {
        doc: 'The domain for the emails',
        format: 'String',
        default: undefined
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
};

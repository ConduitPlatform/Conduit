export default {
  doc: 'The options for the conduit email provider',
  active: {
    format: 'Boolean',
    default: false,
  },
  transport: {
    format: 'String',
    default: 'smtp',
  },
  sendingDomain: {
    format: 'String',
    default: 'conduit.com',
  },
  transportSettings: {
    mailgun: {
      apiKey: {
        doc: 'The email service API key',
        format: 'String',
        default: '',
      },
      domain: {
        doc: 'The domain for the emails',
        format: 'String',
        default: '',
      },
      host: {
        doc: 'The host for email service',
        format: 'String',
        default: '',
      },
      proxy: {
        doc: 'The email proxy',
        format: 'String',
        default: '',
      },
    },
    smtp: {
      port: {
        doc: 'The port the SMTP server is listening on',
        format: 'Number',
        default: -1,
      },
      host: {
        doc: 'The SMTP server address',
        format: 'String',
        default: '',
      },
      auth: {
        username: {
          format: 'String',
          default: '',
        },
        password: {
          format: 'String',
          default: '',
        },
        method: {
          format: 'String',
          default: '',
        },
      },
    },
    mandrill: {
      apiKey: {
        doc: 'The Mandrill API key',
        format: 'String',
        default: '',
      },
    },
    sendgrid: {
      apiKey: {
        doc: 'The SendGrid API key',
        format: 'String',
        default: '',
      },
      apiUser: {
        doc: 'The SendGrid API username',
        format: 'String',
        default: '',
      },
    },
  },
};

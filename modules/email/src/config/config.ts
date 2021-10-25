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
    doc: 'The settings for the transport',
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
        format: '*',
        default: '',
      },
    },
    smtp: {
      doc: 'The SMTP transport settings',
      nullable: true,
      default: null,
      port: {
        doc: 'The port the SMTP server is listening on',
        format: 'Number',
        default: '',
      },
      host: {
        doc: 'The SMTP server address',
        format: 'String',
        default: '',
      },
      auth: {
        doc: 'The SMTP server auth details',
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
      doc: 'The Mandrill config',
      nullable: true,
      default: null,
      apiKey: {
        doc: 'The Mandrill API key',
        format: 'String',
        default: '',
      },
    },
    sendgrid: {
      doc: 'The SendGrid config',
      nullable: true,
      default: null,
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

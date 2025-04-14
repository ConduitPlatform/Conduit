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
      secure: {
        format: 'Boolean',
        default: false,
      },
      ignoreTls: {
        format: 'Boolean',
        default: false,
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
          default: 'PLAIN',
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
      residency: {
        doc: 'Sets the host for sendgrid provider. SendGrid Default: global',
        format: 'String',
        default: 'global',
      },
      apiKey: {
        doc: 'The SendGrid API key',
        format: 'String',
        default: '',
      },
    },
    mailersend: {
      host: {
        doc: 'The email service API host',
        format: 'String',
        default: '',
      },
      port: {
        doc: 'The port the SMTP server is listening on',
        format: 'Number',
        default: '',
      },
      apiKey: {
        doc: 'The email service API key',
        format: 'String',
        default: '',
      },
    },
    amazonSes: {
      region: {
        format: 'String',
        default: '',
        doc: 'The email service API region',
      },
      accessKeyId: {
        format: 'String',
        default: '',
        doc: 'The email service access key identifier',
      },
      secretAccessKey: {
        format: 'String',
        default: '',
        doc: 'The email service secret access key',
      },
    },
  },
  storeEmails: {
    enabled: {
      doc: 'Defines if sent email info should be stored in database',
      format: 'Boolean',
      default: false,
    },
    storage: {
      enabled: {
        doc: 'Defines if email content should be stored in storage',
        format: 'Boolean',
        default: false,
      },
      container: {
        doc: 'The storage container for emails',
        format: 'String',
        default: 'conduit',
      },
      folder: {
        doc: 'The storage folder for emails',
        format: 'String',
        default: 'cnd-stored-emails',
      },
    },
    cleanupSettings: {
      enabled: {
        doc: 'Settings for deleting old stored emails',
        format: 'Boolean',
        default: false,
      },
      repeat: {
        doc: 'Time in milliseconds to repeat the cleanup job',
        format: 'Number',
        default: 6 * 60 * 60 * 1000,
      },
      limit: {
        doc: 'Amount of stored emails to be deleted upon cleanup',
        format: 'Number',
        default: 100,
      },
    },
  },
};

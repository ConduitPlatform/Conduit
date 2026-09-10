export const oauth2Schema = {
  enabled: {
    format: 'Boolean',
    default: false,
  },
  clientId: {
    format: 'String',
    default: '',
    optional: true,
  },
  clientSecret: {
    format: 'String',
    default: '',
    optional: true,
  },
  redirect_uri: {
    format: 'String',
    default: '',
    optional: true,
  },
  accountLinking: {
    doc:
      'When enabled, if a new apple user matches with an existing email on the database, ' +
      'they will be enriched with apple details',
    format: 'Boolean',
    default: true,
  },
};

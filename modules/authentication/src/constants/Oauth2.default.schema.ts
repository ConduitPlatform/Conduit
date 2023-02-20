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
};

export default {
  twitter: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
    },
    redirect_uri: {
      format: 'String',
      default: '',
    },
    accountLinking: {
      doc: 'When enabled, if a new twitter user matches with an existing email on the database, they will be enriched with twitter details',
      format: 'Boolean',
      default: true,
    },
  },
};

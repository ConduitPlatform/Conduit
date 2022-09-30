export default {
  github: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'Github client id',
      format: 'String',
      default: '',
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
      doc: 'When enabled, if a new github user matches with an existing email on the database, they will be enriched with github details',
      format: 'Boolean',
      default: true,
    },
  },
};

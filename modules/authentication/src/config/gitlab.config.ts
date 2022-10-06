export default {
  gitlab: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'Gitlab client id',
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
      doc: 'When enabled, if a new gitlab user matches with an existing email on the database, they will be enriched with gitlab details',
      format: 'Boolean',
      default: true,
    },
  },
};

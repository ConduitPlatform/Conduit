export default {
  facebook: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'Facebook client id',
      format: 'String',
      default: '',
    },
    clientSecret: {
      format: 'String',
      default: '',
      optional: true,
    },
    redirect_uri: {
      doc:
        'Defines the uri that the user will be redirected to,' +
        ' on successful google login, when using the redirect method',
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

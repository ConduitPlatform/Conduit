export default {
  google: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'The client id that is provided by google developer console for a specific app',
      format: 'String',
      default: '',
      nullable: true,
    },
    clientSecret: {
      doc: 'The client secret that is provided by google developer console for a specific app',
      format: 'String',
      default: '',
      optional: true,
    },
    redirect_uri: {
      doc:
        'Defines the uri that the user will be redirected to, ' +
        'on successful google login, when using the redirect method',
      format: 'String',
      default: '',
      optional: true,
    },
    accountLinking: {
      doc:
        'When enabled, if a new google user matches with an existing email on the database, ' +
        'they will be enriched with google details',
      format: 'Boolean',
      default: true,
    },
  },
};

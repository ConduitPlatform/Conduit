export default {
  apple: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    clientId: {
      doc: 'The client id that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
    clientSecret: {
      doc: 'The client secret that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
    redirect_uri: {
      doc:
        'Defines the uri that the user will be redirected to, ' +
        'on successful apple login, when using the redirect method',
      format: 'String',
      default: '',
    },
    accountLinking: {
      doc:
        'When enabled, if a new apple user matches with an existing email on the database, ' +
        'they will be enriched with apple details',
      format: 'Boolean',
      default: true,
    },
  },
};

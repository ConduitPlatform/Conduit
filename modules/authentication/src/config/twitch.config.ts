export default {
  twitch: {
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
      doc: 'When enabled, if a new twitch user matches with an existing email on the database, they will be enriched with twitch details',
      format: 'Boolean',
      default: true,
    },
  },
};

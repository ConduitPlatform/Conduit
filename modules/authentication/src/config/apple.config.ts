import { oauth2Schema } from '../constants';

export default {
  apple: {
    ...oauth2Schema,
    privateKey: {
      doc: 'The private key that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
    teamId: {
      doc: 'The team id that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
    keyId: {
      doc: 'The private key id that is provided by apple developer console for a specific app',
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

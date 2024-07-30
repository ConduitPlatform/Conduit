import { oauth2Schema } from '../constants/index.js';

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
  },
};

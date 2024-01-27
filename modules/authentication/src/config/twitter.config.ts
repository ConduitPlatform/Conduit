import { oauth2Schema } from '../constants/index.js';

export default {
  twitter: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new twitter user matches with an existing email on the database, they will be enriched with twitter details',
      format: 'Boolean',
      default: true,
    },
  },
};

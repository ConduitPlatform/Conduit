import { oauth2Schema } from '../constants';

export default {
  reddit: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new reddit user matches with an existing email on the database, they will be enriched with reddit details',
      format: 'Boolean',
      default: true,
    },
  },
};

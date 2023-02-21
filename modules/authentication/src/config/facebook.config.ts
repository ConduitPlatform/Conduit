import { oauth2Schema } from '../constants';

export default {
  facebook: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new github user matches with an existing email on the database, they will be enriched with github details',
      format: 'Boolean',
      default: true,
    },
  },
};

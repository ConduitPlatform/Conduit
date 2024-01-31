import { oauth2Schema } from '../constants/index.js';

export default {
  slack: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new slack user matches with an existing email on the database, they will be enriched with slack details',
      format: 'Boolean',
      default: true,
    },
  },
};

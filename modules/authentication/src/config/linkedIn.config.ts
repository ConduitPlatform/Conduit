import { oauth2Schema } from '../constants/index.js';

export default {
  linkedin: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new user matches with an existing email on the database, they will be enriched with linkedIn details',
      format: 'Boolean',
      default: true,
    },
  },
};

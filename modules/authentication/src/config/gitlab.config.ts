import { oauth2Schema } from '../constants/index.js';

export default {
  gitlab: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new gitlab user matches with an existing email on the database, they will be enriched with gitlab details',
      format: 'Boolean',
      default: true,
    },
  },
};

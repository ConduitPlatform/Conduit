import { oauth2Schema } from '../constants/index.js';

export default {
  figma: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new figma user matches with an existing email on the database, they will be enriched with figma details',
      format: 'Boolean',
      default: true,
    },
  },
};

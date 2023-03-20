import { oauth2Schema } from '../constants';

export default {
  bitbucket: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new bitbucket user matches with an existing email on the database, they will be enriched with bitbucket details',
      format: 'Boolean',
      default: true,
    },
  },
};

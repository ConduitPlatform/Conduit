import { oauth2Schema } from '../constants';

export default {
  google: {
    ...oauth2Schema,
    accountLinking: {
      doc:
        'When enabled, if a new google user matches with an existing email on the database, ' +
        'they will be enriched with google details',
      format: 'Boolean',
      default: true,
    },
  },
};

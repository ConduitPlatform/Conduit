import { oauth2Schema } from '../constants';

export default {
  twitch: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new twitch user matches with an existing email on the database, they will be enriched with twitch details',
      format: 'Boolean',
      default: true,
    },
  },
};

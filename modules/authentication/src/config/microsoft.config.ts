import { oauth2Schema } from '../constants';

export default {
  microsoft: {
    ...oauth2Schema,
    accountLinking: {
      doc: 'When enabled, if a new Microsoft user matches with an existing email on the database, they will be enriched with Microsoft details',
      format: 'Boolean',
      default: true,
    },
    tenantId: {
      doc: 'The tenant id for the Microsoft app. Used ONLY when app is not multi-tenant.',
      format: 'String',
      default: '',
    },
  },
};

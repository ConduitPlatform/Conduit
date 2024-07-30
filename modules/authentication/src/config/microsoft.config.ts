import { oauth2Schema } from '../constants/index.js';

export default {
  microsoft: {
    ...oauth2Schema,
    tenantId: {
      doc: 'The tenant id for the Microsoft app. Used ONLY when app is not multi-tenant.',
      format: 'String',
      default: '',
    },
  },
};

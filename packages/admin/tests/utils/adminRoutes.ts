export const adminRoutes = [
  {
    path: '/config/admin',
    methods: ['GET', 'PATCH'],
  },
  {
    path: '/config/modules',
    methods: ['GET'],
  },
  {
    path: '/database/schemas/owners',
    methods: ['GET'],
  },
  {
    path: '/database/schemas/extensions',
    methods: ['GET'],
  },
  {
    path: '/database/schemas/system',
    methods: ['GET'],
  },
  {
    path: '/database/schemas/{id}',
    methods: ['GET', 'PATCH', 'DELETE'],
  },
  {
    path: '/database/schemas',
    methods: ['GET', 'POST', 'DELETE'],
  },
  {
    path: '/database/schemas/toggle',
    methods: ['POST'],
  },
  {
    path: '/database/schemas/{id}/toggle',
    methods: ['POST'],
  },
  {
    path: '/database/schemas/{schemaId}/extensions',
    methods: ['POST'],
  },
  {
    path: '/database/schemas/{id}/permissions',
    methods: ['PATCH'],
  },
  {
    path: '/database/introspection',
    methods: ['GET', 'POST'],
  },
  {
    path: '/database/introspection/schemas/{id}',
    methods: ['GET'],
  },
  {
    path: '/database/introspection/schemas',
    methods: ['GET'],
  },
  {
    path: '/database/introspection/schemas/finalize',
    methods: ['POST'],
  },
  {
    path: '/database/schemas/{schemaName}/docs/{id}',
    methods: ['GET', 'PUT', 'DELETE'],
  },
  {
    path: '/database/schemas/{schemaName}/query',
    methods: ['POST'],
  },
  {
    path: '/database/schemas/{schemaName}/docs',
    methods: ['POST', 'PUT'],
  },
  {
    path: '/database/schemas/{schemaName}/docs/many',
    methods: ['POST'],
  },
  {
    path: '/database/customEndpoints/schemas',
    methods: ['GET'],
  },
  {
    path: '/database/customEndpoints',
    methods: ['GET', 'POST'],
  },
  {
    path: '/database/customEndpoints/{id}',
    methods: ['PATCH', 'DELETE'],
  },
  {
    path: '/database/schemas/{schemaId}/cms/operation/{operation}/details',
    methods: ['GET'],
  },
  {
    path: '/login',
    methods: ['POST'],
  },
  {
    path: '/admins',
    methods: ['POST', 'GET'],
  },
  {
    path: '/admins/{id}',
    methods: ['GET', 'DELETE'],
  },
  {
    path: '/change-password',
    methods: ['PUT'],
  },
  {
    path: '/ready',
    methods: ['GET'],
  },
  {
    path: '/toggle-twofa',
    methods: ['PUT'],
  },
  {
    path: '/verify-qr-code',
    methods: ['POST'],
  },
  {
    path: '/verify-twofa',
    methods: ['POST'],
  },
  {
    path: '/change-password/{adminId}',
    methods: ['PUT'],
  },
  {
    path: '/config/core',
    methods: ['GET', 'PATCH'],
  },
];

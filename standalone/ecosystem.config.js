module.exports = {
  apps: [
    {
      name: 'core',
      script: './packages/core/dist/bin/www.js',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'database',
      script: './modules/database/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55160',
        SERVICE_URL: '0.0.0.0:55153',
      },
    },
    {
      name: 'router',
      script: './modules/router/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55161',
        SERVICE_URL: '0.0.0.0:55167',
      },
    },
    {
      name: 'authentication',
      script: './modules/authentication/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55162',
        SERVICE_URL: '0.0.0.0:55154',
      },
    },
    {
      name: 'authorization',
      script: './modules/authorization/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55169',
        SERVICE_URL: '0.0.0.0:55177',
      },
    },
    {
      name: 'email',
      script: './modules/email/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55164',
        SERVICE_URL: '0.0.0.0:55155',
      },
    },
    {
      name: 'storage',
      script: './modules/storage/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55168',
        SERVICE_URL: '0.0.0.0:55158',
      },
    },
    {
      name: 'push-notifications',
      script: './modules/push-notifications/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55166',
        SERVICE_URL: '0.0.0.0:55159',
      },
    },
  ],
};

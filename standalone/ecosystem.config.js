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
        GRPC_PORT: '55153',
        SERVICE_URL: '0.0.0.0:55153',
      },
    },
    {
      name: 'router',
      script: './modules/router/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55167',
        SERVICE_URL: '0.0.0.0:55167',
      },
    },
    {
      name: 'authentication',
      script: './modules/authentication/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55154',
        SERVICE_URL: '0.0.0.0:55154',
      },
    },
    {
      name: 'authorization',
      script: './modules/authorization/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55177',
        SERVICE_URL: '0.0.0.0:55177',
      },
    },
    {
      name: 'email',
      script: './modules/email/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55155',
        SERVICE_URL: '0.0.0.0:55155',
      },
    },
    {
      name: 'storage',
      script: './modules/storage/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55158',
        SERVICE_URL: '0.0.0.0:55158',
      },
    },
    {
      name: 'push-notifications',
      script: './modules/push-notifications/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55159',
        SERVICE_URL: '0.0.0.0:55159',
      },
    },
  ],
};

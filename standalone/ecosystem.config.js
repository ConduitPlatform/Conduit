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
      },
    },
    {
      name: 'router',
      script: './modules/router/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55161',
      },
    },
    {
      name: 'authentication',
      script: './modules/authentication/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55162',
      },
    },
    {
      name: 'authorization',
      script: './modules/authorization/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55169',
      },
    },
    {
      name: 'communications',
      script: './modules/communications/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55164',
      },
    },
    {
      name: 'storage',
      script: './modules/storage/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55168',
      },
    },
    {
      name: 'chat',
      script: './modules/chat/dist/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55170',
      },
    },
  ],
};

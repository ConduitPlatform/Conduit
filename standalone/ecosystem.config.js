module.exports = {
  apps: [
    {
      name: 'core',
      script: './packages/core/bundle/index.js',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'database',
      script: './modules/database/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55160',
      },
    },
    {
      name: 'router',
      script: './modules/router/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55161',
      },
    },
    {
      name: 'authentication',
      script: './modules/authentication/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55162',
      },
    },
    {
      name: 'authorization',
      script: './modules/authorization/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55169',
      },
    },
    {
      name: 'communications',
      script: './modules/communications/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55164',
      },
    },
    {
      name: 'storage',
      script: './modules/storage/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55168',
      },
    },
    {
      name: 'chat',
      script: './modules/chat/bundle/index.js',
      env: {
        CONDUIT_SERVER: '0.0.0.0:55152',
        GRPC_PORT: '55170',
      },
    },
  ],
};

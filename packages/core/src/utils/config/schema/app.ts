export default {
  env: {
    doc: 'The application environment.',
    format: [
      'production',
      'development',
      'test'
    ],
    default: 'development',
    env: 'NODE_ENV'
  },
  database: {
    doc: 'The connection details for Prisma',
    type: {
      format: "String",
      default: 'mongodb'
    },
    databaseURL: {
      format: "String",
      default: 'mongodb://localhost:27017/conduit'
    }
  },
  hostUrl: {
    doc: 'The base host url',
    format: 'String',
    default: 'http://localhost:3000'
  },
  transports: {
    rest: {
      enabled: {
        doc: 'If the REST API should be enabled -this does not affect admin endpoints',
        format: 'Boolean',
        default: true
      }
    },
    graphql: {
      enabled: {
        doc: 'If the GraphQL API should be enabled -this does not affect admin endpoints',
        format: 'Boolean',
        default: true
      }
    }
  },
  port: {
    doc: 'The port to bind.',
    format: 'String',
    default: 8080,
    env: 'PORT',
    arg: 'port'
  }
};

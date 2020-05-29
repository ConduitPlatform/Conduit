import { ConduitSchema, TYPE } from '@conduit/sdk';

export default new ConduitSchema('Config', {
    _id: TYPE.ObjectId,
    env: {
        type: TYPE.String,
        default: 'development',
        enum: ['production', 'development', 'test'],
        systemRequired: true,
        // env: 'NODE_ENV'
    },
    database: {
        type: {
            type: TYPE.String,
            default: 'mongodb',
            systemRequired: true
        },
        databaseURL: {
            type: TYPE.String,
            default: 'mongodb://localhost:27017/conduit',
            systemRequired: true
        },
        hostUrl: {
            type: TYPE.String,
            default: 'http://localhost:3000',
            systemRequired: true
    },
    transports: {
        rest: {
            enabled: {
                type: TYPE.Boolean,
                default: true,
                systemRequired: true
            }
        },
        graphql: {
            enabled: {
                type: TYPE.Boolean,
                default: true,
                systemRequired: true
            }
        }
    },
    activatedModules: {
        type: TYPE.JSON,
        default: ['cms', 'storage'],
        systemRequired: true
    },
    port: {
        type: TYPE.Number,
        default: 8080,
        // env: 'PORT',
        // arg: 'port',
        systemRequired: true
    }
    }
}, {systemRequired: true, timestamps: true});

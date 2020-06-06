import {TYPE} from '@conduit/sdk';

export default {
    env: {
        format: String,
        default: 'development',
        enum: ['production', 'development', 'test'],
    },
    database: {
        type: {
            type: String,
            default: 'mongodb'
        },
        databaseURL: {
            type: String,
            default: 'mongodb://localhost:27017/conduit'
        },
        hostUrl: {
            type: String,
            default: 'http://localhost:3000'
        },
        transports: {
            rest: {
                enabled: {
                    type: Boolean,
                    default: true,
                }
            },
            graphql: {
                enabled: {
                    type: Boolean,
                    default: true,
                }
            }
        },
        activatedModules: {
            type: TYPE.JSON,
            default: ['cms', 'storage']
        },
        port: {
            type: Number,
            default: 8080
        }
    }
};


module.exports = {
    apps: [{
        name: 'Core',
        script: './packages/core/dist/bin/www.js',
    },
        {
            name: 'Database-provider',
            script: './modules/database-provider/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
                databaseURL: "mongodb://localhost:27017/conduit"
            }
        }, {
            name: 'Storage-provider',
            script: './modules/storage/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
            }
        },
        {
            name: 'email-provider',
            script: './modules/email/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
            }
        },
        {
            name: 'authentication-provider',
            script: './modules/authentication/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
            }
        },
        {
            name: 'in-memory-provider',
            script: './modules/in-memory-store/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
            }
        },
        {
            name: 'push-provider',
            script: './modules/push-notifications/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
            }
        },
        {
            name: 'cms-provider',
            script: './modules/cms/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
            }
        }],
};

module.exports = {
    apps: [{
        name: 'Core',
        script: './packages/core/dist/bin/www.js',
        // watch: '.'
    },
        {
            name: 'Database-provider',
            script: './modules/database-provider/dist/index.js',
            env: {
                CONDUIT_SERVER: "0.0.0.0:55152",
                databaseURL: "mongodb://localhost:27017/conduit"
            }
            // watch: ['./service-worker']
        }],
};

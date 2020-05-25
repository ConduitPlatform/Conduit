module.exports = {
    apps: [{
        name: 'Core',
        script: './packages/core/dist/bin/www.js',
        // watch: '.'
    },
        {
            name: 'Database-provider',
            script: './modules/database-provider/dist/index.js',
            // watch: ['./service-worker']
        }],
};

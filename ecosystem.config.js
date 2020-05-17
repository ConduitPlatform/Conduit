module.exports = {
    apps: [{
        script: './packages/core/dist/bin/www.js',
        // watch: '.'
    },
        {
            script: './modules/database-provider/dist/index.js',
            // watch: ['./service-worker']
        }],
};

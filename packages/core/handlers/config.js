const { isNil, merge } = require('lodash');

async function getConfig(req, res, next) {
    const { conduit } = req.app;
    const { database } = conduit;
    const databaseAdapter = database.getDbAdapter();

    const Config = databaseAdapter.getSchema('Config');

    const config = await Config.findOne({});
    if (isNil(config)) {
        return res.json({});
    }

    return res.json(config.config);
}

async function editConfig(req, res, next) {
    const { conduit } = req.app;
    const { config: appConfig, database } = conduit;
    const databaseAdapter = database.getDbAdapter();

    const Config = databaseAdapter.getSchema('Config');

    const newConfig = req.body;
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
        return res.status(404).json({ error: 'Config not set' });
    }

    const currentConfig = dbConfig.config;

    const final = merge(currentConfig, newConfig);

    dbConfig.config = final;
    const saved = await dbConfig.save();

    appConfig.load(saved.config);

    return res.json(saved.config);
}

module.exports = {
    getConfig,
    editConfig
};

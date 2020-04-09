const {isNil} = require('lodash');

async function configureFromDatabase(database, appConfig) {
    const db = database;

    const config = appConfig;

    let dbConfig = await db.getSchema('Config').findOne({});

    if (isNil(dbConfig)) {
        return db.getSchema('Config').create({config: config.get()});
    }

    config.load(dbConfig.config);
}

module.exports.configureFromDatabase = configureFromDatabase;

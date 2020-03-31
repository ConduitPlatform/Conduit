const configModel = require('./ConfigModel');

async function configureFromDatabase(database){

  database.createSchemaFromAdapter(configModel);
  const db = database.getDbAdapter();
  const configSchema = db.getSchema('Config');


}

module.exports.configureFromDatabase = configureFromDatabase;

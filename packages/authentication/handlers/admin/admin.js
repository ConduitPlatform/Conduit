const { isNil, merge } = require('lodash');

async function getUsersPaginated(req, res, next) {

  const {skip, limit} = req.params;
  if (isNil(skip) || isNil(limit)) {
    return res.status(401).json({error: 'Pagination parameters are missing'});
  }
  const users = await database.getSchema('User').findPaginated(null, Number(skip), Number(limit));
  const totalCount = await database.getSchema('User').countDocuments(null);
  return res.json({users, totalCount});
}

async function editAuthConfig(req, res, next) {

  const { conduit } = req.app;
  const { config: appConfig, database } = conduit;
  const databaseAdapter = database.getDbAdapter();

  const Config = databaseAdapter.getSchema('Config');

  const newAuthConfig = req.body;

  const dbConfig = await Config.findOne({});
  if (isNil(dbConfig)) {
    return res.status(404).json({ error: 'Config not set' });
  }

  const currentAuthConfig = dbConfig.config.authentication;
  const final = merge(currentAuthConfig, newAuthConfig);

  dbConfig.config.authentication = final;
  const saved = await dbConfig.save();
  appConfig.load(saved.config);

  return res.json(saved.config.authentication);
}

module.exports = {
  getUsersPaginated,
  editAuthConfig
};

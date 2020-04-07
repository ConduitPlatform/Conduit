const {isNil} = require('lodash');

async function getTemplates(req, res, next) {
  let { skip, limit } = req.params;
  if (isNil(skip)) skip = 0;
  if (isNil(limit)) limit = 25;

  const emailModel = req.app.conduit.database.getDbAdapter().getSchema('EmailTemplate');
  const templateDocuments = await emailModel.findPaginated({}, Number(skip), Number(limit));
  const totalCount = await emailModel.countDocuments({});

  return res.json({templateDocuments, totalCount});
}

module.exports = {
  getTemplates
};

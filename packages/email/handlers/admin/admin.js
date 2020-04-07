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

async function createTemplate(req, res, next) {
  const { name, subject, body, variables } = req.body;
  if ( isNil(name) || isNil(subject) || isNil(body) || isNil(variables) ) {
    return res.status(401).json({error: 'Required fields are missing'});
  }

  const emailModel = req.app.conduit.database.getDbAdapter().getSchema('EmailTemplate');
  const newTemplate = await emailModel.create({
    name,
    subject,
    body,
    variables
  });

  return res.json({template: newTemplate});
}

async function editTemplate(req, res, next) {

}

module.exports = {
  getTemplates,
  createTemplate,
  editTemplate
};

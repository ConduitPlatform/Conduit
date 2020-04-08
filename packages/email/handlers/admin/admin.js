const {isNil, merge} = require('lodash');
const emailLogic = require('../../logic/email');

async function getTemplates(req, res, next) {

  const {skip, limit} = req.query;
  let skipNumber = 0, limitNumber = 25;

  if (!isNil(skip)) {
    skipNumber = Number.parseInt(skip);
  }
  if (!isNil(limit)) {
    limitNumber = Number.parseInt(limit);
  }

  const emailModel = req.app.conduit.database.getDbAdapter().getSchema('EmailTemplate');
  const templateDocuments = await emailModel.findPaginated({}, skipNumber, limitNumber);
  const totalCount = await emailModel.countDocuments({});

  return res.json({templateDocuments, totalCount});
}

async function createTemplate(req, res, next) {
  const {name, subject, body, variables} = req.body;
  if (isNil(name) || isNil(subject) || isNil(body) || isNil(variables)) {
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
  const id = req.params.id;
  const params = req.body;

  Object.keys(params).forEach(key => {
    if (key !== 'name' && key !== 'subject' && key !== 'body' && key !== 'variables') {
      return res.status(401).json({error: 'Invalid parameters are given'});
    }
  });

  const emailModel = req.app.conduit.database.getDbAdapter().getSchema('EmailTemplate');
  const templateDocument = await emailModel.findOne({_id: id.toString()});
  if (isNil(templateDocument)) {
    return res.status(404).json({error: 'Template not found'});
  }

  Object.keys(params).forEach(key => {
    templateDocument[key] = params[key];
  });

  const updatedTemplateDoc = await templateDocument.save();

  return res.json({updatedTemplate: updatedTemplateDoc});
}

async function sendEmail(req, res, next) {
  const {
    templateName,
    email,
    variables,
    sender } = req.body;
  await emailLogic.sendMail(templateName, {email, variables, sender});
  return res.json({message: 'Email sent'});
}

async function getEmailConfig(req, res, next) {
  const databaseAdapter = req.app.conduit.database.getDbAdapter();

  const Config = databaseAdapter.getSchema('Config');
  const dbConfig = await Config.findOne({});
  if (isNil(dbConfig)) {
    return res.status(404).json({ error: 'Config not set' });
  }
  return res.json(dbConfig.config.email);
}

async function editEmailConfig(req, res, next) {
  const { conduit } = req.app;
  const { config: appConfig, database } = conduit;
  const databaseAdapter = database.getDbAdapter();

  const Config = databaseAdapter.getSchema('Config');

  const newEmailConfig = req.body;

  const dbConfig = await Config.findOne({});
  if (isNil(dbConfig)) {
    return res.status(404).json({ error: 'Config not set' });
  }

  const currentEmailConfig = dbConfig.config.email;
  const final = merge(currentEmailConfig, newEmailConfig);

  dbConfig.config.email = final;
  const saved = await dbConfig.save();
  await appConfig.load(saved.config);

  return res.json(saved.config.email);
}

module.exports = {
  getTemplates,
  createTemplate,
  editTemplate,
  sendEmail,
  getEmailConfig,
  editEmailConfig
};

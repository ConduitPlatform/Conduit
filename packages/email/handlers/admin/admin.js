const {isNil} = require('lodash');
const emailLogic = require('../../logic/email');

async function getTemplates(req, res, next) {
  let {skip, limit} = req.params;
  if (isNil(skip)) skip = 0;
  if (isNil(limit)) limit = 25;

  const emailModel = req.app.conduit.database.getDbAdapter().getSchema('EmailTemplate');
  const templateDocuments = await emailModel.findPaginated({}, Number(skip), Number(limit));
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

module.exports = {
  getTemplates,
  createTemplate,
  editTemplate,
  sendEmail
};

const {isNil} = require('lodash');

let emailer;
let database;

function init(emailerParam, databaseParam) {
  emailer = emailerParam;
  database = databaseParam;
}

async function sendMail(templateName, params) {
  const {
    email,
    variables,
    sender
  } = params;

  if (isNil(emailer)) {
    throw new Error("Module not initialized");
  }

  if (isNil(database)) {
    throw new Error("Database not initialized")
  }


  const builder = emailer.emailBuilder();
  if (isNil(builder)) {
    return;
  }

  if (isNil(templateName)) {
    throw new Error("Cannot send email without a template");
  }

  if (isNil(email)) {
    throw new Error("Cannot send email without receiver");
  }

  if (isNil(sender)) {
    throw new Error("Cannot send email without a sender");
  }

  const template = await database.getSchema('EmailTemplate').findOne({name: templateName});
  if (isNil(template)){
    throw new Error('Template with given name not found');
  }

  const bodyString = replaceVars(template.body, variables);
  const subjectString = replaceVars(template.subject, variables);

  builder.setSender(sender);
  builder.setContent(bodyString);
  builder.setReceiver(email);
  builder.setSubject(subjectString);

  return emailer.sendEmail(builder);
}

function replaceVars(body, variables) {
  let str = body;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    let value = variables[key];
    if (Array.isArray(value)) {
      value = value.toString();
    } else if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    str = str.replace(regex, value);
  });
  return str;
}

async function registerTemplate(name, subject, body, variables) {
  if (isNil(name)) {
    throw new Error("Template name is required");
  }

  if (isNil(subject)) {
    throw new Error("Template subject is required");
  }

  if (isNil(body)) {
    throw new Error("Template body is required");
  }

  if (isNil(database)) {
    throw new Error("Module not initialized")
  }

  const templateSchema = database.getSchema('EmailTemplate');

  const temp = await templateSchema.findOne({name});
  if (!isNil(temp)) return temp;

  return templateSchema.create({
    name,
    subject,
    body,
    variables
  });
}

module.exports = {
  init,
  sendMail,
  registerTemplate
};

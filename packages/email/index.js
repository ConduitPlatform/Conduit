const emailProvider = require('@conduit/email-provider');
const {isNil} = require('lodash');
const templateModel = require('./models/EmailTemplate');

let emailer;
let database;

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
    if (isNil(name) || isNil(subject) || isNil(body))
        throw new Error("Template fields are missing");
    if (isNil(database)) {
        throw new Error("Database not initialized")
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

function initialize(app) {
    if (!app) {
        throw new Error("No app provided")
    }

    const appConfig = app.conduit.config;

    if (isNil(appConfig)) {
        throw new Error("No app config");
    }

    const config = appConfig.get('email');

    if (isNil(config)) {
        throw new Error("No email config provided");
    }

    if (config && !Object.prototype.toString.call(config)) {
        throw new Error("Malformed config provided")
    }

    const {transport, transportSettings} = config;
    if (isNil(transport) || isNil(transportSettings)) {
        throw new Error("You need to provide both a transport and a config");
    }

    emailer = new emailProvider.EmailProvider(transport, transportSettings);

    database = app.conduit.database.getDbAdapter();
    database.createSchemaFromAdapter(templateModel);

    return true;
}

module.exports = {
    initialize,
    sendMail,
    registerTemplate
};

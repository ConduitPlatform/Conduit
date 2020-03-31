const emailProvider = require('@conduit/email-provider');
const {isNil} = require('lodash');
const templateModel = require('./models/Template');

let emailer;
let database;

function sendMail(templateName, params) {
    const {
        subject,
        body,
        email,
        variables,
        sender
    } = params;

    if (isNil(emailer)) {
        throw new Error("Module not initialized");
    }

    const builder = emailer.emailBuilder();
    if (isNil(builder)) {
        return;
    }

    if (isNil(subject)) {
        throw new Error("Cannot send email without subject");
    }

    if (isNil(email)) {
        throw new Error("Cannot send email without receiver");
    }

    if (isNil(sender)) {
        throw new Error("Cannot send email without a sender");
    }

    const bodyString = replaceVars(body, variables);

    builder.setSender(sender);
    builder.setContent(bodyString);
    builder.setReceiver(email);
    builder.setSubject(subject);

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

    const templateSchema = database.getSchema('Template');

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

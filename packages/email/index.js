const emailProvider = require('@conduit/email-provider');
const {isNil} = require('lodash');
const templateModel = require('./models/EmailTemplate');
const SMTPServer = require('smtp-server').SMTPServer;
const {createTestAccount} = require('nodemailer');
const adminHandler = require('./handlers/admin/admin');

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

async function initialize(app) {
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

    let testAccount = undefined;
    let {transport, transportSettings} = config;
    if (isNil(transport) || isNil(transportSettings)) {
        testAccount = await createTestAccount();
        const smtpServer = new SMTPServer({
            onAuth(auth, session, callback) {
                if (auth.username !== testAccount.user || auth.password !== testAccount.pass) {
                    return callback(new Error("Invalid username or password"));
                }
                callback(null, { user: 123 }); // where 123 is the user id or similar property
            },
            onData(stream, session, callback) {
                stream.pipe(process.stdout); // print message to console
                stream.on("end", callback);
            }});
        smtpServer.listen(25);
        transport = 'smtp';
        transportSettings = {
            port: 25
        };
    }
    emailer = new emailProvider.EmailProvider(transport, transportSettings, testAccount);

    database = app.conduit.database.getDbAdapter();
    database.createSchemaFromAdapter(templateModel);

    const admin = app.conduit.admin;
    admin.registerRoute('GET', '/email-templates',
      (req, res, next) => adminHandler.getTemplates(req, res, next).catch(next));

    admin.registerRoute('POST', '/email-templates',
      (req, res, next) => adminHandler.createTemplate(req, res, next).catch(next));

    admin.registerRoute('PUT', '/email-templates/:id',
      (req, res, next) => adminHandler.editTemplate(req, res, next).catch(next));

    return true;
}

module.exports = {
    initialize,
    sendMail,
    registerTemplate
};

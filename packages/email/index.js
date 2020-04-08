const emailProvider = require('@conduit/email-provider');
const {isNil} = require('lodash');
const templateModel = require('./models/EmailTemplate');
const SMTPServer = require('smtp-server').SMTPServer;
const {createTestAccount} = require('nodemailer');
const adminHandler = require('./handlers/admin/admin');
const emailLogic = require('./logic/email');

let emailer;
let database;

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

    emailLogic.init(emailer, database);

    const admin = app.conduit.admin;
    admin.registerRoute('GET', '/email-templates/:skip?/:limit?',
      (req, res, next) => adminHandler.getTemplates(req, res, next).catch(next));

    admin.registerRoute('POST', '/email-templates',
      (req, res, next) => adminHandler.createTemplate(req, res, next).catch(next));

    admin.registerRoute('PUT', '/email-templates/:id',
      (req, res, next) => adminHandler.editTemplate(req, res, next).catch(next));

    admin.registerRoute('POST', '/email/send',
      (req, res, next) => adminHandler.sendEmail(req, res, next).catch(next));

    return true;
}

module.exports = {
    initialize,
    sendMail: emailLogic.sendMail,
    registerTemplate: emailLogic.registerTemplate
};

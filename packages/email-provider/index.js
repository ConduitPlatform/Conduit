const emailProvider = require('@conduit/email-provider');
const {isNil} = require('lodash');

let emailer;

function sendMail(params) {
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


function initialize(app, config) {
    if (config && !Object.prototype.toString.call(config)) {
        throw new Error("Malformed config provided")
    }

    if (!app) {
        throw new Error("No app provided")
    }
    const {transport, transportSettings} = config;
    if (isNil(transport) || isNil(transportSettings)) {
        throw new Error("You need to provide both a transport and a config");
    }

    emailer = new emailProvider.EmailProvider(transport, transportSettings);
    return true;

}

module.exports = initialize;
module.exports.sendMail = sendMail;

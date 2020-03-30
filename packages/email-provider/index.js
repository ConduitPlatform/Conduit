const emailProvider = require('@conduit/email-provider');

let emailer;

function sendMail() {

}


function initialize(app, config) {
    if (config && !Object.prototype.toString.call(config)) {
        throw new Error("Malformed config provided")
    }

    if (!app) {
        throw new Error("No app provided")
    }
    // initialize properly
    emailer = new emailProvider.EmailProvider('mailgun', {});

    return true;

}

module.exports = initialize;
module.exports.sendMail = sendMail;

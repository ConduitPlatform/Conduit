import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { initialize as initializeMailgun } from './mailgun';
import { MailgunConfig } from "./mailgun.config";

var Mailgun = require('mailgun.js');
const formData = require('form-data');
export  class MailgunProvider extends EmailProviderClass {

    protected _mailgunSdk: any;
    constructor(mailgunSettings: MailgunConfig){
        super(createTransport(initializeMailgun(mailgunSettings)));
        const mailgun = new Mailgun(formData);
         this._mailgunSdk = mailgun.client({
            username: 'api', 
            key: mailgunSettings.auth.api_key
        });
    }

    listTemplates(apiKey: any){
        throw new Error('Not implemented');
    }

    getTemplateInfo(){
        throw new Error('Not implemented');
    }

    async createTemplate(domain:string ,data: any){
        throw new Error('Not implemented');
    }
}
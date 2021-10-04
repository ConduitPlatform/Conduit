import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { initialize as initializeMailgun } from './mailgun';
import { MailgunConfig } from "./mailgun.config";
var mailgun = require('mailgun-js');

const formData = require('form-data');
export  class MailgunProvider extends EmailProviderClass {
    
    protected _mailgunSdk: any;
    private domain: string;
    private apiKey: string;
    constructor(mailgunSettings: MailgunConfig){
        super(createTransport(initializeMailgun(mailgunSettings)));
        this.domain = mailgunSettings.auth.domain;
        this.apiKey = mailgunSettings.auth.api_key;
        this._mailgunSdk = mailgun({apiKey:this.apiKey, domain: this.domain});
    }

    listTemplates():Promise<any>{
        return this._mailgunSdk.get(`/${this.domain}/templates`);
    }

    getTemplateInfo(template_name:string):Promise<any>{
        return this._mailgunSdk.get(`/${this.domain}/templates/${template_name}`);
    }

    createTemplate(data: any){
        return this._mailgunSdk.post(`/${this.domain}/templates`,data);
    }
}
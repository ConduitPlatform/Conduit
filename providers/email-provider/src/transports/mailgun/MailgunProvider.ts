import { createTransport } from "nodemailer";
import { Template } from "../../interfaces/Template";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { initialize as initializeMailgun } from './mailgun';
import { MailgunConfig } from "./mailgun.config";
var mailgun = require('mailgun-js');
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

    async getTemplateInfo(template_name:string):Promise<Template>{
        const response = await this._mailgunSdk.get(`/${this.domain}/templates/${template_name}`);
        let info : Template = {
            name: response.name,
            id: response.id,
            createdAt: response.createdAt,
            versions : []
        };
        return info;
    }

   async createTemplate(data: any): Promise<Template>{
        const resposne = await  this._mailgunSdk.post(`/${this.domain}/templates`,data);
        let created : Template = {
            name: resposne.name,
            createdAt: resposne.createdAt,
            id: "",
            versions: []
        };
        return created;
    }
}
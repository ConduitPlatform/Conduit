import { createTransport } from "nodemailer";
import { Options } from "nodemailer/lib/mailer";
import { CreateEmailTemplate } from "../../interfaces/CreateEmailTemplate";
import { Template } from "../../interfaces/Template";
import { EmailBuilderClass } from "../../models/EmailBuilderClass";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { initialize as initializeMailgun } from './mailgun';
import { MailgunConfig } from "./mailgun.config";
import { MailgunMailBuilder } from "./mailgunMailBuilder";
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

    async listTemplates():Promise<Template[]>{
        
        const templates = await  this._mailgunSdk.get(`/${this.domain}/templates`);
        const retList: Template[] =  templates.items.map( async (element:Template) => await this.getTemplateInfo(element.name));
        return Promise.all(retList);
    }

    async getTemplateInfo(template_name:string):Promise<Template>{
        const response = await this._mailgunSdk.get(`/${this.domain}/templates/${template_name}`,{active:"yes"});

        let info : Template = {
            name: response.template.name,
            id: response.template.id,
            createdAt: response.template.createdAt,
            versions : [{
                name: response.template.version.tag,
                id: response.template.version.id,
                plainContent: response.template.version.template,
                active:true,
                updatedAt: '',

            }],
        };
        return info;
    }

   async createTemplate(data: CreateEmailTemplate): Promise<Template>{
        const mailgun_input = {
            name: data.name,
            template:data.plainContent,
            descrpiton: '',
            active: true,
            tag: data.versionName
        };
    
        const response = await  this._mailgunSdk.post(`/${this.domain}/templates`,mailgun_input);

        let created : Template = {
            name: response.template.name,
            createdAt: response.template.createdAt,
            id: response.template.id,
            versions: [{
                name: response.template.version.tag,
                id: response.template.version.id,
                active:true,
                updatedAt: response.template.version.createdAt,
                plainContent: response.template.version.template, // can be also htmlContent
            }]
        };
    
        return created;
    }

    getBuilder(): EmailBuilderClass<Options> {
        return new MailgunMailBuilder();
    }
}
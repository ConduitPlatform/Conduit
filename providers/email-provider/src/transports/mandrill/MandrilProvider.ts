import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { MandrillConfig } from "./mandrill.config";
import { Mandrill } from 'mandrill-api';
import { Template } from "../../interfaces/Template";
var mandrillTransport = require('nodemailer-mandrill-transport');
export class MandrillProvider extends EmailProviderClass{
   private  _mandrillSdk?: Mandrill;
   private apiKey: string;

    constructor(mandrillSettings: MandrillConfig){
        super(createTransport(mandrillTransport(mandrillSettings)));
        this._mandrillSdk = new Mandrill(mandrillSettings.auth.apiKey);
        this.apiKey = mandrillSettings.auth.apiKey;
        console.log(this.apiKey);
    }
    
    listTemplates(){
        return this._mandrillSdk?.templates.list(this.apiKey)
    }

    async getTemplateInfo(template_name:string):Promise<Template>{
        const response = await new Promise<any>( (resolve) => this._mandrillSdk?.templates.info({key: this.apiKey,name: template_name},resolve));
        const info : Template = {
            id :response.slug,
            name: response.name,
            versions: [{
                name: response.name,
                id: response.id,
                subject: response.subject,
                active: true,
                updatedAt: response.updated_at,
                htmlContent: response.code,
                plainContent: '',
            }],
            createdAt: response.created_at
        }
        return info;
    }
    
    createTemplate(data: any): Promise<Template> {
        throw new Error("Method not implemented.");
    }
}

import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { MandrillConfig } from "./mandrill.config";
import { Mandrill } from 'mandrill-api';
var mandrillTransport = require('nodemailer-mandrill-transport');
export class MandrillProvider extends EmailProviderClass{
   private  _mandrillSdk?: Mandrill;
   private apiKey: string;

    constructor(mandrillSettings: MandrillConfig){
        super(createTransport(mandrillTransport(mandrillSettings)));
        this._mandrillSdk = new Mandrill(mandrillSettings.auth.apiKey);
        this.apiKey = mandrillSettings.auth.apiKey;
    }
    
    listTemplates(){
        return this._mandrillSdk?.templates.list(this.apiKey)
    }

    getTemplateInfo(templateName:string){
        return this._mandrillSdk?.templates.info(templateName);
    }

    createTemplate(data: any) {
        throw new Error("Method not implemented.");
    }
}
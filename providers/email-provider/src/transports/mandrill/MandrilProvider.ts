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
        this._mandrillSdk?.templates.list(this.apiKey, res =>{
          console.log(res);
        },
        err => {
          console.log(err);
        });
    }

    getTemplateInfo(templateName:string){
        this._mandrillSdk?.templates.info(templateName, res => {
            console.log(res);
        },
        err => {
            console.log(err);
        });
    }

    createTemplate(data: any) {
        throw new Error("Method not implemented.");
    }
}
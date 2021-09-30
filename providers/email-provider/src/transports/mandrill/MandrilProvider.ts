import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { MandrillConfig } from "./mandrill.config";
import { Mandrill } from 'mandrill-api';
var mandrillTransport = require('nodemailer-mandrill-transport');
export class MandrillProvider extends EmailProviderClass{
   private  _mandrillSdk?: Mandrill;

    constructor(mandrillSettings: MandrillConfig){
        super(createTransport(mandrillTransport(mandrillSettings)));
        console.log(mandrillSettings);
        this._mandrillSdk = new Mandrill(mandrillSettings.auth.apiKey);
    }

    listTemplates(apiKey:any){
        console.log(apiKey);
        this._mandrillSdk?.templates.list(apiKey, res =>{
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
}
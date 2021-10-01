import { EmailProviderClass } from "../../models/EmailProviderClass";
import { SendGridConfig } from "./sendgrid.config";
import { createTransport } from "nodemailer";
import {Client} from '@sendgrid/client';
import { CreateEmailTemplate } from "../../interfaces/CreateEmailTemplate";
var sgTransport = require('nodemailer-sendgrid');
export class SendgridProvider extends EmailProviderClass{
    private _sgClient: any;
    constructor(sgSettings: SendGridConfig){
        super(createTransport(sgTransport(sgSettings)));
        this._sgClient = new Client();
        this._sgClient.setApiKey(sgSettings.apiKey);
    }
    
    createTemplate(domain: string, data: CreateEmailTemplate) {

        const request = {
            method:'POST',
            url: '/v3/templates',
            body: data
        }
        this._sgClient.request(request).then((res:any) =>{
            console.log(res);
        }) 
        .catch((err:any) =>{
            console.log(err);
        });
    }
    
    getTemplateInfo(templateName: string) {
        throw new Error("Method not implemented.");
    }
    
    listTemplates(apiKey: any) {
        const request = {
            method:'GET',
            url: '/v3/templates',
            generations: 'dynamic'
        }
        this._sgClient.request(request).then((res:any) =>{
            console.log(res);
        }) 
        .catch((err:any) =>{
            console.log(err);
        })
    }
    
}



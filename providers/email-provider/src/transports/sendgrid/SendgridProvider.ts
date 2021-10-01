import { EmailProviderClass } from "../../models/EmailProviderClass";
import { SendGridConfig } from "./sendgrid.config";
import { createTransport } from "nodemailer";
import {Client} from '@sendgrid/client';
import { CreateSendgridTemplate } from "../../interfaces/sendgrid/CreateSendgridTemplate";
var sgTransport = require('nodemailer-sendgrid');
export class SendgridProvider extends EmailProviderClass{
    private _sgClient: any;
    constructor(sgSettings: SendGridConfig){
        super(createTransport(sgTransport(sgSettings)));
        this._sgClient = new Client();
        this._sgClient.setApiKey(sgSettings.apiKey);
    }
    
    createTemplate(data: CreateSendgridTemplate) {

        const create_request = {
            method:'POST',
            url: '/v3/templates',
            body: {
                name: data.name,
                generation: data.generation
            }
        }
        this._sgClient.request(create_request).then(([response,body]:any) =>{ //create the version
     
            const create_version = {
                method:'POST',
                url: '/v3/templates/' + body.id + '/versions',
                body: data.version
            }
            this._sgClient.request(create_version).then((res:any) =>{
                console.log('Version created!',res);
            }) 
            .catch((err:any) =>{
                console.log(err);
            });
        }) 
        .catch((err:any) =>{
            console.log(err);
        });
        
    }
    
    getTemplateInfo(template_id: string) {

        const request = {
            method:'GET',
            url: '/v3/templates/'+template_id,
        }
        return  this._sgClient.request(request);
       
    }
    
    listTemplates() { //not working idk wh
        const request = {
            method:'GET',
            url: '/v3/templates',
            qs:{
                generations: 'legacy,dynamic',
            }
        }
        return this._sgClient.request(request)
            
    }
    
}



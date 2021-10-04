import { EmailProviderClass } from "../../models/EmailProviderClass";
import { SendGridConfig } from "./sendgrid.config";
import { createTransport } from "nodemailer";
import {Client} from '@sendgrid/client';
import { CreateSendgridTemplate } from "../../interfaces/sendgrid/CreateSendgridTemplate";
import { Template } from "../../interfaces/Template";
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
    
    async getTemplateInfo(template_id: string):Promise<Template> {

        const request = {
            method:'GET',
            url: '/v3/templates/'+template_id,
        }
        
        const response = (await this._sgClient.request(request))[0];
        const versions = response.body.versions;
        var retVersions:any = [];
        versions.forEach((version:any) => {
                retVersions.push({
                    name: version.name,
                    id: version.id,
                    subject: version.subject,
                    updatedAt: version.updated_at,
                    active: version.active,
                    htmlContent: version.html_content,
                    plainContent: version.plain_content
                });
        });
        let info: Template = {
            name: response.body.name,
            id: response.body.id,
            createdAt: '',
            versions: retVersions
        }

        return info;
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



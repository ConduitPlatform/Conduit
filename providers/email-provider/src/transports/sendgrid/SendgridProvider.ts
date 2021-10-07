import { EmailProviderClass } from "../../models/EmailProviderClass";
import { SendGridConfig } from "./sendgrid.config";
import { createTransport } from "nodemailer";
import {Client} from '@sendgrid/client';
import { Template } from "../../interfaces/Template";
import { CreateEmailTemplate } from "../../interfaces/CreateEmailTemplate";
import { SendgridMailBuilder } from "./sendgridMailBuilder";
import { getHBValues } from "../../parse-test/getHBValues";
import Mail from "nodemailer/lib/mailer";
var sgTransport = require('nodemailer-sendgrid');
export class SendgridProvider extends EmailProviderClass{
    private _sgClient: any;
    constructor(sgSettings: SendGridConfig){
        super(createTransport(sgTransport(sgSettings)));
        this._sgClient = new Client();
        this._sgClient.setApiKey(sgSettings.apiKey);
    }
    
    async createTemplate(data: CreateEmailTemplate): Promise<Template> {
        const create_request = {
            method:'POST',
            url: '/v3/templates',
            body: {
                name: data.name,
                generation: 'dynamic'
                
            }
        }
        const template_res = (await  this._sgClient.request(create_request))[0];
        let info : Template = {
            name: template_res.body.id,
            id: template_res.body.name,
            createdAt: template_res.body.updated_at,
            versions: []
        }
        const create_version = {
            method:'POST',
            url: '/v3/templates/' + template_res.body.id + '/versions',
            body: {
                subject: data.subject,
                name: data.versionName,
                html_content: data.htmlContent,
                plain_content: data.plainContent,
            }
        }
        const version_res =  (await this._sgClient.request(create_version))[0];
        info.versions.push({
           id:  version_res.body.id,
           subject: version_res.body.subject,
           htmlContent: version_res.body.html_content,
           plainContent: version_res.body.plain_content,
           name: version_res.body.name,
           active: version_res.body.active,
           updatedAt:'',
           variables: Object.keys(getHBValues(version_res.body.html_content))
        })
        console.log(info.versions[0].variables);
        
       return info;
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
                    plainContent: version.plain_content,
                    variables: Object.keys(getHBValues(versions.html_content))
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
    
    async listTemplates():Promise<Template[]>{ 
        const request = {
            method:'GET',
            url: '/v3/templates',
            qs:{
                generations: 'legacy,dynamic',
            }
        }
        const resp = (await this._sgClient.request(request))[0];
        const retList = (resp.body.templates as any []).map(async (element:Template) =>  await this.getTemplateInfo(element.id));
    
        return Promise.all(retList);
            
    }

    getBuilder(){
        return new SendgridMailBuilder();
    }

}



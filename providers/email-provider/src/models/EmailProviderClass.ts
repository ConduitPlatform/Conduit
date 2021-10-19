import Mail from "nodemailer/lib/mailer";
import { CreateEmailTemplate } from "../interfaces/CreateEmailTemplate";
import { Template } from "../interfaces/Template";
import { UpdateEmailTemplate } from "../interfaces/UpdateEmailTemplate";
import { EmailBuilderClass } from "./EmailBuilderClass";
export abstract class EmailProviderClass{
    _transport?: Mail;
    
    constructor(transport: Mail){
        this._transport = transport;
    }
    abstract listTemplates():Promise<Template[]>;
    abstract getTemplateInfo(templateName:string):Promise<Template>;
    abstract createTemplate(data: CreateEmailTemplate):Promise<Template>;
    abstract getBuilder() : EmailBuilderClass<Mail.Options>;
    abstract updateTemplate(data:UpdateEmailTemplate):Promise<Template>;
    sendEmail(mailOptions: Mail.Options){
        return this._transport?.sendMail(mailOptions);
    }
    
    sendEmailDirect(mailOptions: Mail.Options){
        
        const transport = this._transport;
        if (!transport) {
            throw new Error('Email  transport not initialized!');
        }
        return this._transport?.sendMail(mailOptions);
        
    }

}

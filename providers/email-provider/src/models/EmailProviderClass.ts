import Mail from "nodemailer/lib/mailer";
import { Template } from "../interfaces/Template";
export abstract class EmailProviderClass{
    _transport?: Mail;

    constructor(transport: Mail){
        this._transport = transport;
    }
    abstract listTemplates():any;
    abstract getTemplateInfo(templateName:string):Promise<Template>;
    abstract createTemplate(data: any):any;

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

//onoma, content
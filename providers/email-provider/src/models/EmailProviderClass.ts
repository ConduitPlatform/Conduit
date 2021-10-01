import { SentMessageInfo } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
export abstract class EmailProviderClass{
    _transport?: Mail;

    constructor(transport: Mail){
        this._transport = transport;
    }
    abstract listTemplates(apiKey:any):any;
    abstract getTemplateInfo(templateName:string):any;
    abstract createTemplate(domain:string,data: any):any ;

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
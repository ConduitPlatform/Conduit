import Mail from "nodemailer/lib/mailer";
import { SendgridMailOptions } from "../../interfaces/sendgrid/SendgridEmailOptions";
import { TemplateOptions } from "../../interfaces/TemplateOptions";
import { EmailBuilderClass } from "../../models/EmailBuilderClass";
var smtpapi = require('smtpapi');

export class SendgridMailBuilder extends EmailBuilderClass<SendgridMailOptions>{
    constructor(){
        super();
    }

    // setTemplate(template: TemplateOptions): SendgridMailBuilder {
    //     let header = new smtpapi();
    //     header.addFilter('templates','enable',1);
    //     header.addFilter('templates','template_id',template.id);  
    //     template.variables.forEach( (element) =>{
    //         header.addSubstitution(element.name,[element.content]);

    //     })
    //     this._mailOptions.headers = {'x-smtpapi': JSON.stringify(header)}
    //     return this;
    // }


}
import Mail from "nodemailer/lib/mailer";
import { SendgridMailOptions } from "../../interfaces/sendgrid/SendgridEmailOptions";
import { TemplateOptions } from "../../interfaces/TemplateOptions";
import { EmailBuilderClass } from "../../models/EmailBuilderClass";


export class SendgridMailBuilder extends EmailBuilderClass<SendgridMailOptions>{
    constructor(){
        super();
    }

    setTemplate(template: TemplateOptions): SendgridMailBuilder {
        if(!this._mailOptions.hasOwnProperty('dynamicTemplateData')){
            this._mailOptions.dynamicTemplateData = {} as any;
        }
        template.variables.forEach( element =>{
            this._mailOptions.dynamicTemplateData[element.name] = element.content;
        })
        this._mailOptions.templateId =  template.id;
        
        return this;
    }


}
import { createTransport } from "nodemailer";
import { Template } from "../../interfaces/Template";
import { EmailProviderClass } from "../../models/EmailProviderClass";

export class SmtpProvider extends EmailProviderClass{
    
    constructor(transportSettings: any){
        super(createTransport(transportSettings));
    }

    listTemplates() {
        throw new Error("Method not implemented.");
    }

    getTemplateInfo(template_name: string):Promise<Template> {
        throw new Error("Method not implemented.");
    }

    createTemplate(): Promise<Template>{
        throw new Error("Method not implemented.");
    }
}
import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";

export class SmtpProvider extends EmailProviderClass{
    
    constructor(transportSettings: any){
        super(createTransport(transportSettings));
    }

    listTemplates() {
        throw new Error("Method not implemented.");
    }

    getTemplateInfo(template_name: string):Promise<any> {
        throw new Error("Method not implemented.");
    }

    createTemplate() {
        throw new Error("Method not implemented.");
    }
}
import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";

export class SmtpProvider extends EmailProviderClass{
    
    constructor(transportSettings: any){
        super(createTransport(transportSettings));
    }

    listTemplates(apiKey: any) {
        throw new Error("Method not implemented.");
    }

    getTemplateInfo(templateName: string) {
        throw new Error("Method not implemented.");
    }

    createTemplate(domain: string, data: any) {
        throw new Error("Method not implemented.");
    }
}
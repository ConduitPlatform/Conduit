import Mail from "nodemailer/lib/mailer";

export interface SendgridMailOptions extends Mail.Options{
    templateId: string;
    headers: any;
            
    
   
}
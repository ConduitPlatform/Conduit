import Mail from "nodemailer/lib/mailer";

export interface MailgunEmailOptions extends Mail.Options{
    template?:string; 
    'h:X-Mailgun-Variables'?: {
        [key:string] : any;
    } | string;
}

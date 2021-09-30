import Mail from "nodemailer/lib/mailer";
export abstract class EmailProviderClass{
    _transport?: Mail;

    constructor(transport: Mail){
        this._transport = transport;
    }


}
import Mailgun from "mailgun.js";
import { createTransport } from "nodemailer";
import { EmailProviderClass } from "../../models/EmailProviderClass";
import { initialize as initializeMailgun } from './mailgun';
import { MailgunConfig } from "./mailgun.config";
export class MailgunProvider extends EmailProviderClass {
    protected _mailgunSdk: any;
    constructor(mailgunSettings: MailgunConfig){
        super(createTransport(initializeMailgun(mailgunSettings)));
        const temp = new Mailgun(FormData);
        this._mailgunSdk = temp.client({
            username: 'api',
            key: mailgunSettings.auth.api_key,
            public_key: 'pubkey-043572ea628d6d47a99b210391a4a3c3'
        });
    }
    listTepmlates(){
        throw new Error('Not implemented');
    }
}
import {initialize as initializeMailgun} from "./transports/mailgun/mailgun";
import Mail from "nodemailer/lib/mailer";
import {MailgunMailBuilder} from "./transports/mailgun/mailgunMailBuilder";
import {EmailBuilder} from "./interfaces/EmailBuilder";
import {createTransport, SentMessageInfo} from "nodemailer";
import { MailgunConfig } from './transports/mailgun/mailgun.config';


export class EmailProvider {

    _transport?: Mail;
    _transportName?: string;

    constructor(transport: string, transportSettings: any) {
        if (transport === 'mailgun') {
            this._transportName = 'mailgun';

            const { apiKey, domain, proxy } = transportSettings;

            const mailgunSettings: MailgunConfig = {
                auth: {
                    api_key: apiKey,
                    domain
                },
                proxy
            };

            this._transport = createTransport(initializeMailgun(mailgunSettings));
        } else {
            this._transportName = undefined;
            this._transport = undefined;
        }
    }

    sendEmailDirect(mailOptions: any): Promise<SentMessageInfo> {
        if (!this._transport) {
            throw new Error("Email  transport not initialized!");
        }
        return this._transport.sendMail(mailOptions);
    }

    emailBuilder(): EmailBuilder | undefined {
        if (!this._transport) {
            throw new Error("Email  transport not initialized!");
        }
        if (this._transportName === 'mailgun') {
            return new MailgunMailBuilder();
        }

        return undefined;
    }

    sendEmail(email: EmailBuilder): Promise<SentMessageInfo> {
        if (!this._transport) {
            throw new Error("Email  transport not initialized!");
        }
        return this._transport.sendMail(email.getMailObject());
    }
}




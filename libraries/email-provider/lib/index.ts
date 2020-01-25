import {initialize as initializeMailgun} from "./transports/mailgun/mailgun";
import Mail from "nodemailer/lib/mailer";
import {MailgunMailBuilder} from "./transports/mailgun/mailgunMailBuilder";
import {EmailBuilder} from "./interfaces/EmailBuilder";
import {createTransport, SentMessageInfo} from "nodemailer";

let _transport: Mail;
let _transportName: string;

export function initialize(transport: string, transportSettings: any): boolean {
    if (transport === 'mailgun') {
        _transportName = 'mailgun';
        _transport = createTransport(initializeMailgun(transportSettings));
        return _transport && true;
    }
    return false;
}

export function sendEmailDirect(mailOptions: any): Promise<SentMessageInfo> {
    if (!_transport) {
        throw new Error("Email  transport not initialized!");
    }
    return _transport.sendMail(mailOptions);
}

export function emailBuilder(): EmailBuilder | undefined {
    if (!_transport) {
        throw new Error("Email  transport not initialized!");
    }
    if (_transportName === 'mailgun') {
        return new MailgunMailBuilder();
    }

    return undefined;
}

export function sendEmail(email: EmailBuilder): Promise<SentMessageInfo> {
    if (!_transport) {
        throw new Error("Email  transport not initialized!");
    }
    return _transport.sendMail(email.getMailObject());
}

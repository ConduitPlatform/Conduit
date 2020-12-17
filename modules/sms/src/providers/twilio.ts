import {ISmsProvider} from '../interfaces/ISmsProvider';
import twilio from 'twilio';

export class TwilioProvider implements ISmsProvider {
    private readonly phoneNumber: string;
    private readonly accountSID: string;
    private readonly authToken: string;
    private client: twilio.Twilio;

    constructor(settings: {phoneNumber: string, accountSID: string, authToken: string}) {
        ({
            phoneNumber: this.phoneNumber,
            accountSID: this.accountSID,
            authToken: this.authToken
        } = settings);

        this.client = twilio(this.accountSID, this.authToken);
    }

    sendSms(to: string, message: string): Promise<any> {
        return this.client.messages.create({
            body: message,
            to,
            from: this.phoneNumber
        });
    }
}

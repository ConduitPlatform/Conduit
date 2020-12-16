import {ISmsProvider} from '../interfaces/ISmsProvider';

export class TwilioProvider implements ISmsProvider {
    private phoneNumber: string;
    private accountSID: string;
    private authToken: string;

    constructor(settings: {phoneNumber: string, accountSID: string, authToken: string}) {
        ({
            phoneNumber: this.phoneNumber,
            accountSID: this.accountSID,
            authToken: this.authToken
        } = settings);
    }

    sendSms(to: string, message: string): Promise<any> {
        console.log('aaa');
        throw new Error('Method not implemented.');
    }
}
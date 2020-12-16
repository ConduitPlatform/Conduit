
export interface ISmsProvider {
    sendSms(to: string, message: string): Promise<any>;
}

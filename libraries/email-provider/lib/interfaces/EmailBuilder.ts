export interface EmailBuilder {
    getMailObject(): any;
    setSender(sender: string): void;
    getSender(): string | undefined;
    setReceiver(receiver: string | string[], clearReceiver?: boolean): void;
    getReceiver(): string | string[] | undefined;
    setCC(cc: string | string[], clearCC?: boolean): void;
    getCC(): string | string[] | undefined;
    setSubject(subject: string): void;
    getSubject(): string | undefined;
    setBCC(bcc: string | string[], clearBCC?: boolean): void;
    getBCC(): string | string[] | undefined;
    setReplyTo(replyTo: string): void;
    getReplyTo(replyTo: string): string | undefined;
    setContent(content: string): void;
    getContent(): string | undefined
}

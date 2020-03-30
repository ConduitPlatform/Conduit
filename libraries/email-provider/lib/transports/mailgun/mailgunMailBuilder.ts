import {EmailBuilder} from "../../interfaces/EmailBuilder";

export class MailgunMailBuilder implements EmailBuilder {

    private _from?: string;
    private _to?: string | string[];
    private _subject?: string;
    private _cc?: string | string[];
    private _bcc?: string | string[];
    private 'h:Reply-To'?: string;
    private _html?: string;
    private _text?: string;

    setSender(sender: string) {
        this._from = sender;
    }

    getSender(): string | undefined {
        return this._from;
    }

    setReceiver(receiver: string | string[], clearReceiver?: boolean) {
        if (typeof receiver === "string") {
            if (this._to && this._to.length > 0) {
                if (typeof this._to !== "string") {
                    if (clearReceiver) {
                        this._to = [];
                    }
                    this._to.push(receiver);
                } else {
                    this._to = receiver;
                }
            } else {
                this._to = receiver;
            }
        } else {
            if (this._to && this._to.length > 0) {
                if (typeof this._to !== "string") {
                    if (clearReceiver) {
                        this._to = [];
                    }
                    this._to.concat(receiver);
                } else {
                    this._to = receiver.concat([this._to]);
                }
            } else {
                this._to = receiver;
            }
        }
    }

    getReceiver(): string | string[] | undefined {
        return this._to;
    }

    setCC(cc: string | string[], clearCC?: boolean) {
        if (typeof cc === "string") {
            if (this._cc && this._cc.length > 0) {
                if (typeof this._cc !== "string") {
                    if (clearCC) {
                        this._cc = [];
                    }
                    this._cc.push(cc);
                } else {
                    this._cc = cc;
                }
            } else {
                this._cc = cc;
            }
        } else {
            if (this._cc && this._cc.length > 0) {
                if (typeof this._cc !== "string") {
                    if (clearCC) {
                        this._cc = [];
                    }
                    this._cc.concat(cc);
                } else {
                    this._cc = cc.concat([this._cc]);
                }
            } else {
                this._cc = cc;
            }
        }
    }

    setSubject(subject: string) {
        this._subject = subject;
    }

    getSubject(): string | undefined {
        return this._subject;
    }

    getCC(): string | string[] | undefined {
        return this._cc;
    }

    setBCC(bcc: string | string[], clearBCC?: boolean) {
        if (typeof bcc === "string") {
            if (this._bcc && this._bcc.length > 0) {
                if (typeof this._bcc !== "string") {
                    if (clearBCC) {
                        this._bcc = [];
                    }
                    this._bcc.push(bcc);
                } else {
                    this._bcc = bcc;
                }
            } else {
                this._bcc = bcc;
            }
        } else {
            if (this._bcc && this._bcc.length > 0) {
                if (typeof this._bcc !== "string") {
                    if (clearBCC) {
                        this._bcc = [];
                    }
                    this._bcc.concat(bcc);
                } else {
                    this._bcc = bcc.concat([this._bcc]);
                }
            } else {
                this._bcc = bcc;
            }
        }
    }

    getBCC(): string | string[] | undefined {
        return this._bcc;
    }

    setReplyTo(replyTo: string) {
        this["h:Reply-To"] = replyTo;
    }

    getReplyTo() {
        return this["h:Reply-To"];
    }

    checkIfHTML(text: string): boolean {
        if (!text || text.length === 0) return false;
        var isHTML = RegExp.prototype.test.bind(/^(<([^>]+)>)$/i);
        return isHTML(text);

    }

    setContent(content: string) {
        if (this.checkIfHTML(content)) {
            if (this._text) {
                this._text = '';
            }
            this._html = content;
        } else {
            if (this._html) {
                this._html = '';
            }
            this._text = content;
        }
    }

    getContent(): string | undefined {
        return this._html ? this._html : this._text;
    }

    nullOrEmptyCheck(prop: any) {

        return !prop || prop.length === 0;
    }

    getMailObject(): any {
        let finalObject: any = {};

        if (!this.nullOrEmptyCheck(this._from)) {
            finalObject['from'] = this._from;
        } else {
            throw new Error("Sender needs to be specified");
        }

        if (!this.nullOrEmptyCheck(this._to)) {
            finalObject['to'] = this._to;
        } else {
            throw new Error("Recipient needs to be specified");
        }

        if (!this.nullOrEmptyCheck(this._subject)) {
            finalObject['subject'] = this._subject;
        } else {
            throw new Error("Subject needs to be specified");
        }

        if (this.nullOrEmptyCheck(this._html) && this.nullOrEmptyCheck(this._text)) {
            throw new Error("Content needs to be specified");
        } else {
            if (!this.nullOrEmptyCheck(this._html)) {
                finalObject['html'] = this._html;
            } else {
                finalObject['text'] = this._text;
            }
        }

        if (!this.nullOrEmptyCheck(this._cc)) {
            finalObject['cc'] = this._cc;
        }

        if (!this.nullOrEmptyCheck(this._bcc)) {
            finalObject['bcc'] = this._bcc;
        }

        if (!this.nullOrEmptyCheck(this["h:Reply-To"])) {
            finalObject['h:Reply-To'] = this["h:Reply-To"];
        }

        return finalObject;
    }

}

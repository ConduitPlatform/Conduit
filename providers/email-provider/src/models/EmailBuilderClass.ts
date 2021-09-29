import Mail, { Address, Attachment, AttachmentLike } from 'nodemailer/lib/mailer';
import { isNil } from 'lodash';
import { Readable } from 'stream';
import { checkIfHTML } from '../utils';

export abstract class EmailBuilderClass<T extends Mail.Options> {
  protected _mailOptions: T;
  constructor() {
    this._mailOptions = {} as T;
  }

  setSender(sender: string): EmailBuilderClass<T> {

    this._mailOptions.from = sender;
    return this;
  }

  nullOrEmptyCheck(prop: any) {
    return isNil(prop) || prop.length === 0;
  }

  getReplyTo() {
    return this._mailOptions.replyTo;
  }

  setReplyTo(replyTo: string): EmailBuilderClass<T> {
    this._mailOptions.replyTo = replyTo;
    return this;
  }

  setBCC(bcc:  string | Address | Array<string | Address>): EmailBuilderClass<T>  {
    if(!this._mailOptions.hasOwnProperty('bcc')){

      this._mailOptions.bcc = [];

    }
    if(Array.isArray(bcc)){

      this._mailOptions.bcc = (this._mailOptions.bcc as Array<string | Address>).concat(bcc);

    }
    else{
  
      (this._mailOptions.bcc as Array<string | Address>).push(bcc);
    }
    return this;
  }


  getBCC(): string | Address | Array<string | Address> | undefined {
    return this._mailOptions.bcc;
  }

  setSubject(subject: string): EmailBuilderClass<T> {
    this._mailOptions.subject = subject;
    return this;
  }

  setReceiver(receiver:  string | Address | Array<string | Address>, clearReceiver?: boolean): EmailBuilderClass<T> {
    if (typeof receiver === 'string') {
      if (this._mailOptions.to && (this._mailOptions.to as Array<string | Address>).length > 0) {
        if (typeof this._mailOptions.to !== 'string') {
          if (clearReceiver) {
            this._mailOptions.to = [];
          }
          (this._mailOptions.to as Array<string| Address>).push(receiver);
        } else {
          this._mailOptions.to = receiver;
        }
      } else {
        this._mailOptions.to = receiver;
      }
    } else {
      if (this._mailOptions.to && (this._mailOptions.to as Array<string | Address>).length > 0) {
        if (typeof this._mailOptions.to !== 'string') {
          if (clearReceiver) {
            this._mailOptions.to = [];
          }
          (this._mailOptions.to as Array<string | Address>).concat(receiver);
        } else {
          this._mailOptions.to = (receiver as Array< string | Address> ).concat([this._mailOptions.to]);
        }
      } else {
        this._mailOptions.to = receiver;
      }
    }
    return this;
  }
  setCC(cc: string | string[], clearCC?: boolean): EmailBuilderClass<T> {
    if (typeof cc === 'string') {
      if (this._mailOptions.cc && (this._mailOptions.cc as Array< string| Address>).length > 0) {
        if (typeof this._mailOptions.cc !== 'string') {
          if (clearCC) {
            this._mailOptions.cc = [];
          }
          (this._mailOptions.cc as Array< string | Address>).push(cc);
        } else {
          this._mailOptions.cc = cc;
        }
      } else {
        this._mailOptions.cc = cc;
      }
    } else {
      if (this._mailOptions.cc && (this._mailOptions.cc as Array< string| Address>).length  > 0) {
        if (typeof this._mailOptions.cc !== 'string') {
          if (clearCC) {
            this._mailOptions.cc = [];
          }
          (this._mailOptions.cc as Array< string | Address >).concat(cc);
        } else {
          this._mailOptions.cc = cc.concat([this._mailOptions.cc]);
        }
      } else {
        this._mailOptions.cc = cc;
      }
    }

    return this;
  }
  setContent(content: string): EmailBuilderClass<T> {
    if (checkIfHTML(content)) {
      if (this._mailOptions.text) {
        this._mailOptions.text = '';
      }
      this._mailOptions.html = content;
    } else {
      if (this._mailOptions.html) {
        this._mailOptions.html = '';
      }
      this._mailOptions.text = content;
    }
    return this;
  }

  getContent(): string  | Buffer | Readable | AttachmentLike | undefined {
    return this._mailOptions.html ? this._mailOptions.html : this._mailOptions.text;
  }

  getMailObject(): T {
    return this._mailOptions;
  }

  addAttachments(attachments: Attachment[]): EmailBuilderClass<T> {
    this._mailOptions.attachments = attachments;
    return this;
  }

  getAttachments(): Attachment[] | undefined {
    return this._mailOptions.attachments;
  }
}

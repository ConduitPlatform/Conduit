import Mail, { Address, Attachment } from 'nodemailer/lib/mailer';
import { TemplateOptions } from '../interfaces/TemplateOptions';
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

  setReplyTo(replyTo: string): EmailBuilderClass<T> {
    this._mailOptions.replyTo = replyTo;
    return this;
  }

  setSubject(subject: string): EmailBuilderClass<T> {
    this._mailOptions.subject = subject;
    return this;
  }

  setReceiver(
    receiver: string | Address | Array<string | Address>,
    clearReceiver?: boolean,
  ): EmailBuilderClass<T> {
    if (typeof receiver === 'string') {
      if (
        this._mailOptions.to &&
        (this._mailOptions.to as Array<string | Address>).length > 0
      ) {
        if (typeof this._mailOptions.to !== 'string') {
          if (clearReceiver) {
            this._mailOptions.to = [];
          }
          (this._mailOptions.to as Array<string | Address>).push(receiver);
        } else {
          this._mailOptions.to = receiver;
        }
      } else {
        this._mailOptions.to = receiver;
      }
    } else {
      if (
        this._mailOptions.to &&
        (this._mailOptions.to as Array<string | Address>).length > 0
      ) {
        if (typeof this._mailOptions.to !== 'string') {
          if (clearReceiver) {
            this._mailOptions.to = [];
          }
          (this._mailOptions.to as Array<string | Address>).concat(receiver);
        } else {
          this._mailOptions.to = (receiver as Array<string | Address>).concat([
            this._mailOptions.to,
          ]);
        }
      } else {
        this._mailOptions.to = receiver;
      }
    }
    return this;
  }

  setCC(cc: string | string[], clearCC?: boolean): EmailBuilderClass<T> {
    if (typeof cc === 'string') {
      if (
        this._mailOptions.cc &&
        (this._mailOptions.cc as Array<string | Address>).length > 0
      ) {
        if (typeof this._mailOptions.cc !== 'string') {
          if (clearCC) {
            this._mailOptions.cc = [];
          }
          (this._mailOptions.cc as Array<string | Address>).push(cc);
        } else {
          this._mailOptions.cc = cc;
        }
      } else {
        this._mailOptions.cc = cc;
      }
    } else {
      if (
        this._mailOptions.cc &&
        (this._mailOptions.cc as Array<string | Address>).length > 0
      ) {
        if (typeof this._mailOptions.cc !== 'string') {
          if (clearCC) {
            this._mailOptions.cc = [];
          }
          (this._mailOptions.cc as Array<string | Address>).concat(cc);
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

  getMailObject(): T {
    return this._mailOptions;
  }

  addAttachments(attachments: Attachment[]): EmailBuilderClass<T> {
    this._mailOptions.attachments = attachments;
    return this;
  }

  abstract setTemplate(template: TemplateOptions): EmailBuilderClass<T>;
}

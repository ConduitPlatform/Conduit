import { EmailBuilderClass } from '../../models/EmailBuilderClass';
import { MailgunEmailOptions } from '../../interfaces/mailgun/MailgunEmailOptions';

export class MailgunMailBuilder extends EmailBuilderClass<MailgunEmailOptions>{
  
  constructor(){
    super();
    
  }
  
  setTemplate(template : MailgunEmailOptions): MailgunMailBuilder {
    if( !this._mailOptions.hasOwnProperty('template')){
        this._mailOptions.template = '' as any;
    }
    Object.assign(this._mailOptions,template);
    return this;
  }

  getMailObject(): MailgunEmailOptions{
    let options: MailgunEmailOptions = super.getMailObject();
    return options;
  }
}

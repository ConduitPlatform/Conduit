import Mail from 'nodemailer/lib/mailer';
import { EmailBuilder } from '../../interfaces/EmailBuilder';
import { EmailBuilderClass } from '../../models/EmailBuilderClass';
import { checkIfHTML } from '../../utils';

export class NodemailerBuilder extends EmailBuilderClass<Mail.Options> {
  constructor(){
    super();
  }
  // private 'h:Reply-To'?: string;
 
}

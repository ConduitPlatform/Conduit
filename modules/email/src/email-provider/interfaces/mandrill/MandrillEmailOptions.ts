import Mail from 'nodemailer/lib/mailer';
import { Var } from '../Var';
export interface MandrillEmailOptions extends Mail.Options {
  mandrillOptions: {
    template_name: string;
    template_content: [];
    message: {
      merge_language: string;
      global_merge_vars: Var[];
      merge: boolean;
    };
  };
}

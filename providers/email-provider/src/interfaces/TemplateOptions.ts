import Mail from 'nodemailer/lib/mailer';
import{ Var} from './Var';
export interface TemplateOptions{
    id: string;
    variables: Var[];
}
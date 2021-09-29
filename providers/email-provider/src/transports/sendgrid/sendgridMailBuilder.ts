import Mail from "nodemailer/lib/mailer";
import { EmailBuilderClass } from "../../models/EmailBuilderClass";


export class SendgridMailBuilder extends EmailBuilderClass<Mail.Options>{

    constructor(){
        super();
    }

}
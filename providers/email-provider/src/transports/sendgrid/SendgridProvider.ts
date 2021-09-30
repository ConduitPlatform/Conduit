import { EmailProviderClass } from "../../models/EmailProviderClass";
import sgMail from '@sendgrid/mail';
import { SendGridConfig } from "./sendgrid.config";
import { createTransport } from "nodemailer";

var sgTransport = require('nodemailer-sendgrid');

export class SendgridProvider extends EmailProviderClass{
    constructor(sgSettings: SendGridConfig){
        super(createTransport(sgTransport(sgSettings)));

        
    }
}
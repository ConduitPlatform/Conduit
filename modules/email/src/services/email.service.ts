import {isNil} from 'lodash';
import {EmailProvider} from '@quintessential-sft/email-provider';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import {IRegisterTemplateParams, ISendEmailParams} from '../interfaces';

export class EmailService {
    private database: any;

    constructor(private emailer: EmailProvider, private readonly grpcSdk: ConduitGrpcSdk) {
        const self = this;
        this.grpcSdk.waitForExistence('database-provider').then(r => {
            self.database = self.grpcSdk.databaseProvider;
        })
    }

    updateProvider(emailer: EmailProvider) {
        this.emailer = emailer;
    }

    async registerTemplate(params: IRegisterTemplateParams) {
        const {
            name,
            body,
            subject,
            variables
        } = params;

        const existing = await this.database.findOne('EmailTemplate', {name});
        if (!isNil(existing)) return existing;

        return this.database.create('EmailTemplate', {
            name,
            subject,
            body,
            variables
        });
    }

    async sendEmail(template: string, params: ISendEmailParams) {
        const {
            email,
            variables,
            sender
        } = params;

        const builder = this.emailer.emailBuilder();

        const templateFound = await this.database.findOne('EmailTemplate', {name: template});
        if (isNil(templateFound)) {
            throw new Error(`Template ${template} not found`);
        }

        const bodyString = this.replaceVars(templateFound.body, variables);
        const subjectString = this.replaceVars(templateFound.subject, variables);

        builder.setSender(sender);
        builder.setContent(bodyString);
        builder.setReceiver(email);
        builder.setSubject(subjectString);

        return this.emailer.sendEmail(builder);
    }

    private replaceVars(body: string, variables: { [key: string]: any }) {
        let str = body;
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            let value = variables[key];
            if (Array.isArray(value)) {
                value = value.toString();
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            str = str.replace(regex, value);
        });
        return str;
    }
}

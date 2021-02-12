import {isNil} from 'lodash';
import {EmailService} from '../services/email.service';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import path from "path";

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
    private database: any;
    private emailService: EmailService;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
        const self = this;
        grpcSdk.waitForExistence('database-provider').then(r => {
            self.database = self.grpcSdk.databaseProvider
        })
        let packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './admin.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            }
        );
        let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // The protoDescriptor object has the full package hierarchy
        // @ts-ignore
        let admin = protoDescriptor.email.admin.Admin;
        server.addService(admin.service, {
            getTemplates: this.getTemplates.bind(this),
            createTemplate: this.createTemplate.bind(this),
            editTemplate: this.editTemplate.bind(this),
            sendEmail: this.sendEmail.bind(this)
        });
    }

    setEmailService(emailService: EmailService) {
        this.emailService = emailService;
    }

    async getTemplates(call: any, callback: any) {
        const {skip, limit} = JSON.parse(call.request.params);
        let skipNumber = 0, limitNumber = 25;

        if (!isNil(skip)) {
            skipNumber = Number.parseInt(skip as string);
        }
        if (!isNil(limit)) {
            limitNumber = Number.parseInt(limit as string);
        }

        const templateDocumentsPromise = this.database.findMany('EmailTemplate', {}, null, skipNumber, limitNumber);
        const totalCountPromise = this.database.countDocuments('EmailTemplate', {});

        let errorMessage: string | null = null;
        const [templateDocuments, totalCount] = await Promise.all([templateDocumentsPromise, totalCountPromise]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });


        return callback(null, {result: JSON.stringify({templateDocuments, totalCount})});
    }

    async createTemplate(call: any, callback: any) {
        const {name, subject, body, variables} = JSON.parse(call.request.params);
        if (isNil(name) || isNil(subject) || isNil(body) || isNil(variables)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: "Required fields are missing",
            });
        }

        let errorMessage: string | null = null;
        const newTemplate = await this.database.create('EmailTemplate', {
            name,
            subject,
            body,
            variables
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });
        return callback(null, {result: JSON.stringify({template: newTemplate})});
    }


    async editTemplate(call: any, callback: any) {
        const params = JSON.parse(call.request.params);
        const id = params.id;

        // WHY THE FUCK
        // const allowedFields = ['name', 'subject', 'body', 'variables'];

        // const flag = Object.keys(params).some(key => {
        //     if (!allowedFields.includes(key)) {
        //         return true;
        //     }
        // });
        // if (flag) return callback({
        //     code: grpc.status.INVALID_ARGUMENT,
        //     message: "Invalid given parameters",
        // });

        let errorMessage: string | null = null;
        const templateDocument = await this.database.findOne('EmailTemplate', {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });
        if (isNil(templateDocument)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Template not found',
            });
        }

        ['name', 'subject', 'body', 'variables'].forEach(key => {
            if (params[key]) {
                templateDocument[key] = params[key];
            }
        });

        const updatedTemplate = await this.database.findByIdAndUpdate('EmailTemplate', id, templateDocument).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });

        return callback(null, {result: JSON.stringify({updatedTemplate})});
    }

    async sendEmail(call: any, callback: any) {
        let {
            templateName,
            body,
            subject,
            email,
            variables,
            sender
        } = JSON.parse(call.request.params);

        if (!templateName && (!body || !subject)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: `Template/body+subject not provided`,
            });
        }

        let errorMessage: string | null = null;
        if (!sender) {
            sender = "conduit";
        }

        if (sender.indexOf("@") === -1) {
            let emailConfig: any = await this.grpcSdk.config.get("email").catch((err: any) => console.log("failed to get sending domain"));
            sender = sender + `@${emailConfig?.sendingDomain ?? 'conduit.com'}`
        }

        await this.emailService.sendEmail(templateName, {
            body,
            subject,
            email,
            variables,
            sender: sender ? sender : "conduit"
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });

        return callback(null, {result: JSON.stringify({message: 'Email sent'})});
    }

}

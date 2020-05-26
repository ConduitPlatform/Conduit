import {isNil} from 'lodash';
import {EmailService} from '../services/email.service';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import grpc from "grpc";
import path from "path";

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
    private database: any;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, private readonly emailService: EmailService) {
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
        const {id, params} = JSON.parse(call.request.params);

        const allowedFields = ['name', 'subject', 'body', 'variables'];

        const flag = Object.keys(params).some(key => {
            if (!allowedFields.includes(key)) {
                return true;
            }
        });
        if (flag) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: "Invalid given parameters",
        });

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

        Object.keys(params).forEach(key => {
            templateDocument[key] = params[key];
        });

        const updatedTemplate = await this.database.findByIdAndUpdate('EmailTemplate', templateDocument).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });

        return callback(null, {result: JSON.stringify({updatedTemplate})});
    }

    async sendEmail(call: any, callback: any) {
        const {
            templateName,
            email,
            variables,
            sender
        } = JSON.parse(call.request.params);

        let errorMessage: string | null = null;
        await this.emailService.sendEmail(templateName, {
            email,
            variables,
            sender
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });

        return callback(null, {result: JSON.stringify({message: 'Email sent'})});
    }

}

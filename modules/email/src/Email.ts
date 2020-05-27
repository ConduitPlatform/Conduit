import {emailTemplateSchema} from './models/EmailTemplate';
import {EmailProvider} from '@conduit/email-provider';
import {EmailService} from './services/email.service';
import {AdminHandlers} from './admin/AdminHandlers';
import EmailConfigSchema from './config/email';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import path from "path";
import * as grpc from "grpc";
import {ConduitUtilities} from '@conduit/utilities';

let protoLoader = require('@grpc/proto-loader');

export default class EmailModule {
    private emailProvider: EmailProvider;
    private emailService: EmailService;
    private adminHandlers: AdminHandlers;
    private isRunning: boolean = false;
    private _url: string;
    private readonly grpcServer: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        let packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './email.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        let protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);
        let email = protoDescriptor.email.Email;
        this.grpcServer = new grpcModule.Server();

        this.grpcServer.addService(email.service, {
            setConfig: this.setConfig.bind(this),
            registerTemplate: this.registerTemplate.bind(this),
            sendEmail: this.sendEmail.bind(this)
        });

        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);


        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                return this.grpcSdk.config.get('email')
            })
            .then((emailConfig: any) => {
                if (emailConfig.active) {
                    return this.enableModule();
                }
            }).catch(console.log);

    }

    get url(): string {
        return this._url;
    }

    static get config() {
        return EmailConfigSchema;
    }

    async setConfig(call: any, callback: any) {
        const newConfig = JSON.parse(call.request.newConfig);
        if (!ConduitUtilities.validateConfigFields(newConfig, EmailConfigSchema.email)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid configuration values'});
        }

        let errorMessage: string | null = null;
        const updateResult = await this.grpcSdk.config.updateConfig(newConfig, 'email').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        const emailConfig = await this.grpcSdk.config.get('email');
        if (emailConfig.active) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            return callback({code: grpc.status.FAILED_PRECONDITION, message: 'Module is not active'});
        }
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        return callback(null, {updatedConfig: JSON.stringify(updateResult)});
    }

    private async enableModule() {
        if (!this.isRunning) {
            this.registerModels();
            await this.initEmailProvider();
            this.emailService = new EmailService(this.emailProvider, this.grpcSdk);
            this.adminHandlers = new AdminHandlers(this.grpcServer, this.grpcSdk, this.emailService);
            console.log("bound on:", this._url);
            this.grpcServer.start();
            this.isRunning = true;
        } else {
            await this.initEmailProvider();
            this.emailService.updateProvider(this.emailProvider);
        }
    }

    async registerTemplate(call: any, callback: any) {
        const params = {
            name: call.request.name,
            subject: call.request.subject,
            body: call.request.body,
            variables: call.request.variables
        };
        let errorMessage: string | null = null;
        const template = await this.emailService.registerTemplate(params).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {template: JSON.stringify(template)});
    }

    async sendEmail(call: any, callback: any) {
        const template = call.request.templateName;
        const params = {
            email: call.request.params.email,
            variables: JSON.parse(call.request.params.variables),
            sender: call.request.params.sender
        }
        let errorMessage: string | null = null;
        const sentMessageInfo = await this.emailService.sendEmail(template, params).catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {sentMessageInfo});
    }

    private registerModels() {
        const database = this.grpcSdk.databaseProvider;
        database!.createSchemaFromAdapter(emailTemplateSchema);
    }

    private async initEmailProvider() {
        const emailConfig = await this.grpcSdk.config.get('email');

        let {transport, transportSettings} = emailConfig;

        this.emailProvider = new EmailProvider(transport, transportSettings);
    }
}

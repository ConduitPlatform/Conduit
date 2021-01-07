import { emailTemplateSchema } from "./models/EmailTemplate";
import { EmailProvider } from "@quintessential-sft/email-provider";
import { EmailService } from "./services/email.service";
import { AdminHandlers } from "./admin/AdminHandlers";
import EmailConfigSchema from "./config";
import { isNil } from "lodash";
import ConduitGrpcSdk, { grpcModule } from "@quintessential-sft/conduit-grpc-sdk";
import path from "path";
import * as grpc from "grpc";

let protoLoader = require("@grpc/proto-loader");

export default class EmailModule {
  private emailProvider: EmailProvider;
  private emailService: EmailService;
  private adminHandlers: AdminHandlers;
  private isRunning: boolean = false;
  private _url: string;
  private readonly grpcServer: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    let packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "./email.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);
    let email = protoDescriptor.email.Email;
    this.grpcServer = new grpcModule.Server();

    this.grpcServer.addService(email.service, {
      setConfig: this.setConfig.bind(this),
      registerTemplate: this.registerTemplate.bind(this),
      sendEmail: this.sendEmail.bind(this),
    });
    this.adminHandlers = new AdminHandlers(this.grpcServer, this.grpcSdk, this.emailService);

    this._url = process.env.SERVICE_URL || "0.0.0.0:0";
    let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure(), {
      "grpc.max_receive_message_length": 1024 * 1024 * 100,
      "grpc.max_send_message_length": 1024 * 1024 * 100
    });
    this._url = process.env.SERVICE_URL || "0.0.0.0:" + result;
    console.log("bound on:", this._url);
    this.grpcServer.start();

    this.grpcSdk
      .waitForExistence("database-provider")
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        const self = this;
        this.grpcSdk.bus?.subscribe("email-provider", (message: string) => {
          if (message === "config-update") {
            this.enableModule()
              .then((r) => {
                console.log("Update email configuration");
              })
              .catch((e: Error) => {
                console.log("Failed to update email config");
              });
          }
        });
      })
      .catch(() => {
        console.log("Bus did not initialize");
      })
      .then(() => {
        return this.grpcSdk.config.get("email");
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(EmailConfigSchema.getProperties(), "email");
      })
      .then((emailConfig: any) => {
        return this.grpcSdk.config.addFieldstoConfig(EmailConfigSchema.getProperties(), "email");
      })
      .catch(() => {
        console.log("email config did not update");
      })
      .then((emailConfig: any) => {
        if (emailConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  get url(): string {
    return this._url;
  }

  async setConfig(call: any, callback: any) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (isNil(newConfig.active) || isNil(newConfig.transport) || isNil(newConfig.transportSettings)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration given" });
    }
    if (!EmailConfigSchema.load(newConfig).validate()) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration given" });
    }

    let errorMessage: string | null = null;
    let updateResult = null;

    if (newConfig.active) {
      await this.enableModule(newConfig).catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      updateResult = await this.grpcSdk.config
        .updateConfig(newConfig, "email")
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish("email-provider", "config-update");
    } else {
      return callback({ code: grpc.status.FAILED_PRECONDITION, message: "Module must be activated to set config" });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  private async enableModule(newConfig?: any) {
    if (!this.isRunning) {
      this.registerModels();
      await this.initEmailProvider();
      this.emailService = new EmailService(this.emailProvider, this.grpcSdk);
      this.isRunning = true;
      this.grpcSdk.bus?.publish("email-provider", "enabled");
    } else {
      await this.initEmailProvider(newConfig);
      this.emailService.updateProvider(this.emailProvider);
    }
  }

  async registerTemplate(call: any, callback: any) {
    const params = {
      name: call.request.name,
      subject: call.request.subject,
      body: call.request.body,
      variables: call.request.variables,
    };
    let errorMessage: string | null = null;
    const template = await this.emailService.registerTemplate(params).catch((e) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    return callback(null, { template: JSON.stringify(template) });
  }

  async sendEmail(call: any, callback: any) {
    const template = call.request.templateName;
    const params = {
      email: call.request.params.email,
      variables: JSON.parse(call.request.params.variables),
      sender: call.request.params.sender,
    };
    let emailConfig: any = await this.grpcSdk.config.get("email").catch(err=>console.log("failed to get sending domain"));
    params.sender = params.sender + `@${emailConfig?.sendingDomain ?? 'conduit.com'}`
    let errorMessage: string | null = null;
    const sentMessageInfo = await this.emailService
      .sendEmail(template, params)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    return callback(null, { sentMessageInfo });
  }

  private registerModels() {
    const database = this.grpcSdk.databaseProvider;
    database!.createSchemaFromAdapter(emailTemplateSchema);
  }

  private async initEmailProvider(newConfig?: any) {
    let emailConfig = !isNil(newConfig) ? newConfig : await this.grpcSdk.config.get("email");

    let { transport, transportSettings } = emailConfig;

    this.emailProvider = new EmailProvider(transport, transportSettings);
  }
}

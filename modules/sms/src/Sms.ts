import { ISmsProvider } from "./interfaces/ISmsProvider";
import { TwilioProvider } from "./providers/twilio";
import SmsConfigSchema from "./config";
import { AdminHandlers } from "./admin/admin";
import { isNil } from "lodash";
import ConduitGrpcSdk, { grpcModule } from "@quintessential-sft/conduit-grpc-sdk";
import path from "path";
import * as grpc from "grpc";

let protoLoader = require("@grpc/proto-loader");

export default class SmsModule {
  private _provider: ISmsProvider | undefined;
  private adminHandlers: AdminHandlers;
  private isRunning: boolean = false;
  private _url: string;
  private readonly grpcServer: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    let packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "./sms.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);
    let sms = protoDescriptor.sms.Sms;
    this.grpcServer = new grpcModule.Server();

    this.grpcServer.addService(sms.service, {
      setConfig: this.setConfig.bind(this),
      sendVerificationCode: this.sendVerificationCode.bind(this),
      verify: this.verify.bind(this),
    });

    this.adminHandlers = new AdminHandlers(this.grpcServer, this.grpcSdk, this._provider);

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
        this.grpcSdk.bus?.subscribe("sms", (message: string) => {
          if (message === "config-update") {
            this.enableModule()
              .then((r) => {
                console.log("Updated sms configuration");
              })
              .catch((e: Error) => {
                console.log("Failed to update email config");
              });
          }
        });
      })
      .catch(() => {
        console.log("Bus did not initialize!");
      })
      .then(() => {
        return this.grpcSdk.config.get("sms");
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(SmsConfigSchema.getProperties(), "sms");
      })
      .then((smsConfig: any) => {
        return this.grpcSdk.config.addFieldstoConfig(SmsConfigSchema.getProperties(), "sms");
      })
      .catch(() => {
        console.log("sms config did not update");
      })
      .then((smsConfig: any) => {
        if (smsConfig.active) {
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
    if (isNil(newConfig.active) || isNil(newConfig.providerName) || isNil(newConfig[newConfig.providerName])) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration given" });
    }
    if (!SmsConfigSchema.load(newConfig).validate()) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration given" });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, "sms")
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const smsConfig = await this.grpcSdk.config.get("sms");
    if (smsConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish("sms", "config-update");
    } else {
      return callback({ code: grpc.status.INTERNAL, message: "Module is not active" });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updateConfig: JSON.stringify(updateResult) });
  }

  async sendSms(call: any, callback: any) {
    const { to, message } = JSON.parse(call.request.params);
    let errorMessage: string | null = null;

    if (isNil(this._provider)) {
        return callback({code: grpc.status.INTERNAL, message: 'No sms provider'});
    }

    await this._provider.sendSms(to, message)
        .catch((e: any) => errorMessage = e.message);
    if (!isNil(errorMessage)) return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage
    });

    return callback(null, {result: JSON.stringify({message: 'SMS sent'})});
  }

  async sendVerificationCode(call: any, callback: any) {
    const to = call.request.to;

    if (isNil(this._provider)) {
      return callback({ code: grpc.status.INTERNAL, message: "No sms provider" });
    }
    if (isNil(to)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "No sms recipient" });
    }

    let errorMessage: string | null = null;

    let verificationSid = await this._provider.sendVerificationCode(to).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verificationSid });
  }

  async verify(call: any, callback: any) {
    const { verificationSid, code } = call.request;

    if (isNil(this._provider)) {
      return callback({ code: grpc.status.INTERNAL, message: "No sms provider" });
    }
    if (isNil(verificationSid) || isNil(code)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "No verification id or code provided" });
    }

    let errorMessage: string | null = null;

    let verified = await this._provider.verify(verificationSid, code).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verified });
  }

  private async enableModule() {
    await this.initProvider();
    this.adminHandlers.updateProvider(this._provider!);
    this.isRunning = true;
  }

  private async initProvider() {
    const smsConfig = await this.grpcSdk.config.get("sms");
    const name = smsConfig.providerName;
    const settings = smsConfig[name];

    if (name === "twilio") {
      this._provider = new TwilioProvider(settings);
    } else {
      console.error("SMS provider not supported");
      process.exit(-1);
    }
  }
}

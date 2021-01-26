import { IPaymentProvider } from '../interfaces/IPaymentProvider';
import Stripe from 'stripe';
import { isNil } from 'lodash';
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";

export class StripeProvider implements IPaymentProvider {
  private readonly api_key: string;
  private client: Stripe;

  constructor(api_key: string, private readonly grpcSdk: ConduitGrpcSdk) {
    this.api_key = api_key;
    this.client = new Stripe(this.api_key, {
      apiVersion: "2020-08-27"
    });
  }

  async createPayment(
    currency: string,
    unitAmount: number,
  ): Promise<any> {
    let errorMessage: string | null = null;
    let serverConfig = await this.grpcSdk.config.getServerConfig().catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return Promise.reject(errorMessage);
    let url = serverConfig.url;

    const intent = await this.client.paymentIntents.create({
      amount: unitAmount,
      currency,
    });

    return Promise.resolve(intent.client_secret);
  }
}
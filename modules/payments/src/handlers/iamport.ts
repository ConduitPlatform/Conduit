import Stripe from 'stripe';
import { isNil } from 'lodash';
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import {ConduitError} from "@quintessential-sft/conduit-sdk";
import * as grpc from "grpc";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

const PROVIDER_NAME = 'iamport';
const BASE_URL = 'https://api.iamport.kr';

export class IamportHandlers {
  private initialized: boolean = false;
  private database: any;
  private secretKey: string;
  private apiKey: string;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.validate()
      .then(() => {
        return this.initDb();
      })
      .catch((e: Error) => {
        console.log('Iamport not active');
      });
  }

  async validate(): Promise<Boolean> {
    return this.grpcSdk.config.get('payments')
      .then((paymentsConfig: any) => {
        if (!paymentsConfig.iamport.enabled) {
          throw ConduitError.forbidden('Iamport is deactivated')
        }
        if (!paymentsConfig.iamport || !paymentsConfig.iamport.secret_key || !paymentsConfig.iamport.api_key) {
          throw ConduitError.forbidden('Cannot enable iamport due to missing api keys');
        }
        this.secretKey = paymentsConfig.iamport.secret_key;
        this.apiKey = paymentsConfig.iamport.api_key;
      })
      .then(() => {
        if (!this.initialized) {
          return this.initDb();
        }
      })
      .then((r: any) => {
        return true;
      })
      .catch((e: Error) => {
        this.initialized = false;
        throw e;
      });
  }

  private async initDb() {
    await this.grpcSdk.waitForExistence('database-provider');
    this.database = this.grpcSdk.databaseProvider;
    this.initialized = true;
  }

  private async getToken(): Promise<string> {
    let access_token;
    try {
      const res = await axios.post(`${BASE_URL}/users/getToken`, {
        imp_key: this.apiKey,
        imp_secret: this.secretKey
      });

      access_token = res?.data?.response?.access_token;
    } catch (e) {
      return Promise.reject(e);
    }


    return Promise.resolve(access_token);
  }

  async addCard(call: any, callback: any) {
    const { email, buyerName, phoneNumber, address, postCode } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'No headers provided' });
    }

    if (isNil(email) || isNil(buyerName) || isNil(phoneNumber) || isNil(address) || isNil(postCode)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'email, buyerName, phoneNumber, address and postCode are required' });
    }

    let errorMessage: string | null = null;

    const customer = await this.database.create('PaymentsCustomer', {
      userId: context.user._id,
      iamport: {
        email,
        buyerName,
        phoneNumber,
        address,
        postCode
      }
    }).catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const access_token = await this.getToken()
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const merchantId = uuidv4();

    try {
      await axios.post(`${BASE_URL}/payments/prepare`, {
        merchant_uid: merchantId,
        amount: 0
      }, {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    await this.database.create('Transaction', {
      userId: context.user._id,
      provider: PROVIDER_NAME,
      iamport: {
        merchantId
      }
    })

    return callback(null, { result: JSON.stringify({ customerId: customer._id, merchantId }) });
  }

  async validateCard(call: any, callback: any) {
    const { customerId } = JSON.parse(call.request.params);

    if (isNil(customerId)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'customerId is required' });
    }

    let errorMessage: string | null = null;

    const customer = await this.database.findOne('PaymentsCustomer', { _id: customerId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    customer.iamport.isCardVerified = true;
    await this.database.findByIdAndUpdate('PaymentsCustomer', customerId, customer)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: JSON.stringify({ message: 'card validate successfully'})});
  }

  async completePayment(call: any, callback: any) {
    const { data, userId } = JSON.parse(call.request.params);
    let errorMessage: string | null = null;

    await this.database.create('Transaction', {
      userId,
      provider: PROVIDER_NAME,
      data
    }).catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: JSON.stringify('ok') });
  }
}
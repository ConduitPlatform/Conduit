import { isNil } from 'lodash';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ConduitError } from '@quintessential-sft/conduit-sdk';
import * as grpc from 'grpc';
import axios from 'axios';
import { calculateRenewDate, dateToUnixTimestamp } from '../utils/subscriptions';

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
    return this.grpcSdk.config
      .get('payments')
      .then((paymentsConfig: any) => {
        if (!paymentsConfig.iamport.enabled) {
          throw ConduitError.forbidden('Iamport is deactivated');
        }
        if (
          !paymentsConfig.iamport ||
          !paymentsConfig.iamport.secret_key ||
          !paymentsConfig.iamport.api_key
        ) {
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
        imp_secret: this.secretKey,
      });

      access_token = res?.data?.response?.access_token;
    } catch (e) {
      return Promise.reject(e);
    }

    return Promise.resolve(access_token);
  }

  async createPayment(
    productId: string,
    quantity?: number,
    userId?: string
  ): Promise<{ merchant_uid: string; amount: number }> {
    let errorMessage: string | null = null;

    const product = await this.database
      .findOne('Product', { _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return Promise.reject(errorMessage);
    }
    if (isNil(product)) {
      return Promise.reject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'product not found',
      });
    }
    if (product.currency !== 'KRW') {
      return Promise.reject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'iamport supports only products with KRW currency',
      });
    }
    if (product.isSubscription) {
      return Promise.reject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'product cant be a subscription',
      });
    }
    if (!isNil(quantity) && quantity <= 0) {
      return Promise.reject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'quantity must be greater than 0',
      });
    }

    const transaction = await this.database
      .create('Transaction', {
        userId: userId,
        provider: PROVIDER_NAME,
        product: productId,
        quantity: quantity || 1,
        data: {
          status: 'prepared',
        },
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return Promise.reject({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const access_token = await this.getToken().catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return Promise.reject({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const amount = product.value * (quantity || 1);

    try {
      await axios.post(
        `${BASE_URL}/payments/prepare`,
        {
          merchant_uid: transaction._id,
          amount,
        },
        {
          headers: {
            Authorization: `${access_token}`,
          },
        }
      );
    } catch (e) {
      return Promise.reject({ code: grpc.status.INTERNAL, message: e.message });
    }

    return Promise.resolve({ merchant_uid: transaction._id, amount });
  }

  async completePayment(imp_uid: string, merchant_uid: string) {
    let errorMessage: string | null = null;

    const access_token = await this.getToken().catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return Promise.reject({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const transaction = await this.database
      .findOne('Transaction', { _id: merchant_uid }, null, ['product'])
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return Promise.reject({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(transaction)) {
      return Promise.reject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'transaction not found',
      });
    }

    let paymentData;
    try {
      paymentData = await axios.get(`${BASE_URL}/payments/${imp_uid}`, {
        headers: {
          Authorization: access_token,
        },
      });
      paymentData = paymentData.data.response;
    } catch (e) {
      return Promise.reject({ code: grpc.status.INTERNAL, message: e.message });
    }

    if (paymentData.amount === transaction.product.value * transaction.quantity) {
      if (paymentData.status === 'paid') {
        transaction.data.status = 'paid';
        await this.database
          .findByIdAndUpdate('Transaction', transaction._id, transaction)
          .catch((e: Error) => {
            errorMessage = e.message;
          });
        if (!isNil(errorMessage)) {
          return Promise.reject({ code: grpc.status.INTERNAL, message: errorMessage });
        }
        return Promise.resolve(true);
      }
    } else {
      return Promise.reject({
        code: grpc.status.ABORTED,
        message: 'Forged payment attempted',
      });
    }

    return Promise.reject({ code: grpc.status.ABORTED, message: 'Payment failed' });
  }

  async addCard(call: any, callback: any) {
    const { email, buyerName, phoneNumber, address, postCode } = JSON.parse(
      call.request.params
    );
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    if (
      isNil(email) ||
      isNil(buyerName) ||
      isNil(phoneNumber) ||
      isNil(address) ||
      isNil(postCode)
    ) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'email, buyerName, phoneNumber, address and postCode are required',
      });
    }

    let errorMessage: string | null = null;

    const customer = await this.database
      .create('PaymentsCustomer', {
        userId: context.user._id,
        email,
        buyerName,
        phoneNumber,
        address,
        postCode,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const access_token = await this.getToken().catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const transaction = await this.database
      .create('Transaction', {
        userId: context.user._id,
        provider: PROVIDER_NAME,
        data: {
          status: 'add card',
        },
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    try {
      await axios.post(
        `${BASE_URL}/payments/prepare`,
        {
          merchant_uid: transaction._id,
          amount: 0,
        },
        {
          headers: {
            Authorization: `${access_token}`,
          },
        }
      );
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, {
      result: JSON.stringify({ customerId: customer._id, merchant_uid: transaction._id }),
    });
  }

  async validateCard(call: any, callback: any) {
    const { customerId } = JSON.parse(call.request.params);

    if (isNil(customerId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'customerId is required',
      });
    }

    let errorMessage: string | null = null;

    const customer = await this.database
      .findOne('PaymentsCustomer', { _id: customerId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    customer.iamport.isCardVerified = true;
    await this.database
      .findByIdAndUpdate('PaymentsCustomer', customerId, customer)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, {
      result: JSON.stringify({ message: 'card validate successfully' }),
    });
  }

  async subscribeToProduct(call: any, callback: any) {
    const { productId, customerId } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    if (isNil(productId) || isNil(customerId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'productId and customerId are required',
      });
    }

    let errorMessage: string | null = null;

    const product = await this.database
      .findOne('Product', { _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(product) || !product.isSubscription) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'productId not found or its not a subscription',
      });
    }
    if (product.currency !== 'KRW') {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'iamport supports only products with KRW currency',
      });
    }

    const customer = await this.database
      .findOne('PaymentsCustomer', { _id: customerId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: errorMessage });
    }
    if (isNil(customer) || !customer.iamport.isCardVerified) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'customerId not found or customer has not verified card',
      });
    }

    let serverConfig = await this.grpcSdk.config
      .getServerConfig()
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    let url = serverConfig.url;

    const access_token = await this.getToken().catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const transaction = await this.database
      .create('Transaction', {
        userId: context.user._id,
        provider: PROVIDER_NAME,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    let paymentStatus;

    try {
      const { code, status } = await axios.post(
        `${BASE_URL}/subscribe/again`,
        {
          customer_uid: customer._id,
          merchant_uid: transaction._id,
          amount: product.value,
          name: `Recurring payments for ${product.name}`,
        },
        {
          headers: {
            Authorization: access_token,
          },
        }
      );

      if (code === 0) {
        if (status === 'paid') {
          paymentStatus = 'paid';
        } else {
          paymentStatus =
            'Failed to approve the payment (e.g. Customer card limit exceeded, suspended card, insufficient balance, etc.)';
        }
      } else {
        paymentStatus = 'The payment was not approved by the card company';
      }
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e });
    }

    transaction.data = {
      status: paymentStatus,
    };

    await this.database
      .findByIdAndUpdate('Transaction', transaction._id, transaction)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (paymentStatus !== 'paid') {
      return callback({ code: grpc.status.INTERNAL, message: paymentStatus });
    }

    let renewDate = calculateRenewDate(product.recurring, product.recurringCount);

    const futureTransaction = await this.database
      .create('Transaction', {
        userId: context.user._id,
        provider: PROVIDER_NAME,
        data: {
          status: `Scheduled payments for ${renewDate.format()}`,
        },
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    try {
      await axios.post(`${BASE_URL}/subscribe/payments/schedule`, {
        customer_uid: customer._id,
        schedules: [
          {
            merchant_uid: futureTransaction._id,
            schedule_at: dateToUnixTimestamp(renewDate),
            amount: product.value,
            notice_url: `${url}/hook/payments/iamport/subscriptionCallback`,
          },
        ],
      });
    } catch (e) {
      console.error('could not schedule next payment');
    }

    const subscription = await this.database
      .create('Subscription', {
        product: product._id,
        userId: context.user._id,
        customerId,
        iamport: {
          nextPaymentId: futureTransaction._id,
        },
        activeUntil: renewDate.toDate(),
        transactions: [transaction._id],
        provider: PROVIDER_NAME,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: JSON.stringify({ ...subscription }) });
  }

  async cancelSubscription(call: any, callback: any) {
    const { subscriptionId } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    if (isNil(subscriptionId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'subscriptionId is required',
      });
    }

    let errorMessage: string | null = null;

    const subscription = await this.database
      .findOne('Subscription', {
        _id: subscriptionId,
        userId: context.user._id,
        provider: PROVIDER_NAME,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(subscription)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'subscription not found',
      });
    }
    if (Date.parse(subscription.activeUntil) < new Date().getTime()) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'subscription is inactive',
      });
    }

    const customer = await this.database
      .findOne('PaymentsCustomer', { userId: context.user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(customer) || isNil(customer.iamport)) {
      return callback({ code: grpc.status.INTERNAL, message: 'customer not found' });
    }

    const access_token = await this.getToken().catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    try {
      await axios.post(
        `${BASE_URL}/subscribe/payments/unschedule`,
        {
          customer_uid: customer._id,
          merchant_uid: subscription.iamport.nextPaymentId,
        },
        {
          headers: {
            Authorization: access_token,
          },
        }
      );
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e });
    }

    return callback(null, {
      result: JSON.stringify({ message: 'Subscription cancelled' }),
    });
  }

  async subscriptionCallback(call: any, callback: any) {
    const { imp_uid, merchant_uid } = JSON.parse(call.request.params);

    let errorMessage: string | null = null;

    const access_token = await this.getToken().catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      console.error(errorMessage);
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    let serverConfig = await this.grpcSdk.config
      .getServerConfig()
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    let url = serverConfig.url;

    const subscription = await this.database
      .findOne('Subscription', { 'iamport.nextPaymentId': merchant_uid }, null, [
        'product',
      ])
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      console.error(errorMessage);
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    try {
      const paymentData = await axios.get(`${BASE_URL}/payments/${imp_uid}`, {
        headers: {
          Authorization: access_token,
        },
      });

      if (paymentData.data.response.status === 'paid') {
        await this.database.create('Transaction', {
          provider: PROVIDER_NAME,
          data: paymentData.data.response,
        });

        let renewDate = calculateRenewDate(
          subscription.product.recurring,
          subscription.product.recurringCount
        );
        const transaction = this.database.create('Transaction', {
          userId: subscription.userId,
          provider: PROVIDER_NAME,
          data: {
            status: `Scheduled payments for ${renewDate.format()}`,
          },
        });

        await axios.post(`${BASE_URL}/subscribe/payments/schedule`, {
          customer_uid: subscription.iamport.customer_uid,
          schedules: [
            {
              merchant_uid: transaction._id,
              schedule_at: dateToUnixTimestamp(renewDate),
              amount: subscription.product.value,
              notice_url: `${url}/hook/payments/iamport/subscriptionCallback`,
            },
          ],
        });

        subscription.activeUntil = renewDate.toDate();
        subscription.iamport.nextPaymentId = transaction._id;
        await this.database.findByIdAndUpdate(
          'Subscription',
          subscription._id,
          subscription
        );
      } else {
        await this.database.create('Transaction', {
          provider: PROVIDER_NAME,
          data: {
            ...paymentData.data.response,
            status: 'Failed',
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async getPaymentMethods(call: any, callback: any) {
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    let errorMessage: string | null = null;

    const paymentMethods = await this.database
      .findMany('PaymentsCustomer', {
        userId: context.user._id,
        'iamport.isCardVerified': true,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: JSON.stringify({ paymentMethods }) });
  }
}

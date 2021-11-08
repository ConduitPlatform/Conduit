import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { StripeHandlers } from '../handlers/stripe';
import { populateArray } from '../utils/populateArray';

let paths = require('./admin.json').functions;
const escapeStringRegexp = require('escape-string-regexp');
export class AdminHandlers {
  private database: DatabaseProvider;

  constructor(
    server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly stripeHandlers: StripeHandlers | null
  ) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider!;
    });

    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        createProduct: this.createProduct.bind(this),
        createCustomer: this.createCustomer.bind(this),
        getCustomers: this.getCustomers.bind(this),
        getProducts: this.getProducts.bind(this),
        editProduct: this.editProduct.bind(this),
        getSubscription: this.getSubscription.bind(this),
        getTransactions: this.getTransactions.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async getProducts(call: RouterRequest, callback:RouterResponse){
    const { skip, limit,search } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {};
    let identifier;
    if(!isNil(search)){
      identifier = escapeStringRegexp(search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options:'i'};
    }
    const productDocumentsPromise = this.database.findMany(
      'Product',
      query,
      undefined,
      skipNumber,
      limitNumber,

    );
    const totalCountPromise = this.database.countDocuments('Product', query);

    let errorMessage;
    const [productDocuments, totalCount] = await Promise.all([
      productDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ productDocuments, totalCount }) });
  }

  async getCustomers(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit,search } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {};
    let identifier;
    if(!isNil(search)){
      identifier = escapeStringRegexp(search);
      query['email'] =  { $regex: `.*${identifier}.*`, $options:'i'};
    }
    const customerDocumentsPromise = this.database.findMany(
      'PaymentsCustomer',
      query,
      undefined,
      skipNumber,
      limitNumber
    );
    const totalCountPromise = this.database.countDocuments('PaymentsCustomer', query);

    let errorMessage;
    const [customerDocuments, totalCount] = await Promise.all([
      customerDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ customerDocuments, totalCount }) });
  }

  async editProduct(call:RouterRequest,callback:RouterResponse){
    const params = JSON.parse(call.request.params);
    const id = params.id;
    let errorMessage: string | null = null;
    const productDocument = await this.database
      .findOne('Product', { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    if (isNil(productDocument)) {
      return callback({
        code: status.INTERNAL,
        message: 'Product not found',
      });
    }
    ['name', 'value', 'currency','isSubscription','recurring','recurringCount','stripe'].forEach((key) => {
      if (params[key] ) {
          productDocument[key] = params[key];
      }
    });
    const updatedProduct = await this.database
      .findByIdAndUpdate('Product', id, productDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ updatedProduct }) });
  }

  async createCustomer(call: RouterRequest, callback: RouterResponse){
    const {
      userId,
      email,
      phoneNumber,
      buyerName,
      address,
      postCode,
      stripe
    } = JSON.parse(call.request.params);

    if(isNil(userId) || isNil(email) || isNil(phoneNumber) ){
      return callback({
        code: status.INTERNAL,
        message: 'userId,  email, phoneNumber are required'
      })
    }
    let errorMessage: string | null = null;
    const user = await this.database
      .findOne('User',{_id: userId})
      .catch( (err:any) => errorMessage = err);

    if(isNil(user)){
      return callback({
        code: status.INTERNAL,
        message: 'User with id: ' + userId + ' does not exists'
      });
    }

    let  customerDoc = {
      userId,
      email,
      phoneNumber,
      buyerName,
      address,
      postCode,
      stripe
    };

    const customerExists = await this.database
      .findOne('PaymentsCustomer',{userId: userId})
      .catch((error:any) => errorMessage = error);
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage
      })
    }
    if(isNil(customerExists)) {

      const createdCustomer = await this.database
        .create('PaymentsCustomer', customerDoc)
        .catch((error: any) => errorMessage = error);

      if (!isNil(errorMessage)) {
        return callback({
          code: status.INTERNAL,
          message: errorMessage
        })
      }
      return callback(null,{ result: JSON.stringify(createdCustomer) })
    }
    else{
      return callback({
        code: status.INTERNAL,
        message: 'customer with userId ' +  userId + ' already exists'
      })
    }
  }


  async createProduct(call: RouterRequest, callback: RouterResponse) {
    const {
      name,
      value,
      currency,
      isSubscription,
      recurring,
      recurringCount,
    } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(value) || isNil(currency)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'product name, value and currency are required',
      });
    }
    if(!isNil(isSubscription)){
      if(isNil(recurring)){
        return callback({
          code: status.INTERNAL,
          message: 'recurring  must be provided!'
        })
      }
    }
    let errorMessage: string | null = null;

    let productDoc: any = {
      name,
      value,
      currency,
      isSubscription,
      recurring,
      recurringCount,
    };

    if (isSubscription) {
      if (isNil(recurring)) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'recurring is required for subscription products',
        });
      }
      if (
        recurring !== 'day' &&
        recurring !== 'week' &&
        recurring !== 'month' &&
        recurring !== 'year'
      ) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'recurring must be one of [day, week, month, year]',
        });
      }

      if (!isNil(this.stripeHandlers)) {
        try {
          const res = await this.stripeHandlers.createSubscriptionProduct(
            name,
            currency,
            value,
            recurring,
            recurringCount
          );

          productDoc.stripe = {};
          productDoc.stripe.subscriptionId = res.subscriptionId;
          productDoc.stripe.priceId = res.priceId;
        } catch (e) {
          return callback({ code: status.INTERNAL, message: e });
        }
      }
    }

    const product = await this.database
      .create('Product', productDoc)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    this.grpcSdk.bus?.publish('payments:create:Product', JSON.stringify(productDoc));

    return callback(null, { result: JSON.stringify(product) });
  }

  async getSubscription(call: RouterRequest, callback: RouterResponse){
    const { skip, limit,populate } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {},populates;
    if(!isNil(populate) && populate){
      populates = populateArray(populate);
    }
    const subscriptionDocumentsPromise = this.database.findMany(
        'Subscription',
        query,
      undefined,
        skipNumber,
        limitNumber,
        undefined,
        populates,
    );
    const totalCountPromise = this.database.countDocuments('Subscription', query);

    let errorMessage;
    const [subscriptionDocuments, totalCount] = await Promise.all([
      subscriptionDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    return callback(null, { result: JSON.stringify({ subscriptionDocuments, totalCount }) });

  }

  async getTransactions(call: RouterRequest, callback: RouterResponse){
    const { skip, limit,customerId,productId} = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {};

    if(!isNil(customerId)){
      query['customerId'] = customerId
    }
    if(!isNil(productId)){
      query['product'] = productId
    }
    const transactionDocumentsPromise = this.database.findMany(
      'Transaction',
      query,
      undefined,
      skipNumber,
      limitNumber
    );
    const totalCountPromise = this.database.countDocuments('Transaction', query);

    let errorMessage;
    const [transactionDocuments, totalCount] = await Promise.all([
      transactionDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    return callback(null, { result: JSON.stringify({ transactionDocuments, totalCount }) });

  }
}
